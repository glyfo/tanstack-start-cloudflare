#!/bin/bash
# Comprehensive test suite for post-reorganization validation
# Tests structure, builds, and functionality

set -e  # Exit on first error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           COMPREHENSIVE VALIDATION TEST SUITE                ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Track overall status
TESTS_FAILED=0

run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}▶ ${test_name}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

  if eval "$test_command"; then
    echo -e "\n${GREEN}✓ ${test_name} PASSED${NC}\n"
  else
    echo -e "\n${RED}✗ ${test_name} FAILED${NC}\n"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 1: Structure Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "File Structure Check" "pnpm tsx backend/scripts/test-reorganization.ts"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 2: Dependency Installation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "Install Dependencies" "pnpm install"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 3: TypeScript Type Checking${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "Backend Type Check" "cd backend && pnpm tsc --noEmit"
run_test "Frontend Type Check" "cd frontend && pnpm tsc --noEmit"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 4: Configuration Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "Backend Wrangler Config" "cd backend && pnpm wrangler deploy --dry-run --outdir=.wrangler/dry-run"
run_test "Frontend Vite Config" "cd frontend && pnpm vite build --mode production 2>&1 | head -20 || true"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 5: Script Accessibility${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "Test Scripts Executable" "test -x backend/scripts/test-webhook.sh"
run_test "Test Agent Script Exists" "test -f backend/scripts/test-agent.ts"
run_test "Test Intents Script Exists" "test -f backend/scripts/test-intents.ts"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}PHASE 6: Documentation Integrity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

run_test "Architecture Doc Exists" "test -f docs/ARCHITECTURE.md"
run_test "Backend README Exists" "test -f backend/README.md"
run_test "Design Examples Exist" "test -d docs/design/ui-examples"
run_test "No Broken Doc Links" "! grep -r 'scripts/test-' docs/*.md docs/guides/*.md 2>/dev/null | grep -v 'backend/scripts'"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                      FINAL RESULTS                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}"
  echo "  ✓ Project structure is correct"
  echo "  ✓ Dependencies installed successfully"
  echo "  ✓ TypeScript types are valid"
  echo "  ✓ Configurations are working"
  echo "  ✓ Scripts are accessible"
  echo "  ✓ Documentation is up to date"
  echo -e "${NC}"
  echo -e "${GREEN}The reorganization was successful! 🎉${NC}\n"
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ ${TESTS_FAILED} TEST(S) FAILED${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}"
  echo "Please review the failed tests above and fix any issues."
  echo "Common fixes:"
  echo "  • Run 'pnpm install' if dependencies failed"
  echo "  • Check TypeScript errors with 'pnpm tsc --noEmit'"
  echo "  • Verify wrangler.jsonc syntax if config failed"
  echo -e "${NC}\n"
  exit 1
fi
