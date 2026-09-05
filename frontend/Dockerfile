# The People web client.
#
# The build context is the repository ROOT, not this directory, so the
# `@peoplepay360/shared` workspace resolves the same way it does locally.
# Build it with:  docker build -f frontend/Dockerfile .

# ---------------------------------------------------------------- dependencies
FROM node:20-alpine AS deps
WORKDIR /repo

# Only the manifests, so this layer is reused until a dependency actually
# changes rather than on every source edit.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY frontend/package.json frontend/
# The API generates its Prisma client on install, so the schema has to be here
# before `npm ci` rather than arriving with the rest of the sources.
COPY api/prisma api/prisma
# The npm store is cached between builds, so a rebuild resolves from disk
# rather than re-downloading every tarball.
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------------------------------------------------------------- build
FROM deps AS build
WORKDIR /repo

# Next inlines NEXT_PUBLIC_* at build time, so the browser-facing API address
# has to be known here and not at container start.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY shared shared
COPY frontend frontend

# The web build reads the shared package's compiled output, so it goes first.
RUN npm run build -w @peoplepay360/shared \
 && npm run build -w @peoplepay360/web

# ---------------------------------------------------------------- runtime
FROM node:20-alpine AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone carries its own minimal node_modules; static assets and public
# files are not traced into it and have to be copied alongside.
COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build /repo/frontend/public ./frontend/public

# Never run the server as root.
USER node

EXPOSE 3000

# The tracing root is the repository, so the entrypoint keeps its path within it.
CMD ["node", "frontend/server.js"]
