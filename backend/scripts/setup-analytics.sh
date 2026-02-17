#!/bin/bash

# Setup Analytics Engine for Conversation Tracking
# This script creates the Analytics Engine dataset and verifies the configuration

set -e

echo "🚀 Setting up Analytics Engine for Conversation Tracking..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler is not installed"
    echo "   Install it with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler found"
echo ""

# Login check
echo "📝 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "   Run: wrangler login"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Create Analytics Engine dataset
echo "📊 Creating Analytics Engine dataset..."
echo "   Dataset name: conversation_analytics"
echo ""

# Check if dataset already exists by trying to create it
if wrangler analytics-engine create conversation_analytics 2>&1 | grep -q "already exists"; then
    echo "⚠️  Dataset 'conversation_analytics' already exists (this is OK)"
else
    echo "✅ Dataset 'conversation_analytics' created successfully"
fi

echo ""
echo "🔍 Verifying configuration..."
echo ""

# Check wrangler.jsonc for Analytics Engine binding
if grep -q "ANALYTICS_ENGINE" ../wrangler.jsonc; then
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
if grep -q "0 2 \* \* \*" ../wrangler.jsonc; then
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
echo "   2. Integrate tracking in ChatAgent"
echo "   3. View analytics at: /admin/analytics"
echo ""
echo "📖 Documentation:"
echo "   - CONTINUOUS_IMPROVEMENT_LOOP.md"
echo "   - OBSERVABILITY_COMPARISON.md"
echo ""
echo "🔗 Useful Commands:"
echo "   - View logs: wrangler tail"
echo "   - Test locally: pnpm run dev"
echo "   - Query data: Use GraphQL API (see docs)"
echo ""
