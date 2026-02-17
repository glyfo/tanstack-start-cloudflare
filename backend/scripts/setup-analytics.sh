#!/bin/bash

# Setup Analytics Engine for Conversation Tracking
# This script creates the Analytics Engine dataset and verifies the configuration

set -e

echo "🚀 Setting up Analytics Engine for Conversation Tracking..."
echo ""

# Change to backend directory
cd "$(dirname "$0")/.."

# Check if wrangler is available (via pnpm/npx)
echo "📦 Checking for wrangler..."
if pnpm wrangler version &> /dev/null; then
    WRANGLER="pnpm wrangler"
    echo "✅ Wrangler found (via pnpm)"
elif npx wrangler version &> /dev/null; then
    WRANGLER="npx wrangler"
    echo "✅ Wrangler found (via npx)"
else
    echo "❌ Error: wrangler is not installed"
    echo "   Install it with: pnpm install"
    exit 1
fi

echo ""

# Login check
echo "📝 Checking Cloudflare authentication..."
if ! $WRANGLER whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "   Run: $WRANGLER login"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Create Analytics Engine dataset
echo "📊 Creating Analytics Engine dataset..."
echo "   Dataset name: conversation_analytics"
echo ""

# Check if dataset already exists by trying to create it
CREATE_OUTPUT=$($WRANGLER analytics-engine create conversation_analytics 2>&1 || true)

if echo "$CREATE_OUTPUT" | grep -qi "already exists"; then
    echo "⚠️  Dataset 'conversation_analytics' already exists (this is OK)"
elif echo "$CREATE_OUTPUT" | grep -qi "created\|success"; then
    echo "✅ Dataset 'conversation_analytics' created successfully"
else
    echo "📋 Output: $CREATE_OUTPUT"
    echo "⚠️  Unable to confirm dataset creation, but continuing..."
fi

echo ""
echo "🔍 Verifying configuration..."
echo ""

# Check wrangler.jsonc for Analytics Engine binding
if grep -q "ANALYTICS_ENGINE" wrangler.jsonc; then
    echo "✅ Analytics Engine binding found in wrangler.jsonc"
else
    echo "❌ Analytics Engine binding NOT found in wrangler.jsonc"
    echo "   Add this to your wrangler.jsonc:"
    echo '   "analytics_engine_datasets": ['
    echo '     {'
    echo '       "binding": "ANALYTICS_ENGINE",'
    echo '       "dataset": "conversation_analytics"'
    echo '     }'
    echo '   ]'
    exit 1
fi

# Check for cron triggers
if grep -q "0 2 \* \* \*" wrangler.jsonc; then
    echo "✅ Improvement loop cron trigger found (daily at 2 AM)"
else
    echo "⚠️  Daily cron trigger not found"
    echo "   Add this to your wrangler.jsonc triggers:"
    echo '   "crons": ["*/15 * * * *", "0 2 * * *"]'
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📚 Next Steps:"
echo "   1. Deploy your worker: pnpm run deploy"
echo "   2. Integrate tracking in ChatAgent (see integration-example.ts)"
echo "   3. View analytics at: /admin/analytics"
echo ""
echo "📖 Documentation:"
echo "   - docs/CONTINUOUS_IMPROVEMENT_LOOP.md"
echo "   - docs/OBSERVABILITY_COMPARISON.md"
echo "   - backend/src/server/analytics/README.md"
echo ""
echo "🔗 Useful Commands:"
echo "   - View logs: $WRANGLER tail"
echo "   - Test locally: pnpm run dev"
echo "   - Query data: curl http://localhost:8787/api/analytics/conversation-insights"
echo ""
