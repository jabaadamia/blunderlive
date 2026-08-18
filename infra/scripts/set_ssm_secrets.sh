#!/usr/bin/env bash
#
# Populate production secrets in AWS SSM Parameter Store.
#
# Run this AFTER `infra/persistent` has been applied (which creates the
# placeholder params) and BEFORE `infra/stack` is applied (which reads them).
#
# Usage:
#   bash infra/scripts/set_ssm_secrets.sh            # generate + upload
#   bash infra/scripts/set_ssm_secrets.sh --force    # overwrite existing real values too
#
# Everything is generated randomly unless you supply your own via env vars:
#   CORE_SECRET_KEY              Django SECRET_KEY string
#   POSTGRES_PASSWORD            RDS master password
#   CORE_JWT_PRIVATE_KEY_PATH    path to a PEM private key  (generated if unset)
#   CORE_JWT_PUBLIC_KEY_PATH     path to a PEM public key   (generated if unset)
#   GAME_JWT_PUBLIC_KEY_PATH     path to a PEM public key   (defaults to CORE_JWT_PUBLIC_KEY_PATH)
#
# Existing params are left untouched unless their value is still the Terraform
# placeholder, or you pass --force.

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-blunderlive}"
PREFIX="/${PROJECT_NAME}/production"
PLACEHOLDER="CHANGE_ME_INITIAL_PLACEHOLDER"
FORCE="${1:-}"

# ---------------------------------------------------------------------------
# Generate (or honour overrides for) every secret value
# ---------------------------------------------------------------------------
CORE_SECRET_KEY="${CORE_SECRET_KEY:-$(openssl rand -hex 32)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 20)}"

CORE_JWT_PRIVATE_KEY=""
CORE_JWT_PUBLIC_KEY=""
if [[ -n "${CORE_JWT_PRIVATE_KEY_PATH:-}" && -n "${CORE_JWT_PUBLIC_KEY_PATH:-}" ]]; then
  CORE_JWT_PRIVATE_KEY="$(cat "${CORE_JWT_PRIVATE_KEY_PATH}")"
  CORE_JWT_PUBLIC_KEY="$(cat "${CORE_JWT_PUBLIC_KEY_PATH}")"
else
  JWT_DIR="$(mktemp -d)"
  trap 'rm -rf "${JWT_DIR}"' EXIT
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${JWT_DIR}/private.pem" >/dev/null 2>&1
  openssl rsa -in "${JWT_DIR}/private.pem" -pubout -out "${JWT_DIR}/public.pem" >/dev/null 2>&1
  CORE_JWT_PRIVATE_KEY="$(cat "${JWT_DIR}/private.pem")"
  CORE_JWT_PUBLIC_KEY="$(cat "${JWT_DIR}/public.pem")"
fi

if [[ -n "${GAME_JWT_PUBLIC_KEY_PATH:-}" ]]; then
  GAME_JWT_PUBLIC_KEY="$(cat "${GAME_JWT_PUBLIC_KEY_PATH}")"
else
  GAME_JWT_PUBLIC_KEY="${CORE_JWT_PUBLIC_KEY}"
fi

# ---------------------------------------------------------------------------
# put_secret <name> <value>
#   Creates the param, or overwrites it when it holds the placeholder value
#   (or --force was passed). Skips existing real values otherwise.
# ---------------------------------------------------------------------------
put_secret() {
  local name="$1"
  local value="$2"

  if aws ssm get-parameter --name "${name}" --region "${AWS_REGION}" --query "Parameter.Name" >/dev/null 2>&1; then
    if [[ "${FORCE}" == "--force" ]]; then
      echo "  overwriting ${name} (--force)"
    else
      local current
      current="$(aws ssm get-parameter --name "${name}" --region "${AWS_REGION}" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || true)"
      if [[ "${current}" != "${PLACEHOLDER}" ]]; then
        echo "  skipping ${name} (already has a real value; pass --force to overwrite)"
        return
      fi
      echo "  overwriting placeholder ${name}"
    fi
    aws ssm put-parameter --name "${name}" --region "${AWS_REGION}" \
      --type "SecureString" --value "${value}" --overwrite >/dev/null
  else
    echo "  creating ${name}"
    aws ssm put-parameter --name "${name}" --region "${AWS_REGION}" \
      --type "SecureString" --value "${value}" >/dev/null
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "Setting secrets under ${PREFIX} in ${AWS_REGION} ..."

put_secret "${PREFIX}/CORE_SECRET_KEY" "${CORE_SECRET_KEY}"
put_secret "${PREFIX}/POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
put_secret "${PREFIX}/CORE_JWT_PRIVATE_KEY" "${CORE_JWT_PRIVATE_KEY}"
put_secret "${PREFIX}/CORE_JWT_PUBLIC_KEY" "${CORE_JWT_PUBLIC_KEY}"
put_secret "${PREFIX}/GAME_JWT_PUBLIC_KEY" "${GAME_JWT_PUBLIC_KEY}"

echo
echo "Done."
echo "- Secrets live in SSM Parameter Store under ${PREFIX}/*"
echo "- Retrieve any value later with:"
echo "    aws ssm get-parameter --name ${PREFIX}/POSTGRES_PASSWORD --with-decryption"
echo "    --region ${AWS_REGION} --query 'Parameter.Value' --output text"
echo "- Next: apply infra/stack (it reads POSTGRES_PASSWORD to create RDS)."