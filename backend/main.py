import os
import re
import json
import logging
import googleapiclient.discovery
import google.generativeai as genai
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
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
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
AI_PROVIDER = os.environ["AI_PROVIDER"]


def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/live/)([^&\n?#]+)",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    raise ValueError(f"有効なYouTube URLではありません: {url}")


def get_youtube_client():
    return googleapiclient.discovery.build(
        "youtube", "v3", developerKey=YOUTUBE_API_KEY
    )


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


def extract_timestamp_lines(text: str) -> str:
    """タイムスタンプを含む行だけを抽出して返す。"""
    lines = [l for l in text.splitlines() if TIMESTAMP_RE.search(l)]
    return "\n".join(lines)


def get_best_setlist_comment(video_id: str) -> str:
    """タイムスタンプ行が最も多いコメント1件のタイムスタンプ行を返す。"""
    yt = get_youtube_client()
    try:
        resp = (
            yt.commentThreads()
            .list(
                part="snippet",
                videoId=video_id,
                order="relevance",
                maxResults=100,
            )
            .execute()
        )
    except Exception:
        return ""

    best = ""
    best_count = 0
    for item in resp.get("items", []):
        text = item["snippet"]["topLevelComment"]["snippet"].get("textOriginal", "")
        count = sum(1 for l in text.splitlines() if TIMESTAMP_RE.search(l))
        if count > best_count:
            best_count = count
            best = text

    return extract_timestamp_lines(best) if best_count > 0 else ""


SETLIST_PROMPT = """\
以下の行からYouTube歌枠のセットリストを抽出しJSONのみ返せ。
形式: {{"found":true,"setlist":[{{"index":1,"timestamp":"0:00","timestamp_seconds":0,"song_title":"曲名","artist":"アーティスト名またはnull"}}]}}
見つからない場合: {{"found":false,"setlist":[]}}

{text}\
"""


def parse_gemini_json(text: str) -> dict:
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    return json.loads(text.strip())


def extract_setlist_with_gemini(text: str) -> dict:
    if not text or len(text.strip()) < 5:
        return {"found": False, "setlist": []}
    prompt = SETLIST_PROMPT.format(text=text[:2000])
    try:
        resp = gemini_model.generate_content(prompt)
        return parse_gemini_json(resp.text)
    except Exception as e:
        return {"found": False, "setlist": [], "error": str(e)}


def extract_setlist(text: str, provider=AI_PROVIDER) -> dict:
    if not text or len(text.strip()) < 5:
        return {"found": False, "setlist": []}

    prompt = SETLIST_PROMPT.format(text=text[:2000])

    try:
        if provider == "openai":
            # OpenAI を使用する場合
            openai_client = OpenAI(api_key=OPENAI_API_KEY)
            response = openai_client.chat.completions.create(
                model="gpt-5.4-nano",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that outputs JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},  # JSON で返るよう強制
            )
            return parse_gemini_json(response.choices[0].message.content)

        elif provider == "gemini":
            # Gemini を使用する場合（既存の処理）
            genai.configure(api_key=GEMINI_API_KEY)
            gemini_model = genai.GenerativeModel("gemini-3.1-flash-lite-preview")
            resp = gemini_model.generate_content(prompt)
            return parse_gemini_json(resp.text)

    except Exception as e:
        logger.error(f"AI extraction error (provider={provider}): {type(e).__name__}: {e}")
        return {"found": False, "setlist": [], "error": str(e)}


@app.get("/api/setlist")
async def get_setlist(url: str = Query(..., description="YouTube URL")):
    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    video_info = get_video_info(video_id)

    # 1. 概要欄のタイムスタンプ行のみ抽出してGeminiへ
    desc_lines = extract_timestamp_lines(video_info["description"])
    setlist_result = extract_setlist(desc_lines)
    source = "description"

    # 2. 概要欄になければコメント欄からタイムスタンプ行最多の1件を使用
    if not setlist_result.get("found"):
        comment_lines = get_best_setlist_comment(video_id)
        setlist_result = extract_setlist(comment_lines)
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
