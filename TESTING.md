# Testing Guide

## Quick Test (Structure Validation)

Validates that the project reorganization is correct and all files are in the right place:

```bash
pnpm tsx backend/scripts/test-reorganization.ts
```

**What it checks:**
- ✅ All directories exist in correct locations
- ✅ Files moved successfully (migrations, scripts, fixtures)
- ✅ Old paths removed (no orphaned files)
- ✅ Documentation updated with new paths
- ✅ Configuration files valid
- ✅ Frontend and backend structures intact

**Expected result:** 57/57 tests passing ✅

---

## Full Test Suite (CI-Style)

Comprehensive validation including builds and type checking:

```bash
./test-all.sh
```

**What it tests:**

### Phase 1: Structure Validation
Runs the TypeScript test suite above

### Phase 2: Dependencies
- `pnpm install` succeeds
- All workspace dependencies resolve

### Phase 3: TypeScript
- Backend types compile (`pnpm tsc --noEmit`)
- Frontend types compile

### Phase 4: Build Configuration
- Backend deploys (dry-run)
- Frontend builds

### Phase 5: Script Accessibility
- Test scripts are executable
- All moved scripts accessible

### Phase 6: Documentation
- No broken links
- All references updated

---

## Individual Component Tests

### Backend Scripts

Located in `backend/scripts/`:

```bash
# Test agent functionality
pnpm tsx backend/scripts/test-agent.ts

# Test intent detection
pnpm tsx backend/scripts/test-intents.ts

# Test webhooks
node backend/scripts/test-facebook-webhook.js
node backend/scripts/test-tiktok-webhook.js
node backend/scripts/test-whatsapp-webhook.js

# Test Phase 5 features
node backend/scripts/test-phase5-features.js

# Generic webhook test
./backend/scripts/test-webhook.sh <endpoint> <secret>
```

### Build Tests

```bash
# Backend build (Wrangler)
cd backend && pnpm wrangler deploy --dry-run

# Frontend build (Vite)
cd frontend && pnpm build
```

### Type Checking

```bash
# Backend
cd backend && pnpm tsc --noEmit

# Frontend
cd frontend && pnpm tsc --noEmit

# Both
pnpm --recursive tsc --noEmit
```

---

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run validation tests
        run: pnpm tsx backend/scripts/test-reorganization.ts

      - name: Type check
        run: pnpm --recursive tsc --noEmit

      - name: Build check
        run: |
          cd backend && pnpm wrangler deploy --dry-run
          cd ../frontend && pnpm build
```

---

## Test Results

Last run: 2026-02-14

```
Total Tests: 57
Passed: 57
Failed: 0
Pass Rate: 100.0%
```

### Coverage Breakdown

| Category | Tests | Status |
|----------|-------|--------|
| Directory Structure | 4 | ✅ 100% |
| Backend Structure | 7 | ✅ 100% |
| Moved Files | 13 | ✅ 100% |
| Old Paths Removed | 6 | ✅ 100% |
| Documentation Updates | 7 | ✅ 100% |
| Configuration Files | 5 | ✅ 100% |
| Build Artifacts | 3 | ✅ 100% |
| Frontend Structure | 5 | ✅ 100% |
| Documentation Completeness | 7 | ✅ 100% |

---

## Troubleshooting

### Test Failures

If tests fail, common fixes:

1. **Missing dependencies**
   ```bash
   pnpm install
   ```

2. **Type errors**
   ```bash
   pnpm --recursive tsc --noEmit
   # Fix reported errors
   ```

3. **Configuration errors**
   ```bash
   # Validate wrangler config
   cd backend && pnpm wrangler deploy --dry-run
   cd ../frontend && pnpm wrangler deploy --dry-run
   ```

4. **Path issues**
   - Check that `backend/scripts/` contains all scripts
   - Verify `docs/design/ui-examples/` has UI screenshots
   - Confirm no old paths exist at root level

### Getting Help

- Check `backend/README.md` for backend-specific info
- See `docs/ARCHITECTURE.md` for overall structure
- Review commit `d083633` for reorganization details

---

## Adding New Tests

To add tests to the suite:

1. **Structure tests**: Edit `backend/scripts/test-reorganization.ts`
   ```typescript
   test('My new test', () => {
     return fileExists('path/to/check');
   });
   ```

2. **Build tests**: Edit `test-all.sh`
   ```bash
   run_test "My Test Name" "command to run"
   ```

3. **Run and verify**
   ```bash
   pnpm tsx backend/scripts/test-reorganization.ts
   ```

---

**Last Updated:** 2026-02-14
**Maintained By:** Development Team
