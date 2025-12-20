#!/bin/bash

# Cloudflare KV Namespace Setup Script
# Run this to automatically create KV namespaces and generate wrangler.jsonc config

echo "🚀 Setting up Cloudflare KV Namespaces..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Installing..."
    npm install -g wrangler
fi

echo "📦 Creating KV namespaces..."
echo ""

# Create CRM_MESSAGES namespace
echo "1️⃣  Creating CRM_MESSAGES namespace (production)..."
CRM_MESSAGES_PROD=$(wrangler kv:namespace create "CRM_MESSAGES" --json | jq -r '.id')
echo "   ID: $CRM_MESSAGES_PROD"

echo "   Creating CRM_MESSAGES namespace (preview)..."
CRM_MESSAGES_PREVIEW=$(wrangler kv:namespace create "CRM_MESSAGES" --preview --json | jq -r '.id')
echo "   Preview ID: $CRM_MESSAGES_PREVIEW"
echo ""

# Create CRM_LEADS namespace
echo "2️⃣  Creating CRM_LEADS namespace (production)..."
CRM_LEADS_PROD=$(wrangler kv:namespace create "CRM_LEADS" --json | jq -r '.id')
echo "   ID: $CRM_LEADS_PROD"

echo "   Creating CRM_LEADS namespace (preview)..."
CRM_LEADS_PREVIEW=$(wrangler kv:namespace create "CRM_LEADS" --preview --json | jq -r '.id')
echo "   Preview ID: $CRM_LEADS_PREVIEW"
echo ""

echo "✅ Namespaces created! Here are your IDs:"
echo ""
echo "CRM_MESSAGES (Production): $CRM_MESSAGES_PROD"
echo "CRM_MESSAGES (Preview):    $CRM_MESSAGES_PREVIEW"
echo "CRM_LEADS (Production):    $CRM_LEADS_PROD"
echo "CRM_LEADS (Preview):       $CRM_LEADS_PREVIEW"
echo ""

echo "📝 Add these to your wrangler.jsonc:"
echo ""
cat << EOF
  "kv_namespaces": [
    {
      "binding": "CRM_MESSAGES",
      "id": "$CRM_MESSAGES_PROD",
      "preview_id": "$CRM_MESSAGES_PREVIEW"
    },
    {
      "binding": "CRM_LEADS",
      "id": "$CRM_LEADS_PROD",
      "preview_id": "$CRM_LEADS_PREVIEW"
    }
  ],
EOF

echo ""
echo "🎯 Next steps:"
echo "1. Copy the config above"
echo "2. Update wrangler.jsonc with the IDs"
echo "3. Run: npm run build"
echo "4. Run: npm run deploy"
echo ""
