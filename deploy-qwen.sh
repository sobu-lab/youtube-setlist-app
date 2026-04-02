#!/usr/bin/env bash
# Qwen2.5-0.5B 実験用デプロイスクリプト
# ローカルで docker build → Artifact Registry へ push → Cloud Run にデプロイ
# 使い方: bash deploy-qwen.sh
set -euo pipefail

PROJECT_ID="sobu-lab"
REGION="asia-northeast1"
SERVICE="youtube-setlist-app-qwen"
IMAGE="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-images/${SERVICE}"

# backend/.env から YOUTUBE_API_KEY を読み込む
ENV_FILE="$(dirname "$0")/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE が見つかりません"
  exit 1
fi

YOUTUBE_API_KEY="$(grep -E '^YOUTUBE_API_KEY=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
if [[ -z "$YOUTUBE_API_KEY" ]]; then
  echo "ERROR: YOUTUBE_API_KEY が .env に設定されていません"
  exit 1
fi

# ローカルでビルド済みのイメージを Artifact Registry へ push
echo "==> Artifact Registry へ push"
gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet
docker push "${IMAGE}:latest"

# Cloud Run にデプロイ
echo "==> Cloud Run にデプロイ"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars "YOUTUBE_API_KEY=${YOUTUBE_API_KEY}"

echo "==> デプロイ完了"
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)"
