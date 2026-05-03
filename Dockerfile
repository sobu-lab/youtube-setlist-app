# Stage 1: React フロントエンドをビルド
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: FastAPI バックエンド
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
ENV PORT=8080
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
