# ovote API image — multi-stage build.
# Build stage installs the full pnpm workspace, compiles shared + crypto +
# api into dist/, then the runtime stage copies only the API's dist and
# production deps. Node 24.x, pnpm 10.x via corepack.

FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfile + workspace manifests first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json  packages/shared/
COPY packages/crypto/package.json  packages/crypto/
COPY apps/api/package.json         apps/api/
COPY apps/web/package.json         apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/crypto packages/crypto
COPY apps/api        apps/api

RUN pnpm --filter @ovote/shared build \
 && pnpm --filter @ovote/crypto build \
 && pnpm --filter @ovote/api    build

# Produce a deployable node_modules containing only prod deps.
RUN pnpm --filter @ovote/api deploy --prod /out

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json

RUN mkdir -p /data \
 && chown -R node:node /app /data

USER node
EXPOSE 3000

CMD ["node", "dist/index.js"]
