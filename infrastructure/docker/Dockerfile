# BLACKSENTINEL AI - production image
#
# This previously copied packages/ (deleted — see the memory/commit notes;
# it was ~10,500 lines never imported by the live server), built with
# `npx turbo run build` (a no-op: turbo found zero workspace packages, so
# this step produced nothing), and its CMD pointed at
# packages/ai-engine/dist/index.js, a file that never existed. This
# Dockerfile could not have produced a working image. The CI/CD workflow
# builds and pushes this file on every push to main.

FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY shared/ ./shared/
COPY src/ ./src/

RUN npm ci
RUN npm run build

# ============================================================================
# Production Image
# ============================================================================

FROM node:20-slim AS production

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r blacksentinel && useradd -r -g blacksentinel blacksentinel

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/dist/ ./dist/
COPY database/ ./database/

RUN npm ci --omit=dev

RUN chown -R blacksentinel:blacksentinel /app

USER blacksentinel

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "dist/src/server/index.js"]
