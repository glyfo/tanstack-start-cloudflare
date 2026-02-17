## Testing Guide# Testing Guide

This document outlines the testing strategy and implementation for the SuperHuman CRM application.

## Test Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── chat/
│   │       ├── __tests__/              # Component unit tests
│   │       │   ├── ContactCard.test.tsx
│   │       │   ├── OpportunityCard.test.tsx
│   │       │   └── TikTokLeadCard.test.tsx
│   │       └── shared/
│   │           └── __tests__/          # Shared component tests
│   │               ├── CardShell.test.tsx
│   │               ├── FieldGrid.test.tsx
│   │               ├── CardActions.test.tsx
│   │               ├── StatusBadge.test.tsx
│   │               ├── MetricBar.test.tsx
│   │               └── ContactInfoField.test.tsx
│   └── test/
│       ├── setup.ts                     # Vitest setup with jest-dom
│       ├── integration/                 # Integration tests
│       │   └── chat-system.test.ts
│       └── e2e/                        # End-to-end tests
│           └── critical-flows.spec.ts
├── vitest.config.ts                    # Vitest configuration
└── playwright.config.ts                # Playwright configuration (TBD)
```

## Test Types

### 1. Unit Tests

**Framework:** Vitest + React Testing Library + jest-dom

**Coverage:**
- ✅ Shared card components (6 components)
- ✅ Refactored cards (3 key cards: Contact, Opportunity, TikTok Lead)
- 🚧 Custom hooks (extracted but not yet tested)
- 🚧 Utility functions

**Run tests:**
```bash
cd frontend
pnpm test
```

**Watch mode:**
```bash
pnpm test:watch
```

### 2. Integration Tests

**Framework:** Vitest with mocked backend

**Coverage (Planned):**
- 🚧 Message flow (send → process → receive)
- 🚧 Tool invocation and results
- 🚧 State-driven card rendering
- 🚧 Connection management and reconnection
- 🚧 Agent state synchronization

**Run tests:**
```bash
cd frontend
pnpm test:integration
```

### 3. End-to-End Tests

**Framework:** Playwright

**Coverage (Planned):**
- 🚧 Complete chat interaction flow
- 🚧 Contact creation through chat
- 🚧 Opportunity creation through chat
- 🚧 Multi-channel admin dashboard
- 🚧 Customer identity management
- 🚧 Analytics dashboard visualization
- 🚧 Error handling and recovery

**Setup:**
```bash
pnpm install -D @playwright/test
npx playwright install
```

**Run tests:**
```bash
cd frontend
pnpm test:e2e
```

**Run with UI:**
```bash
npx playwright test --ui
```

## Test Utilities

### Vitest Setup (`frontend/src/test/setup.ts`)

Configures:
- Global test cleanup after each test
- jest-dom matchers for enhanced assertions
- DOM environment (jsdom)

### Custom Test Helpers (TBD)

Future utilities:
- `renderWithAgent()` - Render components with mocked agent connection
- `mockWebSocket()` - Mock WebSocket for connection tests
- `mockToolInvoke()` - Mock tool invocation responses
- `waitForMessage()` - Wait for agent messages in tests

## Writing Tests

### Component Tests

```tsx
import { render, screen } from '@testing-library/react';
import { ContactCard } from '../ContactCard';

it('renders contact information', () => {
  render(<ContactCard contact={mockContact} />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

### Integration Tests

```tsx
import { renderWithAgent } from '@/test/helpers';

it('sends message and receives response', async () => {
  const { user, waitForMessage } = renderWithAgent();

  await user.type(screen.getByRole('textbox'), 'Hello');
  await user.click(screen.getByRole('button', { name: 'Send' }));

  const response = await waitForMessage('assistant');
  expect(response).toContain('Hi there!');
});
```

### E2E Tests

```tsx
test('user can create contact', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('textbox').fill('Create contact for John');
  await page.getByRole('button', { name: 'Send' }).click();

  // Fill contact form
  await page.getByLabel('Name').fill('John Doe');
  await page.getByLabel('Email').fill('john@example.com');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Contact created')).toBeVisible();
});
```

## Test Coverage Goals

- **Unit tests:** 80% coverage for components and utilities
- **Integration tests:** All critical user flows
- **E2E tests:** Happy paths + error scenarios

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment

## Current Status (Feb 2026)

- ✅ **Unit tests:** Shared components (6/6), Key cards (3/9)
- ✅ **Test infrastructure:** Vitest config, test setup, jest-dom matchers
- 🚧 **Integration tests:** Structure created, implementation pending
- 🚧 **E2E tests:** Structure created, Playwright setup pending

## Next Steps

1. Complete unit test coverage for remaining cards
2. Implement integration tests for chat system
3. Set up Playwright and implement E2E tests
4. Add CI/CD pipeline with test automation
5. Set up test coverage reporting

---

**Legend:**
- ✅ Completed
- 🚧 In Progress
- ⏳ Planned
