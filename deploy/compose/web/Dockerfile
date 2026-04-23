# ovote Web image — vite build served by nginx.
# VITE_OVOTE_API is baked in at build time; set it via the compose build
# arg so the resulting bundle points at the right API host.

FROM node:24-bookworm-slim AS build

ARG VITE_OVOTE_API=http://localhost:3000
ENV VITE_OVOTE_API=${VITE_OVOTE_API} \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json  packages/shared/
COPY packages/crypto/package.json  packages/crypto/
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/crypto packages/crypto
COPY apps/web        apps/web

RUN pnpm --filter @ovote/shared build \
 && pnpm --filter @ovote/crypto build \
 && pnpm --filter @ovote/web    build

FROM nginx:1.27-alpine AS runtime

COPY deploy/compose/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
