# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---- build ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cognito settings are public and inlined by Next.js at build time.
ARG NEXT_PUBLIC_AWS_REGION
ARG NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_AWS_REGION=$NEXT_PUBLIC_AWS_REGION \
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
