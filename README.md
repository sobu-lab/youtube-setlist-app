# 歌枠セットリスト

YouTube の歌枠・歌配信 URL を入力すると、概要欄またはコメント欄からセットリストを自動抽出し、タイムスタンプジャンプ付きで再生できる Web アプリです。

**URL (本番):** https://youtube-setlist-app-qkwxzlu5tq-an.a.run.app

## 機能

- YouTube URL を貼るだけでセットリストを自動取得
- 概要欄にない場合はコメント欄から自動検索
- セットリストの曲名をクリックするとプレイヤーがその箇所にジャンプ
- 複数の AI プロバイダーを切り替えて使用可能

## 技術構成

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript + Tailwind CSS |
| バックエンド | Python + FastAPI |
| AI 解析 | Qwen2.5-0.5B-Instruct (llama.cpp GGUF Q4_K_M) |
| 動画情報取得 | YouTube Data API v3 |
| インフラ | Google Cloud Run |
| デプロイ | ローカルビルド → Artifact Registry → Cloud Run |

> **注記:** このブランチ (`feat/llama-cpp`) は外部 AI API を使わず、Qwen2.5-0.5B をコンテナ内で直接実行する実験ブランチです。本番ブランチ (`main`) は Gemini / OpenAI を使用しています。

## セットリスト抽出の仕組み

1. YouTube Data API で動画の概要欄を取得
2. タイムスタンプを含む行だけ抽出して Qwen に送信
3. 概要欄で見つからない場合はコメント欄上位 100 件を取得し、タイムスタンプ行が最も多いコメント 1 件を Qwen に送信
4. Qwen がローカル推論で曲名・アーティスト・秒数を構造化データとして返す

## 実験結果メモ

| 項目 | transformers (float32) | llama.cpp (GGUF Q4_K_M) |
|---|---|---|
| モデルサイズ | ~1GB | ~350MB |
| モデルロード時間 | ~16秒 | **~1秒** |
| 推論時間 | ~16秒 | 30〜90秒 |
| 必要メモリ | 8Gi | 2Gi |
| 精度 | 低い (0.5B の限界) | 低い (0.5B の限界) |

## デプロイ

### 必要なもの

- Docker Desktop (WSL 統合有効)
- Google Cloud SDK (`gcloud`)
- YouTube Data API v3 キー (`backend/.env` に設定)

### 手順

```bash
# 1. イメージをローカルでビルド
IMAGE="asia-northeast1-docker.pkg.dev/sobu-lab/cloud-run-images/youtube-setlist-app-qwen"
docker build -t ${IMAGE}:latest .

# 2. push & Cloud Run にデプロイ
bash deploy-qwen.sh
```

ビルド時に Qwen2.5-0.5B GGUF モデル (~350MB) をダウンロードしてイメージに含めます。初回ビルドは約 4 分かかります。

### Cloud Run 設定

| 項目 | 値 |
|---|---|
| メモリ | 2Gi |
| CPU | 2 |
| タイムアウト | 300秒 |

## ローカル開発

### 必要なもの

- Python 3.12+
- Node.js 20+
- YouTube Data API v3 キー

### バックエンド

```bash
cd backend
cp .env.example .env
# .env に YOUTUBE_API_KEY を記入

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
