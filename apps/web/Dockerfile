# Multi-stage build for the PeoplePay360 web client.
# Build context is the repository root so the shared workspace package resolves.

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
WORKDIR /repo
# Next.js inlines NEXT_PUBLIC_* at build time, so it must be present here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @peoplepay360/shared \
 && npm run build -w @peoplepay360/web

FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production

# The standalone output bundles only the modules the server actually needs.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
