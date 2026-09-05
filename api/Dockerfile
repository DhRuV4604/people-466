# Multi-stage build for the PeoplePay360 API.
# Build context is the repository root so the shared workspace package resolves.

FROM node:20-alpine AS deps
WORKDIR /repo
# OpenSSL is required by the Prisma query engine on Alpine.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY frontend/package.json frontend/
# The API generates its Prisma client on install, so the schema has to be here
# before `npm ci` rather than arriving with the rest of the sources.
COPY api/prisma api/prisma
# --mount=type=cache keeps the npm store between builds, so a rebuild resolves
# from disk instead of re-downloading every tarball.
#
# Only the workspaces this image runs are installed. The install is hoisted, so
# without the filter the API would carry the entire web client's dependency
# tree — Next, React, Tailwind — into a container that never renders a page.
RUN --mount=type=cache,target=/root/.npm     npm ci --workspace @peoplepay360/api --workspace @peoplepay360/shared --include-workspace-root

FROM deps AS build
WORKDIR /repo
COPY shared shared
COPY api api
RUN npm run build -w @peoplepay360/shared \
 && npx prisma generate --schema api/prisma/schema.prisma \
 && npm run build -w @peoplepay360/api

FROM node:20-alpine AS runner
WORKDIR /repo
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/shared ./shared
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/package.json ./api/package.json
COPY --from=build /repo/api/prisma ./api/prisma

EXPOSE 4000

# Apply pending migrations before serving so a fresh volume is usable, then seed
# only when the database is still empty.
CMD ["sh", "-c", "npx prisma migrate deploy --schema api/prisma/schema.prisma && npx tsx api/prisma/seed.ts --if-empty && node api/dist/src/main.js"]
