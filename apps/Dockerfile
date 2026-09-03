# Multi-Stage Frontend Web Application Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Install monorepo dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN pnpm install --frozen-lockfile

# Default exposure
EXPOSE 5001 5002 5003 5004 5005 5008

# Default dev launcher
CMD ["pnpm", "dev:all"]
