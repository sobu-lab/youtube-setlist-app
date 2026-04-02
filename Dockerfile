# Stage 1: React フロントエンドをビルド
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: FastAPI バックエンド + Qwen2.5-0.5B (llama.cpp GGUF)
FROM python:3.12-slim
WORKDIR /app/backend

# llama-cpp-python のビルドに必要なツール
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 依存パッケージをインストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Qwen2.5-0.5B GGUF Q4_K_M をビルド時にダウンロード (~350MB)
# → コンテナ起動時に HuggingFace へのアクセス不要
RUN python -c "\
from huggingface_hub import hf_hub_download; \
hf_hub_download(\
    repo_id='Qwen/Qwen2.5-0.5B-Instruct-GGUF', \
    filename='qwen2.5-0.5b-instruct-q4_k_m.gguf', \
    local_dir='/model-cache'\
)"

COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV PORT=8080
# Cloud Run デプロイ時の推奨: --memory=4Gi --cpu=2
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
