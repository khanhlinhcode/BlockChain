#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
COMPOSE_FILE="docker-compose.sepolia.yml"

read_env() {
  local file="$1"
  local key="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true
  fi
}

write_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  touch "$file"
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    $0 ~ "^" key "=" { print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

is_placeholder_address() {
  local value="${1:-}"
  [[ -z "$value" ]] && return 0
  [[ "$value" == "0x0000000000000000000000000000000000000000" ]] && return 0
  [[ "$value" == "0x_YOUR_DEPLOYED_CONTRACT_ADDRESS" ]] && return 0
  [[ "$value" == "0xYourContractAddress" ]] && return 0
  [[ "$value" == "0x5FbDB2315678afecb367f032d93F642f64180aa3" ]] && return 0
  return 1
}

is_hardhat_default_key() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" || "$value" == "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" ]]
}

if [[ -z "${CERTCHAIN_HOST_IP:-}" ]]; then
  if command -v ipconfig >/dev/null 2>&1; then
    CERTCHAIN_HOST_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi
fi

if [[ -z "${CERTCHAIN_HOST_IP:-}" ]]; then
  CERTCHAIN_HOST_IP="localhost"
fi

CONTRACT_ADDRESS="${CONTRACT_ADDRESS:-$(read_env backend/.env CONTRACT_ADDRESS)}"
ALCHEMY_URL="${ALCHEMY_URL:-$(read_env backend/.env ALCHEMY_URL)}"
ADMIN_PRIVATE_KEY_VALUE="${ADMIN_PRIVATE_KEY:-$(read_env backend/.env ADMIN_PRIVATE_KEY)}"
SMART_CONTRACT_PRIVATE_KEY_VALUE="$(read_env smart-contract/.env PRIVATE_KEY)"

if [[ -z "${ALCHEMY_URL:-}" || "$ALCHEMY_URL" == *"localhost"* || "$ALCHEMY_URL" == *"127.0.0.1"* || "$ALCHEMY_URL" == *"hardhat"* ]]; then
  ALCHEMY_URL="$(read_env smart-contract/.env ALCHEMY_SEPOLIA_URL)"
fi

if is_placeholder_address "$CONTRACT_ADDRESS"; then
  cat >&2 <<'ERR'
Missing Sepolia CONTRACT_ADDRESS.
Deploy first, then copy the Sepolia address into backend/.env:

  cd smart-contract
  npm run deploy:sepolia

Required backend/.env value:
  CONTRACT_ADDRESS=0x_your_sepolia_contract_address
ERR
  exit 1
fi

if [[ -z "${ALCHEMY_URL:-}" || "$ALCHEMY_URL" == *"YOUR_KEY"* || "$ALCHEMY_URL" == *"localhost"* || "$ALCHEMY_URL" == *"127.0.0.1"* ]]; then
  cat >&2 <<'ERR'
Missing Sepolia RPC URL.
Set one of these values:

  backend/.env:        ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
  smart-contract/.env: ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ERR
  exit 1
fi

if { [[ -z "${ADMIN_PRIVATE_KEY_VALUE:-}" ]] || is_hardhat_default_key "$ADMIN_PRIVATE_KEY_VALUE"; } && [[ -n "${SMART_CONTRACT_PRIVATE_KEY_VALUE:-}" ]] && ! is_hardhat_default_key "$SMART_CONTRACT_PRIVATE_KEY_VALUE"; then
  ADMIN_PRIVATE_KEY_VALUE="$SMART_CONTRACT_PRIVATE_KEY_VALUE"
  write_env backend/.env ADMIN_PRIVATE_KEY "$ADMIN_PRIVATE_KEY_VALUE"
  echo "Synced backend ADMIN_PRIVATE_KEY from smart-contract/.env PRIVATE_KEY (value hidden)."
fi

if [[ -z "${ADMIN_PRIVATE_KEY_VALUE:-}" ]] || is_hardhat_default_key "$ADMIN_PRIVATE_KEY_VALUE"; then
  cat >&2 <<'ERR'
backend/.env is missing a Sepolia admin private key or is still using the default Hardhat private key.
That key maps to 0xf39F...2266 and is NOT an admin on the Sepolia contract.

Set backend/.env:
  ADMIN_PRIVATE_KEY=0x_private_key_of_the_Sepolia_admin_wallet

For the current Sepolia deployment, the admin/owner wallet is:
  0x1Db58e673d1267b9AB9722e90Abc7E9E9AeBBD86
ERR
  exit 1
fi

export ALCHEMY_URL
export CONTRACT_ADDRESS
export ADMIN_PRIVATE_KEY="$ADMIN_PRIVATE_KEY_VALUE"
export FRONTEND_URL="${FRONTEND_URL:-http://${CERTCHAIN_HOST_IP}:3000}"
export PUBLIC_FRONTEND_URL="${PUBLIC_FRONTEND_URL:-$FRONTEND_URL}"
export NEXT_PUBLIC_FRONTEND_URL="${NEXT_PUBLIC_FRONTEND_URL:-$FRONTEND_URL}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${CERTCHAIN_HOST_IP}:5001/api}"
export NEXT_PUBLIC_CONTRACT_ADDRESS="${NEXT_PUBLIC_CONTRACT_ADDRESS:-$CONTRACT_ADDRESS}"
export NEXT_PUBLIC_CHAIN_ID="11155111"
export NEXT_PUBLIC_RPC_URL="${NEXT_PUBLIC_RPC_URL:-$ALCHEMY_URL}"
export NEXT_PUBLIC_IPFS_GATEWAY="${NEXT_PUBLIC_IPFS_GATEWAY:-https://gateway.pinata.cloud/ipfs}"
export NEXT_PUBLIC_ISSUING_ORG="${NEXT_PUBLIC_ISSUING_ORG:-CertChain}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000,http://${CERTCHAIN_HOST_IP}:3000}"

if [[ -z "${NEXT_PUBLIC_ALCHEMY_KEY:-}" && "$ALCHEMY_URL" == *"alchemy.com/v2/"* ]]; then
  export NEXT_PUBLIC_ALCHEMY_KEY="${ALCHEMY_URL##*/}"
fi

write_env backend/.env ALCHEMY_URL "$ALCHEMY_URL"
write_env backend/.env CONTRACT_ADDRESS "$CONTRACT_ADDRESS"
write_env backend/.env ADMIN_PRIVATE_KEY "$ADMIN_PRIVATE_KEY"
write_env backend/.env FRONTEND_URL "$FRONTEND_URL"
write_env backend/.env PUBLIC_FRONTEND_URL "$PUBLIC_FRONTEND_URL"
write_env backend/.env BASE_URL "$FRONTEND_URL"
write_env backend/.env CORS_ALLOWED_ORIGINS "$CORS_ALLOWED_ORIGINS"

write_env frontend/.env.local NEXT_PUBLIC_API_URL "$NEXT_PUBLIC_API_URL"
write_env frontend/.env.local NEXT_PUBLIC_FRONTEND_URL "$NEXT_PUBLIC_FRONTEND_URL"
write_env frontend/.env.local NEXT_PUBLIC_CONTRACT_ADDRESS "$NEXT_PUBLIC_CONTRACT_ADDRESS"
write_env frontend/.env.local NEXT_PUBLIC_CHAIN_ID "$NEXT_PUBLIC_CHAIN_ID"
write_env frontend/.env.local NEXT_PUBLIC_RPC_URL "$NEXT_PUBLIC_RPC_URL"
write_env frontend/.env.local NEXT_PUBLIC_ALCHEMY_KEY "${NEXT_PUBLIC_ALCHEMY_KEY:-}"
write_env frontend/.env.local NEXT_PUBLIC_IPFS_GATEWAY "$NEXT_PUBLIC_IPFS_GATEWAY"
write_env frontend/.env.local NEXT_PUBLIC_ISSUING_ORG "$NEXT_PUBLIC_ISSUING_ORG"

cat <<INFO
CertChain Sepolia Docker stack
- Frontend: ${FRONTEND_URL}
- Backend:  ${NEXT_PUBLIC_API_URL}
- RPC:      ${NEXT_PUBLIC_RPC_URL}
- Chain:    Sepolia (11155111)
- Contract: ${NEXT_PUBLIC_CONTRACT_ADDRESS}
INFO

# The Next.js dev cache embeds public env values. Clear it before Docker start
# so Sepolia mode does not reuse a stale Hardhat/local client bundle.
rm -rf frontend/.next

docker compose -f "$COMPOSE_FILE" up --build
