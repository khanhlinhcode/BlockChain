#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE_FILE="docker-compose.dev.yml"

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
export NEXT_PUBLIC_RPC_URL="${NEXT_PUBLIC_RPC_URL:-http://${CERTCHAIN_HOST_IP}:8545}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000,http://${CERTCHAIN_HOST_IP}:3000}"

cat <<INFO
CertChain Docker dev stack
- Frontend: ${FRONTEND_URL}
- Backend:  ${NEXT_PUBLIC_API_URL}
- Hardhat:  ${NEXT_PUBLIC_RPC_URL}
INFO

# Force the one-shot deploy service to run on every start. The deploy script is
# idempotent on local Hardhat, so this keeps contract state automatic without
# accidentally changing the configured dev address.
docker compose -f "$COMPOSE_FILE" rm -sf deploy-contract >/dev/null 2>&1 || true
docker compose -f "$COMPOSE_FILE" up --build
