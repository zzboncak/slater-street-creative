#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from project root
cd "$(dirname "$0")/.."

# Default local connection string
export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5433/slater?schema=public"}

echo "[dev] Bringing up Postgres via docker-compose (if not already)..."
docker compose up -d db

# Wait for Postgres to accept connections
echo "[dev] Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker exec slater-pg pg_isready -U postgres > /dev/null 2>&1; then
    echo "[dev] Postgres is ready."
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "[dev] Postgres did not become ready in time." >&2
    exit 1
  fi
done

# Run Prisma migrations (safe for dev; no-op if already applied)
echo "[dev] Running Prisma generate & migrate..."
npx prisma generate
npx prisma migrate dev --name "auto-dev" --create-only >/dev/null 2>&1 || true
npx prisma migrate deploy || true

# Seed admin user (admin/admin)
npm run db:seed || true

# Start Next.js dev server
echo "[dev] Starting Next.js dev server..."
exec npm run dev --silent
