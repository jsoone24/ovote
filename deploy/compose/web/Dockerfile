# ovote Web image — vite build served by nginx.
# VITE_OVOTE_API is baked in at build time; set it via the compose build
# arg so the resulting bundle points at the right API host.

FROM node:24-bookworm-slim AS build

ARG VITE_OVOTE_API=http://localhost:3000
ENV VITE_OVOTE_API=${VITE_OVOTE_API} \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

# pnpm install resolves the entire workspace lockfile (including api's
# better-sqlite3, which compiles a native module via node-gyp). The build
# tools below are only needed during this stage; the final image is nginx
# + dist files, so the toolchain weight is build-time only.
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# tsconfig.base.json is required by every package's tsconfig (`extends:
# "../../tsconfig.base.json"`) — without it tsc/vue-tsc silently fall back
# to ES5 and the build fails with cryptic downlevel-iteration errors.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
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
