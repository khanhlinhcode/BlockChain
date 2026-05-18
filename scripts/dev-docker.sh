#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${CERTCHAIN_HOST_IP:-}" ]]; then
  if command -v ipconfig >/dev/null 2>&1; then
    CERTCHAIN_HOST_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi
fi

if [[ -z "${CERTCHAIN_HOST_IP:-}" ]]; then
  CERTCHAIN_HOST_IP="localhost"
fi

export FRONTEND_URL="${FRONTEND_URL:-http://${CERTCHAIN_HOST_IP}:3000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${CERTCHAIN_HOST_IP}:5001/api}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000,http://${CERTCHAIN_HOST_IP}:3000}"

cat <<INFO
CertChain Docker dev stack
- Frontend: ${FRONTEND_URL}
- Backend:  ${NEXT_PUBLIC_API_URL}
- Hardhat:  http://localhost:8545
INFO

docker compose -f docker-compose.dev.yml up --build
