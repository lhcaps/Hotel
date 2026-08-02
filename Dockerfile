FROM node:24.18.0-bookworm-slim AS build

WORKDIR /srv/room-management
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ARG RELEASE_SHA=unknown
LABEL org.opencontainers.image.revision=${RELEASE_SHA}
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN pnpm --filter @room/config build \
 && pnpm --filter @room/contracts build \
 && pnpm --filter @room/observability build \
 && pnpm --filter @room/database build \
 && pnpm --filter @room/booking build \
 && pnpm --filter @room/auth build \
 && pnpm --filter @room/api build \
 && pnpm --filter @room/payment-demo build \
 && pnpm --filter @room/worker build \
 && pnpm --filter @room/web build \
 && mkdir -p /runtime-artifacts \
 && cp -a apps/api/dist /runtime-artifacts/api-dist \
 && cp -a packages/auth/dist /runtime-artifacts/auth-dist \
 && cp -a packages/booking/dist /runtime-artifacts/booking-dist \
 && cp -a packages/config/dist /runtime-artifacts/config-dist \
 && cp -a packages/contracts/dist /runtime-artifacts/contracts-dist \
 && cp -a packages/database/dist /runtime-artifacts/database-dist \
 && cp -a packages/observability/dist /runtime-artifacts/observability-dist \
 && cp -a apps/worker/dist /runtime-artifacts/worker-dist \
 && cp -a apps/web/.next/standalone /runtime-artifacts/web-standalone \
 && cp -a apps/web/.next/static /runtime-artifacts/web-static \
 && rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && pnpm install --prod --frozen-lockfile \
 && rm -rf apps/api/dist apps/worker/dist apps/web/.next/standalone packages/auth/dist packages/booking/dist packages/config/dist packages/contracts/dist packages/database/dist packages/observability/dist \
 && mkdir -p apps/web/.next \
 && cp -a /runtime-artifacts/api-dist apps/api/dist \
 && cp -a /runtime-artifacts/auth-dist packages/auth/dist \
 && cp -a /runtime-artifacts/booking-dist packages/booking/dist \
 && cp -a /runtime-artifacts/config-dist packages/config/dist \
 && cp -a /runtime-artifacts/contracts-dist packages/contracts/dist \
 && cp -a /runtime-artifacts/database-dist packages/database/dist \
 && cp -a /runtime-artifacts/observability-dist packages/observability/dist \
 && cp -a /runtime-artifacts/worker-dist apps/worker/dist \
 && cp -a /runtime-artifacts/web-standalone apps/web/.next/standalone \
 && mkdir -p apps/web/.next/standalone/apps/web/.next \
 && cp -a /runtime-artifacts/web-static apps/web/.next/standalone/apps/web/.next/static \
 && node scripts/deploy/write-runtime-package-manifests.mjs \
 && rm -rf /runtime-artifacts

FROM node:24.18.0-bookworm-slim AS runtime

WORKDIR /srv/room-management
ARG RELEASE_SHA=unknown
LABEL org.opencontainers.image.revision=${RELEASE_SHA}
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    RELEASE_SHA=${RELEASE_SHA}

COPY --from=build --chown=node:node /srv/room-management /srv/room-management
USER node

# Compose selects one of the three verified runtime commands per service.
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
