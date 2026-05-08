FROM node:22-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

FROM base AS deps

COPY frontend/package*.json ./
RUN npm ci

FROM deps AS dev

COPY frontend/ ./

EXPOSE 3000

CMD ["sh", "-c", "npm run dev -- -H ${HOSTNAME} -p ${PORT}"]

FROM deps AS builder

ARG NEXT_PUBLIC_CORE_API_BASE_URL=/api
ARG NEXT_PUBLIC_GAME_API_BASE_URL=/api/game
ARG INTERNAL_CORE_URL=http://core:8000
ARG INTERNAL_GAME_URL=http://game:8005

ENV NODE_ENV=production \
    NEXT_PUBLIC_CORE_API_BASE_URL=${NEXT_PUBLIC_CORE_API_BASE_URL} \
    NEXT_PUBLIC_GAME_API_BASE_URL=${NEXT_PUBLIC_GAME_API_BASE_URL} \
    INTERNAL_CORE_URL=${INTERNAL_CORE_URL} \
    INTERNAL_GAME_URL=${INTERNAL_GAME_URL}

COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

RUN addgroup -S nodejs \
    && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
