# Stage 1: install frontend deps + build (native platform — no QEMU)
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: install backend deps (native platform — no QEMU)
FROM --platform=$BUILDPLATFORM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 3: final image (target platform — arm64 or amd64)
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/src ./src
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 5050
CMD ["node", "src/index.js"]
