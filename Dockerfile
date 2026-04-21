# ── Stage 1: Build ────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 의존성 먼저 복사해 레이어 캐시 활용
COPY package*.json ./
RUN npm ci

# 소스 복사 후 빌드 (tsc + vite build)
COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────
FROM nginx:1.27-alpine

# SPA 라우팅 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
