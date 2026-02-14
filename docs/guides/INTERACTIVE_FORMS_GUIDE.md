# Interactive Forms Guide

## Overview

The CRM now supports **fully interactive forms and detail views** directly in the chat interface. Users can create, edit, and view contacts and opportunities without leaving the conversation or opening new tabs.

## Key Benefits

✅ **No context switching** - Everything happens in the chat
✅ **Clear validation** - Real-time feedback on required fields
✅ **Progressive disclosure** - Show required fields first, optional on demand
✅ **Smart defaults** - Pre-fill data from conversation context
✅ **Mobile-friendly** - Works perfectly on small screens

## Components

### 1. ContactFormCard

Interactive form for creating/editing contacts with validation and smart features.

**Features:**
- Required fields: Name *, Email *
- Optional fields (expandable): Phone, Source, Tags
- Real-time validation with error messages
- Tag management (add/remove)
- Loading states during submission
- Keyboard shortcuts (Enter to submit)

**Usage:**

```typescript
import { ContactFormCard } from './components/chat/ContactFormCard';

<ContactFormCard
  initialData={{ name: "John", company: "Acme" }}
  onSubmit={(data) => {
    // Handle form submission
    console.log('Contact data:', data);
  }}
  onCancel={() => {
    // Handle cancellation
  }}
  isSubmitting={false}
  title="Create New Contact"
/>
```

### 2. OpportunityFormCard

Interactive form for creating/editing opportunities with stage-based probability.

**Features:**
- Required field: Title *
- Key fields: Contact, Company, Value, Stage, Probability
- Auto-set probability based on stage selection
- Optional fields (expandable): Close Date, Description, Source, Tags
- Number validation for value and probability
- Tag management

**Usage:**

```typescript
import { OpportunityFormCard } from './components/chat/OpportunityFormCard';

<OpportunityFormCard
  initialData={{
    title: "Big Deal",
    contactName: "John Smith",
    company: "Acme Corp"
  }}
  onSubmit={(data) => {
    console.log('Opportunity data:', data);
  }}
  onCancel={() => {}}
  isSubmitting={false}
/>
```

### 3. ContactDetailView

Expandable full-detail view with tabs for Overview, Activity, and Opportunities.

**Features:**
- Three tabs: Overview, Activity, Opportunities
- Back to chat navigation
- Edit button to switch to form mode
- Quick actions: Send Email, Create Deal
- Activity timeline
- Related opportunities list
- No new tab required!

**Usage:**

```typescript
import { ContactDetailView } from './components/chat/ContactDetailView';

<ContactDetailView
  contact={{
    id: "123",
    name: "John Smith",
    email: "john@acme.com",
    company: "Acme Corp",
    tags: ["VIP", "Enterprise"]
  }}
  activities={[
    {
      id: "1",
      type: "email",
      description: "Sent proposal",
      date: "2 days ago"
    }
  ]}
  opportunities={[
    {
      id: "1",
      title: "Enterprise Deal",
      value: 50000,
      stage: "Proposal"
    }
  ]}
  onClose={() => {}}
  onEdit={() => {}}
  onCreateOpportunity={() => {}}
  onSendMessage={() => {}}
/>
```

## User Flows

### Flow 1: Quick Contact Creation

```
User: "Create a contact for John Smith at Acme Corp"

Agent: Shows ContactFormCard with pre-filled data:
┌─────────────────────────────────┐
│ ✨ Create New Contact           │
│                                 │
│ Name * [John Smith_______]      │
│ Email * [____________] ⚠️       │
│ Company [Acme Corp_______]      │
│                                 │
│ ⊕ Add more details              │
│                                 │
│ [Cancel]  [Create Contact]      │
└─────────────────────────────────┘

User: [types email]
User: [clicks Create Contact]

Agent: "✓ Contact created successfully!"
```

### Flow 2: View Contact Details

```
User: "Show me details for John Smith"

Agent: Shows ContactDetailView:
┌─────────────────────────────────┐
│ ← Back to chat         [✏️ Edit] │
│                                 │
│ 👤 John Smith                   │
│    Acme Corp                    │
│    🏷️ VIP  Enterprise            │
│                                 │
│ [Overview] Activity  Deals      │
│                                 │
│ 📧 john@acme.com                │
│ 📱 +1 555-1234                  │
│                                 │
│ [Send Email]  [New Deal]        │
└─────────────────────────────────┘

User: [clicks "Activity" tab]
Shows: Recent emails, calls, meetings

User: [clicks "Deals" tab]
Shows: Related opportunities with values

User: [clicks "Back to chat"]
Returns to conversation
```

### Flow 3: Create Opportunity from Contact

```
User: [viewing contact details]
User: [clicks "New Deal"]

Agent: Shows OpportunityFormCard with contact pre-filled:
┌─────────────────────────────────┐
│ 💰 Create New Opportunity       │
│                                 │
│ Title * [____________]          │
│ Contact [John Smith] (pre-fill) │
│ Company [Acme Corp] (pre-fill)  │
│                                 │
│ Value ($) [50000____]           │
│ Stage [▼ Proposal  ⌄]           │
│ Probability [50%____]           │
│                                 │
│ ⊕ Add more details              │
│                                 │
│ [Cancel]  [Create Opportunity]  │
└─────────────────────────────────┘
```

## Integration with ChatEngine

### Rendering Forms in Agent Responses

The agent can trigger forms by sending special message formats:

```markdown
I'll help you create that contact:

```json:contact-form
{
  "initialData": {
    "name": "John Smith",
    "company": "Acme Corp"
  },
  "action": "create"
}
```
```

The ChatEngine will detect this and render the ContactFormCard component automatically.

### Handling Form Submissions

When a user submits a form, send the data via WebSocket:

```typescript
const handleContactSubmit = (data) => {
  connection.send(JSON.stringify({
    type: 'form-submit',
    formType: 'contact',
    action: 'create',
    data: data
  }));
};
```

The agent receives the data and processes it on the server side.

## Validation Rules

### Contact Form
- **Name**: Required, non-empty string
- **Email**: Required, valid email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- **Phone**: Optional, any format accepted
- **Tags**: Unique values only

### Opportunity Form
- **Title**: Required, non-empty string
- **Value**: Optional, must be positive number
- **Probability**: Optional, must be 0-100
- **Stage**: Required, one of: lead, qualified, proposal, negotiation, closed-won, closed-lost
- **Date**: Optional, valid date format

## Best Practices

### 1. Pre-fill What You Know
```typescript
// Extract data from conversation context
const initialData = {
  name: extractedName,
  company: extractedCompany,
  email: extractedEmail
};

// Show form with pre-filled data
<ContactFormCard initialData={initialData} />
```

### 2. Progressive Disclosure
- Show required fields immediately
- Hide optional fields behind "Add more details"
- This reduces cognitive load and speeds up form completion

### 3. Real-time Validation
- Validate as user types
- Show errors immediately
- Clear errors when fixed
- Use clear, actionable error messages

### 4. Loading States
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (data) => {
  setIsSubmitting(true);
  try {
    await createContact(data);
    // Show success
  } catch (error) {
    // Show error
  } finally {
    setIsSubmitting(false);
  }
};
```

### 5. Smart Defaults
```typescript
// Auto-set probability based on stage
if (stage === 'proposal') {
  probability = 50;
} else if (stage === 'negotiation') {
  probability = 75;
}
```

## Keyboard Shortcuts

- **Enter**: Submit form (when in input field)
- **Escape**: Cancel form (future enhancement)
- **Tab**: Navigate between fields
- **Enter** in tags input: Add tag

## Mobile Considerations

- Forms stack vertically on small screens
- Touch-friendly button sizes (min 44px height)
- Large input fields for easy tapping
- Scrollable content with fixed header/footer
- Native date pickers on mobile devices

## Error Handling

### Display Errors Inline
```tsx
{errors.name && (
  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
    <WarningIcon />
    {errors.name}
  </p>
)}
```

### Common Error Messages
- "Name is required"
- "Invalid email format"
- "Value must be positive"
- "Probability must be between 0-100"

## Future Enhancements

1. **Auto-save drafts** - Save form data in localStorage
2. **Duplicate detection** - Warn if similar contact exists
3. **Field suggestions** - Auto-complete from existing data
4. **Bulk import** - Paste multiple contacts at once
5. **Templates** - Pre-defined form templates
6. **Rich text notes** - Markdown support for descriptions
7. **File attachments** - Add documents to contacts/opportunities
8. **Calendar integration** - Schedule meetings directly

## Summary

The interactive forms system transforms the CRM from a traditional "form page" approach to a modern "conversational UI" approach where everything happens in the chat. This reduces friction, speeds up workflows, and creates a more intuitive user experience.

**Key takeaway**: Users never need to leave the chat to create, view, or edit data. Everything is handled inline with smart forms and expandable detail views.
