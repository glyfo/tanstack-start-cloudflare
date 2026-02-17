# Form Validation Test Plan

**Date:** 2026-02-16
**Purpose:** Validate all forms are working correctly after duplicate rendering fix

---

## 1. Contact Form (`create-contact-form`)

### Title & Description
- ✅ **Title:** "Create New Contact"
- ✅ **Description:** "Add a new contact to your CRM. Required fields are marked with *"

### Primary Fields (Always Visible)
| Field | Label | Type | Required | Placeholder | Width |
|-------|-------|------|----------|-------------|-------|
| name | Their name | text | ✅ Yes | e.g. Sarah Johnson | half |
| email | Their email | email | ✅ Yes | e.g. sarah@company.com | half |
| phone | Their phone | tel | ❌ No | e.g. +1 555-0000 | half |
| source | How you met | select | ❌ No | Where did you find them? | half |

### Source Options
- TikTok, Facebook, Instagram, WhatsApp, LinkedIn
- My website, Chat, Someone referred them, Email
- I called them, Event or meetup, Other

### Secondary Fields (Show on "More options" expand)
| Field | Label | Type | Required | Placeholder | Width |
|-------|-------|------|----------|-------------|-------|
| description | Notes about them | textarea | ❌ No | Anything you want to remember... | full |
| company | Where they work | text | ❌ No | Company name | half |
| jobTitle | Their role | text | ❌ No | What they do | half |
| status | Status | select | ❌ No | - | half |

### Status Options
- Active, Not active, Archived

### Buttons
- **Submit:** "Create Contact" (black bg, white text, rounded-full)
- **Cancel:** "Cancel" (gray text, no bg)

### Validation Tests
- [ ] Empty name → Error: "Please enter their name"
- [ ] Invalid email → Error: "Please enter a valid email"
- [ ] Valid data → Form submits successfully
- [ ] Cancel button → Dismisses form (single click, no duplicates)

---

## 2. Opportunity Form (`create-opportunity-form`)

### Title & Description
- ✅ **Title:** "Create New Opportunity"
- ✅ **Description:** "Track a new sales opportunity. Required fields are marked with *"

### Contact Badge (if pre-selected)
- Shows contact avatar (first letter circle)
- Format: "For **{Contact Name}**"

### Stage Selector (Chips)
- Lead, Qualified, Proposal, Negotiation
- Interactive chips (black when selected, gray when not)

### Primary Fields
| Field | Label | Type | Required | Placeholder | Width |
|-------|-------|------|----------|-------------|-------|
| title | Deal Title | text | ✅ Yes | Enterprise License Deal | full |
| contactName | Contact | text | ❌ No | Select or enter contact | half |
| dealValue | Value | number | ❌ No | 50000 | half |
| stage | Stage | select | ❌ No | - | half |

### Secondary Fields
| Field | Label | Type | Required | Placeholder | Width |
|-------|-------|------|----------|-------------|-------|
| company | Company | text | ❌ No | Acme Inc. | half |
| expectedCloseDate | Expected Close | date | ❌ No | - | half |
| source | Source | select | ❌ No | - | half |
| probability | Probability | number | ❌ No | 50 | half |

### Optional Fields
| Field | Label | Type | Required | Placeholder | Width |
|-------|-------|------|----------|-------------|-------|
| description | Notes | textarea | ❌ No | Deal notes... | full |
| closeReason | Close Reason | text | ❌ No | Why was this closed? | half |
| competitor | Competitor | text | ❌ No | Competing vendor | half |

### Buttons
- **Submit:** "Create Opportunity" (black bg, white text, rounded-full)
- **Cancel:** "Cancel" (gray text, no bg)

### Validation Tests
- [ ] Empty title → Error: "Title is required"
- [ ] Negative dealValue → Error shown
- [ ] Valid data → Form submits successfully
- [ ] Cancel button → Dismisses form (single click, no duplicates)
- [ ] Stage chips → Updates stage field correctly

---

## 3. General Form Behavior Tests

### Button Interaction
- [ ] Submit button shows cursor-pointer on hover
- [ ] Cancel button shows cursor-pointer on hover
- [ ] Submit button disabled when already submitting
- [ ] Submit button shows loading spinner during submission
- [ ] Cancel button disabled when form is submitting

### Visual Feedback
- [ ] Required fields show red asterisk (*)
- [ ] Invalid fields show red border and error text
- [ ] "More options" toggle shows expand/collapse icon
- [ ] Field labels are readable (stone-700)
- [ ] Placeholders are subtle (stone-400)

### Event Handlers (No Duplicates!)
- [ ] Cancel button fires once per click (check console: `[ChatEngine] dismissActiveCard called`)
- [ ] Submit button fires once per click (check console: `[SchemaForm] handleSubmit called`)
- [ ] No duplicate form renderings in DOM (inspect element)

### Console Logging (Debug)
Expected logs when clicking **Cancel**:
```
[SchemaForm] Cancel button clicked
[CreateContactCard] handleCancel called
[ChatEngine] dismissActiveCard called
[ChatEngine] Calling dismissCard RPC method
[ChatEngine] dismissCard RPC completed
```

Expected logs when clicking **Create Contact** (with valid data):
```
[SchemaForm] Submit button clicked
[SchemaForm] handleSubmit called
[SchemaForm] Validation result: { success: true, data: {...} }
[SchemaForm] Calling onSubmit with data: {...}
[CreateContactCard] handleSubmit called
[CreateContactCard] Calling onSubmit prop
[ChatEngine] ✅ handleContactCreate called with data: {...}
[ChatEngine] Calling createContact RPC method
```

---

## 4. Browser Testing Matrix

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✅ | ✅ | |
| Firefox | ✅ | ✅ | |
| Safari | ✅ | ✅ | |
| Edge | ✅ | - | |

---

## 5. Production URLs to Test

- **Frontend:** https://tanstack-start-cloudflare-frontend.glyfo.workers.dev
- **Backend:** https://tanstack-start-cloudflare-backend.glyfo.workers.dev

### Test Steps:
1. Open frontend URL
2. Type "I want to remember someone new"
3. Verify Contact Form appears with correct title/description
4. Test all fields display correctly
5. Click "More options" to expand secondary fields
6. Fill in required fields (name, email)
7. Click "Create Contact" → Should submit once
8. Repeat for Opportunity form

---

## 6. Known Issues Fixed

✅ **Fixed:** Duplicate form rendering causing multiple event handlers
✅ **Fixed:** Cancel button firing 3+ times per click
✅ **Fixed:** Missing cursor-pointer styles on buttons
✅ **Fixed:** Forms rendering both inline and via state-driven cards

---

## Sign-off Checklist

- [ ] All form titles display correctly
- [ ] All field labels match schema definitions
- [ ] All field descriptions/placeholders are user-friendly
- [ ] Required field asterisks (*) show correctly
- [ ] Both buttons work with single click (no duplicates)
- [ ] Validation errors show correctly
- [ ] Forms submit successfully with valid data
- [ ] Console logs show single execution (no duplicate handlers)
- [ ] Tested in production environment
- [ ] No console errors
