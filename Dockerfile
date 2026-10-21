# ───────────── Etapa 1: compilar el frontend (Vite) ─────────────
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # genera /app/frontend/dist

# ───────────── Etapa 2: backend Python que sirve todo ─────────────
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# código del backend + simulación
COPY backend/     ./backend/
COPY simulation/  ./simulation/
# frontend ya compilado (lo sirve FastAPI)
COPY --from=frontend /app/frontend/dist ./frontend/dist
ENV PORT=8000
EXPOSE 8000
# $PORT lo inyecta el hosting (Render/Fly/etc.)
CMD ["sh","-c","uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
