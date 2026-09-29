# Builds and runs the whole Napoleon monorepo as one service: the server
# (packages/server) serves the built client (packages/client/dist) as
# static files and handles the game over a WebSocket on the same port.
# See DECISIONS.md #30 for why this is one service, not two.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

# Install first with only the manifests present, so this layer is cached
# across rebuilds that don't touch dependencies.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/cli/package.json packages/cli/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm -r build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "packages/server/dist/index.js"]
