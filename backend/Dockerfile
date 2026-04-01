FROM node:20-alpine AS web-build

WORKDIR /build/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM node:20-alpine AS backend-build

WORKDIR /build/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build && npm run typecheck

FROM node:20-alpine

WORKDIR /app

COPY --from=backend-build /build/backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /build/backend/dist ./dist
COPY --from=web-build /build/web/dist ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
