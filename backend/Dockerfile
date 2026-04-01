FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# Keep image validation aligned with CI quality gates.
RUN npm run typecheck

EXPOSE 3000

CMD ["node", "dist/index.js"]
