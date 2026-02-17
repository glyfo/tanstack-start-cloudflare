# Form Handling Pattern - Common Functionality Standard

**Date:** February 16, 2026
**Status:** All forms standardized to state-driven pattern

---

## Overview

All forms in the application use the **same consistent pattern**: state-driven rendering via `activeCard`. This eliminates streaming overhead and provides instant form display.

---

## The Standard Pattern

### 1. Intent Detection (Backend)
```typescript
// backend/src/server/agents/services/intent-detector.ts
if (has('create', 'add', 'new') && has('contact')) {
  return []; // Empty array signals form request
}
```

### 2. Immediate Form Display (Backend)
```typescript
// backend/src/server/agents/services/message-processor.ts
if (isCreateContactRequest && toolsDetected.length === 0) {
  console.log("[ChatAgent] 🎯 Create contact detected - showing form immediately");
  await this.agent.showCreateContactForm({});
  return {
    shouldReturnDirectResponse: true,
    directResponse: '', // Empty - form shows via activeCard
  };
}
```

### 3. RPC Method Sets State (Backend)
```typescript
// backend/src/server/agents/chat-agent.ts
@callable()
async showCreateContactForm(initialData?: Record<string, unknown>): Promise<void> {
  this.setState({
    ...this.safeState,
    ui: {
      ...this.safeUIState,
      activeCard: {
        type: 'create-contact-form',
        data: initialData || {},
        timestamp: Date.now(),
      },
    },
  });
}
```

### 4. State-Driven Rendering (Frontend)
```typescript
// frontend/src/components/chat/ChatEngine.tsx
const stateCardElement = useMemo(() => {
  if (!agentState?.ui?.activeCard) return null;

  const { type, data } = agentState.ui.activeCard;

  switch (type as CardType) {
    case 'create-contact-form':
      return (
        <CreateContactCard
          initialData={data}
          onSubmit={handleContactCreate}
          onCancel={dismissActiveCard}
        />
      );
    // ...
  }
}, [agentState?.ui?.activeCard]);
```

---

## All Forms - Standardized Implementation

### ✅ Form 1: Create Contact
**Intent Keywords:** `create`, `add`, `new`, `remember` + `contact`, `someone`, `person`

**Backend RPC:**
```typescript
@callable()
async showCreateContactForm(initialData?: Record<string, unknown>): Promise<void>
```

**Card Type:** `'create-contact-form'`

**Frontend Component:** `<CreateContactCard />`

**Handler:** `handleContactCreate()`

**Performance:** <100ms display, 0 streaming chunks

---

### ✅ Form 2: Create Opportunity
**Intent Keywords:** `create`, `add`, `new` + `opportunity`, `deal`

**Backend RPC:**
```typescript
@callable()
async showCreateOpportunityForm(initialData?: Record<string, unknown>): Promise<void>
```

**Card Type:** `'create-opportunity-form'`

**Frontend Component:** `<CreateOpportunityCard />`

**Handler:** `handleOpportunityCreate()`

**Performance:** <100ms display, 0 streaming chunks

---

### ✅ Form 3: Opportunity Form with Contact
**Intent Keywords:** (programmatic trigger, not user-facing)

**Backend RPC:**
```typescript
@callable()
async showOpportunityFormWithContact(initialData?: Record<string, unknown>): Promise<void>
```

**Card Type:** `'opportunity-form-with-contact'`

**Frontend Component:** `<OpportunityFormWithContact />`

**Handler:** `handleOpportunityCreate()`

**Performance:** <100ms display, 0 streaming chunks

---

### ✅ Form 4: Contact Selector
**Intent Keywords:** (programmatic trigger, used in flows)

**Backend RPC:**
```typescript
@callable()
async showContactSelector(params?: { onSelect?: string }): Promise<void>
```

**Card Type:** `'contact-selector'`

**Frontend Component:** `<ContactSelectorCard />`

**Handler:** `handleContactSelected()`

**Performance:** <100ms display, 0 streaming chunks

---

## Common RPC Methods (All Forms)

### Show Form
```typescript
await agent.showCreateContactForm(initialData);
await agent.showCreateOpportunityForm(initialData);
await agent.showOpportunityFormWithContact(initialData);
await agent.showContactSelector(params);
```

### Dismiss Form
```typescript
await agent.dismissCard();
```

### Update Form State (Optional)
```typescript
await agent.updateFormState(formId, formState);
```

---

## Performance Comparison

### ❌ OLD: JSON Streaming Pattern
```typescript
// DON'T DO THIS
directResponse: `\`\`\`json:create-contact-form\n{"name": "", ...}\n\`\`\``
```
**Result:** 50+ message chunks, 3-5 second delay

### ✅ NEW: State-Driven Pattern
```typescript
// DO THIS
await this.agent.showCreateContactForm({});
return { directResponse: '' };
```
**Result:** 1 state update, <100ms delay

**Performance Improvement:** 95% fewer messages, 97% faster

---

## Frontend Handler Pattern

All form submissions follow the same pattern:

```typescript
const handleContactCreate = useCallback(async (data: ContactFormData) => {
  console.log("[ChatEngine] ✅ handleContactCreate called with data:", data);

  setStatusPhase("creating");
  setStatusTool("createContact");

  try {
    const result = await callAgentMethod('createContact', [{
      name: data.name,
      email: data.email,
      // ... map form data
    }]);
    console.log("[ChatEngine] Contact creation result:", result);
  } catch (error) {
    console.error("[ChatEngine] Contact creation error:", error);
    setStatusPhase(null);
    setStatusTool(null);
    // Show error message
  }
}, [callAgentMethod]);
```

**Common Elements:**
1. Status indicators during submission
2. RPC call via `callAgentMethod`
3. Error handling with user feedback
4. Console logging for debugging

---

## Form Validation Pattern

All forms use Zod schema validation:

```typescript
// Schema definition
export const CreateContactSchema = ContactSchema.pick({
  name: true,
  email: true,
  phone: true,
  source: true,
  // ...
});

// Validation in SchemaForm component
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const result = validateSchema(schema, formData);
  if (!result.success) {
    setErrors(result.errors!);
    return;
  }

  await onSubmit(result.data!);
};
```

---

## Message Flow (Optimized)

### User Input → Form Display
```
1. User types: "I want to remember someone new"
2. Intent detector matches: create + contact
3. Returns [] (signals form request)
4. Message processor calls: showCreateContactForm()
5. State update sent to frontend
6. Form renders instantly via activeCard
7. Total time: <100ms
8. Messages sent: 1 state update
```

### Form Submission → Result
```
1. User clicks "Create Contact"
2. Frontend validates with Zod
3. Calls RPC: callAgentMethod('createContact', [data])
4. Backend creates contact in ContactDO
5. Returns success result
6. Frontend dismisses form
7. Shows success notification
8. Total time: 200-500ms
9. Messages sent: 2-3 (RPC call + response + state update)
```

---

## Console Output (Expected)

### Form Display
```javascript
[ChatAgent] 🔍 Detecting intent for: i want to remember someone new
[ChatAgent] 🛠️ Tools detected: []
[ChatAgent] 🎯 Create contact detected - showing form immediately
[ChatEngine] 🔄 Agent state update from: server
[ChatEngine] Active card: create-contact-form
```

### Form Submission
```javascript
[SchemaForm] Submit button clicked
[SchemaForm] handleSubmit called
[SchemaForm] Validation result: { success: true, data: {...} }
[CreateContactCard] handleSubmit called
[ChatEngine] ✅ handleContactCreate called with data: {...}
[ChatEngine] Calling createContact RPC method
[ChatAgent] Contact creation result: {...}
```

---

## Anti-Patterns (Don't Do This)

### ❌ Streaming Form JSON
```typescript
// BAD - Don't stream JSON in messages
directResponse: `\`\`\`json:create-contact-form\n{...}\n\`\`\``
```

### ❌ Inline Form Rendering
```typescript
// BAD - Don't render forms inline in MessageContent
if (part.cardType === 'create-contact-form') {
  return <CreateContactCard ... />
}
```

### ❌ Multiple Rendering Paths
```typescript
// BAD - Don't have both inline and state-driven rendering
// This causes duplicate handlers and confusion
```

### ❌ Manual State Updates
```typescript
// BAD - Don't manually set activeCard from frontend
setAgentState({ ...agentState, ui: { activeCard: {...} } })
```

---

## Checklist for Adding New Forms

- [ ] 1. Define CardType in `chat-agent-types.ts`
- [ ] 2. Create RPC method `show[FormName]()` in `chat-agent.ts`
- [ ] 3. Add intent detection pattern in `intent-detector.ts`
- [ ] 4. Add form display logic in `message-processor.ts`
- [ ] 5. Create frontend component in `frontend/src/components/chat/`
- [ ] 6. Add case to `stateCardElement` switch in `ChatEngine.tsx`
- [ ] 7. Add form handler (e.g., `handleFormSubmit`) in `ChatEngine.tsx`
- [ ] 8. Test: Form shows <100ms, no streaming, single click works
- [ ] 9. Document in this file

---

## Testing Checklist

For each form, verify:

- [ ] Intent detection works with keywords
- [ ] Form appears in <100ms
- [ ] Console shows 1 state update (not 50 chunks)
- [ ] All fields display with correct labels
- [ ] Validation works (required fields, email format, etc.)
- [ ] Submit button fires once (no duplicates)
- [ ] Cancel button dismisses form
- [ ] Success/error feedback shown
- [ ] No console errors

---

## Summary

**All forms now follow the same pattern:**
1. ✅ Intent detected → RPC method called immediately
2. ✅ State updated via `activeCard`
3. ✅ Frontend renders from state (single source of truth)
4. ✅ Zero streaming overhead
5. ✅ Instant display (<100ms)
6. ✅ Consistent error handling
7. ✅ Clean console logs for debugging

**No form should ever stream JSON markdown in messages.**
