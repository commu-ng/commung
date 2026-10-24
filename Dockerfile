# Multi-stage Dockerfile for pnpm workspace
FROM node:24-slim AS base

WORKDIR /app

# Setup pnpm in single layer. pnpm 10 as corepack's default rather than
# `corepack use`, whose packageManager pin the package.json copied below
# would overwrite, leaving corepack to fetch the newest pnpm.
RUN npm install --global corepack@latest && \
     corepack enable pnpm && \
     corepack prepare pnpm@10.34.8 --activate

# Copy workspace files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY console/package.json ./console/
COPY app/package.json ./app/
COPY api/package.json ./api/

# Install all dependencies (this layer will be cached unless package files change)
RUN pnpm install --frozen-lockfile

# Console build stage
FROM base AS console-build

# Console environment variables
ARG VITE_DOMAIN=commu.ng
ENV VITE_DOMAIN=$VITE_DOMAIN

ARG VITE_API_BASE_URL=https://api.commu.ng
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Copy console config files
COPY console/components.json \
     console/react-router.config.ts \
     console/tsconfig.json \
     console/vite.config.ts \
     ./console/

# Copy console static assets
COPY console/public/ ./console/public/

# Copy console source code
COPY console/app/ ./console/app/

# Build console
RUN cd console && pnpm run build

# Console production stage (nginx)
FROM nginx:alpine AS console

COPY --from=console-build /app/console/build/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# App build stage
FROM base AS app-build

# App environment variables
ARG VITE_CONSOLE_URL=https://commu.ng
ENV VITE_CONSOLE_URL=$VITE_CONSOLE_URL

ARG VITE_API_BASE_URL=https://api.commu.ng
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Copy app config files
COPY app/components.json \
     app/react-router.config.ts \
     app/tsconfig.json \
     app/vite.config.ts \
     ./app/

# Copy app static assets
COPY app/public/ ./app/public/

# Copy app source code
COPY app/app/ ./app/app/

# Build app
RUN cd app && pnpm run build

# App production stage (nginx)
FROM nginx:alpine AS app

COPY --from=app-build /app/app/build/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# API build stage
FROM base AS api

# Copy API config files
COPY api/tsconfig.json \
     api/drizzle.config.ts \
     ./api/

# Copy API source code
COPY api/src/ ./api/src/

EXPOSE 3000
WORKDIR /app/api
CMD ["pnpm", "exec", "tsx", "src/index.ts"]