# 歌枠セットリスト

YouTube の歌枠・歌配信 URL を入力すると、概要欄またはコメント欄からセットリストを自動抽出し、タイムスタンプジャンプ付きで再生できる Web アプリです。

**URL:** https://youtube-setlist-app-qkwxzlu5tq-an.a.run.app

## 機能

- YouTube URL を貼るだけでセットリストを自動取得
- 概要欄にない場合はコメント欄から自動検索
- セットリストの曲名をクリックするとプレイヤーがその箇所にジャンプ
- Gemini AI による柔軟なフォーマット解析

## 技術構成

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript + Tailwind CSS |
| バックエンド | Python + FastAPI |
| AI 解析 | Google Gemini API (`gemini-3.1-flash-lite-preview`) |
| 動画情報取得 | YouTube Data API v3 |
| インフラ | Google Cloud Run |
| CI/CD | GitHub Actions + Workload Identity Federation |

## セットリスト抽出の仕組み

1. YouTube Data API で動画の概要欄を取得
2. タイムスタンプを含む行だけ抽出して Gemini に送信
3. 概要欄で見つからない場合はコメント欄上位 100 件を取得し、タイムスタンプ行が最も多いコメント 1 件を Gemini に送信
4. Gemini が曲名・アーティスト・秒数を構造化データとして返す

## ローカル開発

### 必要なもの

- Python 3.12+
- Node.js 20+
- YouTube Data API v3 キー
- Gemini API キー

### バックエンド

```bash
cd backend
cp .env.example .env
# .env に API キーを記入

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` でアクセス（バックエンドへのリクエストは Vite が `localhost:8000` にプロキシ）

## デプロイ

`main` ブランチに push すると GitHub Actions が自動でビルド・デプロイします。

```
git push origin main
↓
Docker マルチステージビルド（React ビルド → Python イメージに同梱）
↓
Artifact Registry にプッシュ
↓
Cloud Run にデプロイ（約2分）
```

### 初回セットアップ時に必要な GitHub Secrets

| シークレット名 | 説明 |
|---|---|
| `WIF_PROVIDER` | Workload Identity Provider のリソース名 |
| `WIF_SERVICE_ACCOUNT` | デプロイ用サービスアカウントのメールアドレス |
| `YOUTUBE_API_KEY` | YouTube Data API v3 キー |
| `GEMINI_API_KEY` | Gemini API キー |
