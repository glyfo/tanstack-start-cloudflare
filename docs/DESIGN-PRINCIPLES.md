# CRM UI Design Principles

## Core Philosophy: Zero Context Switching

All user interactions should happen inline in the chat interface. Users should never need to navigate away to complete a task.

---

## Mandatory Rules for New Features

When implementing any new functionality, these rules MUST be followed:

### 1. No Navigation
- Everything happens inline in the chat
- Never redirect users to separate pages or modals for data entry
- Forms, confirmations, and results all appear as chat cards
- The chat is the single source of truth for all interactions

### 2. Pre-filled Data
- Any information mentioned by the user is pre-populated in forms
- Parse user intent: "create contact for John at Acme" → name="John", company="Acme"
- Smart defaults based on context (e.g., stage defaults, today's date)
- Remember previous entries when relevant

### 3. Real-time Validation
- Errors shown immediately as user types (not just on submit)
- Clear error messages with icons next to invalid fields
- Visual distinction: red borders, red background for errors
- Required field indicators (*) always visible

### 4. Visual Feedback
- Animated thinking indicator with blinking dots
- Phase-specific colors and icons:
  - Analyzing: Sky blue with search icon
  - Calling tool: Amber with gear icon
  - Creating: Purple with plus icon
  - Formatting: Emerald with document icon
- Status messages describing current action
- Smooth transitions between states

### 5. Consistent Design
- Follow the established color scheme:
  - Background: `#F5F5F0` (warm off-white)
  - Primary actions: Sky blue (`sky-500`)
  - Success/Money: Emerald (`emerald-500`)
  - Text: Stone palette (`stone-700`, `stone-900`)
- Gradient headers for form cards
- Rounded corners (`rounded-lg`, `rounded-xl`)
- Subtle shadows (`shadow-sm`)
- Consistent spacing (`p-4`, `gap-3`, `mb-3`)

### 6. Collapsible Optional Fields
- Required fields always visible
- Optional fields hidden by default under "Add more details"
- Click to expand/collapse
- Chevron icon indicates expandable section
- Keep interface clean while allowing power users full control

---

## Card Types Reference

### Form Cards (User Input)
```
create-contact-form    - Contact creation form
create-opportunity-form - Opportunity creation form
```

### Display Cards (Show Data)
```
contact      - Display contact record
opportunity  - Display opportunity/deal
action       - System messages, confirmations
success      - Success confirmation with details
notification - Inline status notification
```

### Lead Cards (External Sources)
```
tiktok-lead           - TikTok lead data
facebook-lead         - Facebook lead data
instagram-lead        - Instagram lead data
whatsapp-conversation - WhatsApp thread
```

---

## Form Card Structure

Every form card should follow this structure:

```
┌─────────────────────────────────────────────┐
│ [Gradient Header with Icon]                 │
│ Title + Subtitle                            │
├─────────────────────────────────────────────┤
│ Required Fields                             │
│ • Field with label, icon, validation        │
│ • Field with label, icon, validation        │
│                                             │
│ ▼ Add more details (collapsible)            │
│ ┌─────────────────────────────────────────┐ │
│ │ Optional Fields                         │ │
│ │ • Additional field                      │ │
│ │ • Tags with add/remove                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Primary Action Button]  [Cancel]           │
│                                             │
│ * Required fields indicator                 │
└─────────────────────────────────────────────┘
```

---

## Thinking Indicator States

| Phase | Color | Icon | Example Label |
|-------|-------|------|---------------|
| analyzing | Sky blue | Search | "Analyzing your request" |
| calling-tool | Amber | Gear | "Creating contact" |
| searching | Indigo | Search zoom | "Searching database" |
| creating | Purple | Plus | "Creating record" |
| formatting | Emerald | Document | "Preparing response" |
| thinking | Stone | Lightbulb | "Thinking" |

---

## Implementation Checklist

When adding a new feature, verify:

- [ ] Form appears inline in chat (no navigation)
- [ ] User-provided data is pre-filled
- [ ] Required fields have `*` indicator
- [ ] Validation happens on change AND submit
- [ ] Error messages are clear and positioned near field
- [ ] Optional fields are collapsible
- [ ] Loading state shows animated indicator
- [ ] Success confirmation uses SuccessCard
- [ ] Colors match design system
- [ ] Keyboard navigation works (Enter to submit, Tab between fields)

---

## Example: Adding a New Entity Type

To add support for a new entity (e.g., "Task"):

1. **Create Form Card**: `CreateTaskCard.tsx`
   - Gradient header (choose appropriate color)
   - Required fields visible
   - Optional fields collapsible
   - Validation and error states

2. **Update ChatEngine**:
   - Import the new component
   - Add to card regex pattern
   - Add card type handler in MessageContent
   - Add form submission handler

3. **Update Agent**:
   - Add form card format to system prompt
   - Update intent detection rules
   - Add tool execution if needed

4. **Create Display Card**: `TaskCard.tsx` (if needed)
   - For showing created/found tasks

5. **Test the flow**:
   - "create a task" → shows form
   - Fill form → shows thinking indicator
   - Submit → shows success card
