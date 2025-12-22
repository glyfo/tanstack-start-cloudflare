#!/bin/bash
# Dependency Verification Script
# Run: chmod +x check-dependencies.sh && ./check-dependencies.sh

echo "🔍 Checking UI System Dependencies..."
echo "═══════════════════════════════════════════"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track status
ALL_OK=true

# Function to check dependency
check_dependency() {
  local package=$1
  local required=$2
  
  if grep -q "\"$package\"" package.json; then
    version=$(grep "\"$package\"" package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    echo -e "${GREEN}✅${NC} $package $version"
  else
    if [ "$required" = "true" ]; then
      echo -e "${RED}❌${NC} $package (REQUIRED - MISSING!)"
      ALL_OK=false
    else
      echo -e "${YELLOW}⚠️${NC}  $package (optional)"
    fi
  fi
}

echo ""
echo "📦 Core Dependencies (REQUIRED):"
echo "───────────────────────────────"
check_dependency "react" "true"
check_dependency "react-dom" "true"
check_dependency "tailwindcss" "true"

echo ""
echo "🎨 UI & Components (REQUIRED):"
echo "───────────────────────────────"
check_dependency "lucide-react" "true"
check_dependency "react-markdown" "true"
check_dependency "remark-gfm" "true"

echo ""
echo "🚀 Build Tools (Required for development):"
echo "──────────────────────────────────────────"
check_dependency "@vitejs/plugin-react" "true"
check_dependency "vite" "true"
check_dependency "typescript" "true"

echo ""
echo "🔌 Framework (Required):"
echo "────────────────────────"
check_dependency "@tanstack/react-router" "true"
check_dependency "@tanstack/react-start" "true"

echo ""
echo "☁️  Deployment (Required for Cloudflare):"
echo "─────────────────────────────────────────"
check_dependency "wrangler" "true"
check_dependency "@cloudflare/vite-plugin" "true"

echo ""
echo "📋 Not Needed:"
echo "──────────────"
if grep -q "shadcn-ui\|@shadcn/ui" package.json; then
  echo -e "${YELLOW}⚠️${NC}  shadcn/ui is installed but NOT NEEDED"
else
  echo -e "${GREEN}✅${NC} shadcn/ui is NOT installed (correct!)"
fi

if grep -q "radix-ui" package.json; then
  echo -e "${YELLOW}⚠️${NC}  Radix UI is installed but NOT NEEDED"
else
  echo -e "${GREEN}✅${NC} Radix UI is NOT installed (correct!)"
fi

echo ""
echo "═══════════════════════════════════════════"
if [ "$ALL_OK" = true ]; then
  echo -e "${GREEN}✅ ALL DEPENDENCIES READY!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. npm run dev              (start dev server)"
  echo "  2. Visit http://localhost:3000"
  echo "  3. Import EnhancedChatUI in your pages"
  echo "  4. npm run deploy           (deploy to Cloudflare)"
else
  echo -e "${RED}❌ MISSING REQUIRED DEPENDENCIES!${NC}"
  echo ""
  echo "Run: npm install"
fi
echo "═══════════════════════════════════════════"
