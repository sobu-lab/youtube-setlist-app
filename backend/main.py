import os
import re
import json
import googleapiclient.discovery
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI(title="YouTube Setlist API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

YOUTUBE_API_KEY = os.environ["YOUTUBE_API_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")


def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    raise ValueError(f"有効なYouTube URLではありません: {url}")


def get_youtube_client():
    return googleapiclient.discovery.build("youtube", "v3", developerKey=YOUTUBE_API_KEY)


def get_video_info(video_id: str) -> dict:
    yt = get_youtube_client()
    resp = yt.videos().list(part="snippet,statistics", id=video_id).execute()
    items = resp.get("items", [])
    if not items:
        raise HTTPException(status_code=404, detail=f"動画が見つかりません: {video_id}")
    item = items[0]
    snippet = item["snippet"]
    stats = item.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    thumbnail = (
        thumbnails.get("maxres", {}).get("url")
        or thumbnails.get("high", {}).get("url")
        or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    )
    return {
        "video_id": video_id,
        "title": snippet.get("title", ""),
        "description": snippet.get("description", ""),
        "channel": snippet.get("channelTitle", ""),
        "thumbnail": thumbnail,
        "view_count": int(stats.get("viewCount", 0)),
        "published_at": snippet.get("publishedAt", "")[:10],
    }


TIMESTAMP_RE = re.compile(r"\d{1,2}:\d{2}")


def get_setlist_candidate_comments(video_id: str) -> list[str]:
    """タイムスタンプを含むコメントを優先して最大100件から抽出する。"""
    yt = get_youtube_client()
    try:
        resp = yt.commentThreads().list(
            part="snippet",
            videoId=video_id,
            order="relevance",
            maxResults=100,
        ).execute()
    except Exception:
        return []

    all_texts = [
        item["snippet"]["topLevelComment"]["snippet"].get("textOriginal", "")
        for item in resp.get("items", [])
    ]

    # タイムスタンプを含むコメントを優先（セットリストの可能性が高い）
    with_timestamps = [t for t in all_texts if TIMESTAMP_RE.search(t)]
    return with_timestamps if with_timestamps else all_texts


SETLIST_PROMPT = """\
あなたはYouTube歌枠配信のセットリスト抽出の専門家です。

以下のテキストから歌のセットリスト（曲目リスト）を抽出してください。
タイムスタンプ（例: 0:00, 1:23:45, [00:00]）と曲名のペアを探してください。

テキスト:
---
{text}
---

必ずJSON形式のみで返してください（マークダウン・説明文不要）:
{{
  "found": true,
  "setlist": [
    {{
      "index": 1,
      "timestamp": "0:00",
      "timestamp_seconds": 0,
      "song_title": "曲名",
      "artist": "アーティスト名（不明な場合はnull）"
    }}
  ]
}}

セットリストが見つからない場合:
{{"found": false, "setlist": []}}\
"""


def parse_gemini_json(text: str) -> dict:
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    return json.loads(text.strip())


def extract_setlist_with_gemini(text: str) -> dict:
    if not text or len(text.strip()) < 10:
        return {"found": False, "setlist": []}
    prompt = SETLIST_PROMPT.format(text=text[:8000])
    try:
        resp = gemini_model.generate_content(prompt)
        return parse_gemini_json(resp.text)
    except Exception as e:
        return {"found": False, "setlist": [], "error": str(e)}


@app.get("/api/setlist")
async def get_setlist(url: str = Query(..., description="YouTube URL")):
    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    video_info = get_video_info(video_id)

    # 1. 概要欄からセットリストを抽出
    setlist_result = extract_setlist_with_gemini(video_info["description"])
    source = "description"

    # 2. 概要欄になければコメント欄を検索（タイムスタンプ含むコメント優先）
    if not setlist_result.get("found"):
        comments = get_setlist_candidate_comments(video_id)
        if comments:
            combined = "\n\n---\n\n".join(comments)
            setlist_result = extract_setlist_with_gemini(combined)
            source = "comments"

    return {
        "video_id": video_id,
        "title": video_info["title"],
        "channel": video_info["channel"],
        "thumbnail": video_info["thumbnail"],
        "published_at": video_info["published_at"],
        "view_count": video_info["view_count"],
        "setlist_found": setlist_result.get("found", False),
        "setlist_source": source if setlist_result.get("found") else None,
        "setlist": setlist_result.get("setlist", []),
    }


# 本番: Reactビルド済みファイルを配信
static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
