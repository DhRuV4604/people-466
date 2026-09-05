# Multi-stage build for the PeoplePay360 API.
# Build context is the repository root so the shared workspace package resolves.

FROM node:20-alpine AS deps
WORKDIR /repo
# OpenSSL is required by the Prisma query engine on Alpine.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY frontend/package.json frontend/
# The API generates its Prisma client on install, so the schema has to be here
# before `npm ci` rather than arriving with the rest of the sources.
COPY apps/api/prisma apps/api/prisma
RUN npm ci

FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @peoplepay360/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @peoplepay360/api

FROM node:20-alpine AS runner
WORKDIR /repo
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma

EXPOSE 4000

# Apply pending migrations before serving so a fresh volume is usable, then seed
# only when the database is still empty.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npx tsx apps/api/prisma/seed.ts --if-empty && node apps/api/dist/src/main.js"]
