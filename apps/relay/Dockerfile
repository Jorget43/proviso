# Proviso sync relay. Build from the repository root:
#   docker build -f apps/relay/Dockerfile -t proviso-relay .
#
# Stage 1 bundles the relay into one file with esbuild; the runtime image is
# plain Node with that file and nothing else (no node_modules).
FROM node:24-bookworm-slim AS build
WORKDIR /src
RUN npm install --no-save --no-audit --no-fund esbuild@0.28.2
COPY packages/sync/src  packages/sync/src
COPY apps/relay/src     apps/relay/src
COPY apps/relay/scripts apps/relay/scripts
RUN cd apps/relay && NODE_PATH=/src/node_modules node scripts/build.mjs

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
ARG PROVISO_VERSION=dev
ENV PROVISO_VERSION=$PROVISO_VERSION
WORKDIR /app
COPY --from=build /src/apps/relay/dist/relay.mjs ./relay.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "relay.mjs"]
