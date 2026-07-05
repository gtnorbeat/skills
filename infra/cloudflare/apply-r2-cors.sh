#!/usr/bin/env bash
# Apply R2 bucket CORS configuration for direct bucket URL access.
#
# CORS at the R2 bucket level enables browsers to access files directly
# from the r2.cloudflarestorage.com URL (e.g. for <img> tags, <audio>,
# <video> elements that bypass the Worker's /api/files/* proxy).
#
# Worker-level CORS (already configured in files.ts) handles proxied
# requests; bucket-level CORS handles direct access.
#
# Usage:
#   chmod +x infra/cloudflare/apply-r2-cors.sh
#   ./infra/cloudflare/apply-r2-cors.sh
#
# Requires:
#   - wrangler installed and authenticated (npx wrangler login)
#   - CLOUDFLARE_ACCOUNT_ID or R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORS_FILE="$SCRIPT_DIR/r2-cors.json"
BUCKET="r2-aura"

if [ ! -f "$CORS_FILE" ]; then
  echo "❌ CORS config not found: $CORS_FILE"
  exit 1
fi

echo "🔧 Setting CORS on R2 bucket: $BUCKET"
echo "   Config: $(cat "$CORS_FILE" | tr '\n' ' ')\n"

# Show current CORS rules (if any)
echo "📋 Current CORS rules:"
npx wrangler r2 bucket cors list "$BUCKET" 2>/dev/null || echo "   (none — first time)"

# Apply the new CORS configuration
npx wrangler r2 bucket cors set "$BUCKET" "$CORS_FILE"

echo ""
echo "✅ CORS applied to $BUCKET"
echo "   Verify: npx wrangler r2 bucket cors list $BUCKET"
