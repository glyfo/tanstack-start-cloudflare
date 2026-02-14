#!/bin/bash

# Test TikTok Webhook Script
# Usage: ./scripts/test-webhook.sh [webhook-url] [webhook-secret]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TikTok Webhook Integration Test         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Get webhook URL
if [ -z "$1" ]; then
  echo -e "${YELLOW}Enter webhook URL:${NC}"
  read -r WEBHOOK_URL
else
  WEBHOOK_URL="$1"
fi

# Get webhook secret
if [ -z "$2" ]; then
  echo -e "${YELLOW}Enter webhook secret (or press Enter to skip signature):${NC}"
  read -r -s WEBHOOK_SECRET
  echo ""
else
  WEBHOOK_SECRET="$2"
fi

# Check if test payload exists
if [ ! -f "test-tiktok-webhook.json" ]; then
  echo -e "${RED}Error: test-tiktok-webhook.json not found${NC}"
  exit 1
fi

echo -e "${BLUE}→ Loading test payload...${NC}"
PAYLOAD=$(cat test-tiktok-webhook.json)

# Calculate signature if secret provided
if [ -n "$WEBHOOK_SECRET" ]; then
  echo -e "${BLUE}→ Calculating HMAC-SHA256 signature...${NC}"
  SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)
  echo -e "${GREEN}✓ Signature: ${SIGNATURE:0:16}...${NC}"
  SIGNATURE_HEADER="-H \"X-TikTok-Signature: $SIGNATURE\""
else
  echo -e "${YELLOW}⚠ Skipping signature (testing without verification)${NC}"
  SIGNATURE_HEADER=""
fi

# Send request
echo ""
echo -e "${BLUE}→ Sending webhook to: ${WEBHOOK_URL}${NC}"
echo ""

RESPONSE=$(eval curl -X POST "'$WEBHOOK_URL'" \
  -H "'Content-Type: application/json'" \
  $SIGNATURE_HEADER \
  -d "'$PAYLOAD'" \
  -w "\n%{http_code}" \
  -s)

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Display results
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Response Status: ${HTTP_CODE}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ SUCCESS - Webhook processed${NC}"
  echo ""
  echo -e "${BLUE}Response Body:${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

  # Check for success indicators
  if echo "$BODY" | grep -q '"success":true' || echo "$BODY" | grep -q '"processed":true'; then
    echo ""
    echo -e "${GREEN}✓ Lead processed successfully${NC}"

    # Extract lead ID if present
    LEAD_ID=$(echo "$BODY" | jq -r '.results[0].lead_id' 2>/dev/null)
    if [ "$LEAD_ID" != "null" ] && [ -n "$LEAD_ID" ]; then
      echo -e "${GREEN}✓ Lead ID: ${LEAD_ID}${NC}"
      echo -e "${BLUE}→ Check logs for opportunity creation: opp-${LEAD_ID}${NC}"
    fi
  fi

elif [ "$HTTP_CODE" -eq 401 ]; then
  echo -e "${RED}✗ AUTHENTICATION FAILED${NC}"
  echo -e "${YELLOW}Check webhook secret configuration${NC}"
  echo ""
  echo "$BODY"

elif [ "$HTTP_CODE" -eq 400 ]; then
  echo -e "${RED}✗ BAD REQUEST${NC}"
  echo -e "${YELLOW}Check payload format${NC}"
  echo ""
  echo "$BODY"

elif [ "$HTTP_CODE" -eq 500 ]; then
  echo -e "${RED}✗ SERVER ERROR${NC}"
  echo -e "${YELLOW}Check Worker logs for details${NC}"
  echo ""
  echo "$BODY"

else
  echo -e "${RED}✗ UNEXPECTED STATUS CODE: ${HTTP_CODE}${NC}"
  echo ""
  echo "$BODY"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# What to check next
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. View logs: ${GREEN}wrangler tail${NC}"
echo -e "  2. Check for: ${YELLOW}[TikTokWebhook]${NC} log entries"
echo -e "  3. Verify: ${YELLOW}[OpportunityDO]${NC} was created"
echo -e "  4. Expected: ${YELLOW}LeadQualificationDO${NC} and ${YELLOW}OpportunityDO${NC} initialized"
echo ""

exit 0
