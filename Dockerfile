FROM node:22-bookworm-slim AS pixelworld-builder

WORKDIR /src
COPY pixelworld_mvp/package.json pixelworld_mvp/package-lock.json ./
RUN npm ci
COPY pixelworld_mvp/ ./
RUN npm run build

FROM python:3.11-slim

ARG PIXELVERSE_BUILD_REVISION=unknown
ARG PIXELVERSE_BUILD_FINGERPRINT=unknown
LABEL org.opencontainers.image.revision="$PIXELVERSE_BUILD_REVISION" \
      io.pixelverse.build-fingerprint="$PIXELVERSE_BUILD_FINGERPRINT"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=pixelworld-builder /src/dist/ /app/public/pixelworld/
# Phaser asset manifests intentionally use /assets URLs in both Vite dev and
# the integrated dashboard, so merge the village pack into the existing root.
COPY --from=pixelworld-builder /src/public/assets/ /app/public/assets/

EXPOSE 5660 4567

CMD ["./scripts/container_entrypoint.sh"]
