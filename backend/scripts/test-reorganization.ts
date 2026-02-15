#!/usr/bin/env tsx
/**
 * Post-Reorganization Validation Script
 *
 * Tests that all functionality works after the project structure reorganization.
 * Run this to verify that file moves didn't break anything.
 *
 * Usage: pnpm tsx backend/scripts/test-reorganization.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name: string, fn: () => boolean | { passed: boolean; message?: string }) {
  try {
    const result = fn();
    const passed = typeof result === 'boolean' ? result : result.passed;
    const message = typeof result === 'object' ? result.message : undefined;

    results.push({ name, passed, message });

    if (passed) {
      log(`  ✓ ${name}`, 'green');
      if (message) log(`    ${colors.gray}${message}${colors.reset}`);
    } else {
      log(`  ✗ ${name}`, 'red');
      if (message) log(`    ${message}`, 'red');
    }
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    });
    log(`  ✗ ${name}`, 'red');
    log(`    Error: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

function fileExists(path: string): boolean {
  return existsSync(join(process.cwd(), path));
}

function fileContains(path: string, searchString: string): boolean {
  if (!fileExists(path)) return false;
  const content = readFileSync(join(process.cwd(), path), 'utf-8');
  return content.includes(searchString);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log('\n╔══════════════════════════════════════════════════════════════╗', 'blue');
log('║                                                              ║', 'blue');
log('║        POST-REORGANIZATION VALIDATION TEST SUITE            ║', 'blue');
log('║                                                              ║', 'blue');
log('╚══════════════════════════════════════════════════════════════╝\n', 'blue');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log('📁 SECTION 1: Directory Structure', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Backend workspace exists', () => fileExists('backend'));
test('Frontend workspace exists', () => fileExists('frontend'));
test('Docs directory exists', () => fileExists('docs'));
test('Patches directory exists', () => fileExists('patches'));

log('\n📁 SECTION 2: Backend Structure', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Backend src/ exists', () => fileExists('backend/src'));
test('Backend migrations/ exists', () => fileExists('backend/migrations'));
test('Backend scripts/ exists', () => fileExists('backend/scripts'));
test('Backend test-fixtures/ exists', () => fileExists('backend/test-fixtures'));
test('Backend README.md exists', () => fileExists('backend/README.md'));
test('Backend package.json exists', () => fileExists('backend/package.json'));
test('Backend wrangler.jsonc exists', () => fileExists('backend/wrangler.jsonc'));

log('\n📁 SECTION 3: Moved Files Verification', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Migrations
test('SQL migration moved correctly', () =>
  fileExists('backend/migrations/0001_create_contacts_table.sql')
);

// Scripts
test('test-agent.ts moved', () => fileExists('backend/scripts/test-agent.ts'));
test('test-intents.ts moved', () => fileExists('backend/scripts/test-intents.ts'));
test('test-facebook-webhook.js moved', () => fileExists('backend/scripts/test-facebook-webhook.js'));
test('test-tiktok-webhook.js moved', () => fileExists('backend/scripts/test-tiktok-webhook.js'));
test('test-whatsapp-webhook.js moved', () => fileExists('backend/scripts/test-whatsapp-webhook.js'));
test('test-phase5-features.js moved', () => fileExists('backend/scripts/test-phase5-features.js'));
test('test-webhook.sh moved', () => fileExists('backend/scripts/test-webhook.sh'));

// Test fixtures
test('Test fixture moved', () =>
  fileExists('backend/test-fixtures/test-tiktok-webhook.json')
);

// UI examples
test('UI examples README moved', () => fileExists('docs/design/ui-examples/README.md'));
test('UI screenshots directory exists', () => {
  return fileExists('docs/design/ui-examples') &&
         fileExists('docs/design/ui-examples/README.md');
});

// Tracking archived
test('Progress tracking archived', () => fileExists('docs/_archive/tracking/PROGRESS.md'));
test('Session context archived', () => fileExists('docs/_archive/tracking/SESSION_CONTEXT.md'));

log('\n📁 SECTION 4: Old Paths Removed', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Root /migrations removed', () => !fileExists('migrations'));
test('Root /scripts removed', () => !fileExists('scripts'));
test('Root /tracking removed', () => !fileExists('tracking'));
test('Root /ui-examples removed', () => !fileExists('ui-examples'));
test('Root /public removed', () => !fileExists('public/robots.txt'));
test('Root test fixture removed', () => !fileExists('test-tiktok-webhook.json'));

log('\n📄 SECTION 5: Documentation Updates', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('MVP_COMPLETE_GUIDE.md updated', () =>
  fileContains('docs/MVP_COMPLETE_GUIDE.md', 'backend/scripts/test-tiktok-webhook.js')
);

test('PHASE_5_IMPLEMENTATION_SUMMARY.md updated', () =>
  fileContains('docs/PHASE_5_IMPLEMENTATION_SUMMARY.md', 'backend/scripts/test-phase5-features.js')
);

test('QUICK_START.md updated', () =>
  fileContains('docs/guides/QUICK_START.md', 'backend/scripts/test-webhook.sh')
);

test('SOCIAL_MEDIA_TROUBLESHOOTING.md updated', () =>
  fileContains('docs/guides/SOCIAL_MEDIA_TROUBLESHOOTING.md', 'backend/scripts/')
);

test('MVP-READINESS-CHECKLIST.md updated', () =>
  fileContains('docs/MVP-READINESS-CHECKLIST.md', 'docs/design/ui-examples/README.md')
);

test('INTENT-DETECTION.md updated', () =>
  fileContains('docs/INTENT-DETECTION.md', 'backend/scripts/test-intents.ts')
);

test('No old path references in active docs', () => {
  const badPaths = [
    'scripts/test-',
    'ui-examples/',
    'tracking/PROGRESS',
  ];

  const activeDocFiles = [
    'docs/MVP_COMPLETE_GUIDE.md',
    'docs/ARCHITECTURE.md',
    'docs/guides/QUICK_START.md',
  ];

  for (const docFile of activeDocFiles) {
    if (!fileExists(docFile)) continue;
    const content = readFileSync(join(process.cwd(), docFile), 'utf-8');
    for (const badPath of badPaths) {
      if (content.includes(badPath) && !content.includes('backend/' + badPath)) {
        return {
          passed: false,
          message: `Found old path "${badPath}" in ${docFile}`
        };
      }
    }
  }

  return { passed: true, message: 'All docs use new paths' };
});

log('\n⚙️  SECTION 6: Configuration Files', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Backend wrangler.jsonc exists and readable', () => {
  const exists = fileExists('backend/wrangler.jsonc');
  const readable = exists && readFileSync(join(process.cwd(), 'backend/wrangler.jsonc'), 'utf-8').length > 0;
  return { passed: readable, message: 'Wrangler validates JSONC syntax at deploy time' };
});

test('Frontend wrangler.jsonc exists and readable', () => {
  const exists = fileExists('frontend/wrangler.jsonc');
  const readable = exists && readFileSync(join(process.cwd(), 'frontend/wrangler.jsonc'), 'utf-8').length > 0;
  return { passed: readable, message: 'Wrangler validates JSONC syntax at deploy time' };
});

test('Root package.json exists', () => fileExists('package.json'));
test('pnpm-workspace.yaml exists', () => fileExists('pnpm-workspace.yaml'));

test('Workspace configuration is valid', () => {
  const workspaceContent = readFileSync(
    join(process.cwd(), 'pnpm-workspace.yaml'),
    'utf-8'
  );
  return workspaceContent.includes('frontend') && workspaceContent.includes('backend');
});

log('\n🏗️  SECTION 7: Build Artifacts', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Frontend public/ directory exists', () => fileExists('frontend/public'));
test('Frontend robots.txt exists', () => fileExists('frontend/public/robots.txt'));
test('Dist directory exists (gitignored)', () => fileExists('dist'));

log('\n🎨 SECTION 8: Frontend Structure', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Frontend src/ exists', () => fileExists('frontend/src'));
test('Frontend components/ exists', () => fileExists('frontend/src/components'));
test('Frontend routes/ exists', () => fileExists('frontend/src/routes'));
test('ChatEngine component exists', () =>
  fileExists('frontend/src/components/chat/ChatEngine.tsx')
);
test('Shared card components exist', () =>
  fileExists('frontend/src/components/chat/shared/CardShell.tsx') &&
  fileExists('frontend/src/components/chat/shared/FieldGrid.tsx')
);

log('\n📚 SECTION 9: Documentation Completeness', 'blue');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Main ARCHITECTURE.md exists', () => fileExists('docs/ARCHITECTURE.md'));
test('Backend README.md exists', () => fileExists('backend/README.md'));
test('Backend README documents new structure', () =>
  fileContains('backend/README.md', 'migrations/') &&
  fileContains('backend/README.md', 'scripts/')
);
test('Guides directory exists', () => fileExists('docs/guides'));
test('Reference directory exists', () => fileExists('docs/reference'));
test('Design directory exists', () => fileExists('docs/design'));
test('Archive directory exists', () => fileExists('docs/_archive'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log('\n╔══════════════════════════════════════════════════════════════╗', 'blue');
log('║                      TEST RESULTS SUMMARY                    ║', 'blue');
log('╚══════════════════════════════════════════════════════════════╝\n', 'blue');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;
const passRate = ((passed / total) * 100).toFixed(1);

log(`Total Tests: ${total}`);
log(`Passed: ${passed}`, 'green');
log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
log(`Pass Rate: ${passRate}%`, failed > 0 ? 'yellow' : 'green');

if (failed > 0) {
  log('\n❌ FAILED TESTS:', 'red');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'red');
  results
    .filter(r => !r.passed)
    .forEach(r => {
      log(`  • ${r.name}`, 'red');
      if (r.message) log(`    ${r.message}`, 'gray');
    });
}

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed === 0) {
  log('✅ ALL TESTS PASSED! Project reorganization successful.\n', 'green');
  process.exit(0);
} else {
  log(`⚠️  ${failed} test(s) failed. Please review and fix.\n`, 'yellow');
  process.exit(1);
}
