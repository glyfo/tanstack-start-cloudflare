# Developer Quick Reference - Interactive CRM Cards

## 🎯 At a Glance

The CRM supports three modes:
1. **Display** - Show data in cards
2. **Form** - Interactive creation/editing
3. **Detail** - Full view with tabs

## 📦 Import Map

```typescript
// Display cards
import { ContactCard } from './components/chat/ContactCard';
import { OpportunityCard } from './components/chat/OpportunityCard';
import { ActionCard } from './components/chat/ActionCard';

// Interactive forms
import { ContactFormCard } from './components/chat/ContactFormCard';
import { OpportunityFormCard } from './components/chat/OpportunityFormCard';

// Detail views
import { ContactDetailView } from './components/chat/ContactDetailView';

// Lists
import { ContactList } from './components/chat/ContactList';
import { OpportunityList } from './components/chat/OpportunityList';
```

## 🔄 Quick Usage

### Display Contact
```tsx
<ContactCard
  contact={{
    name: "John Smith",
    email: "john@example.com",
    company: "Acme Corp"
  }}
  action="view"
/>
```

### Create Contact Form
```tsx
<ContactFormCard
  initialData={{ name: "John" }}
  onSubmit={(data) => createContact(data)}
  onCancel={() => closeForm()}
  isSubmitting={loading}
/>
```

### View Contact Details
```tsx
<ContactDetailView
  contact={contactData}
  activities={activityList}
  opportunities={oppList}
  onClose={() => backToChat()}
  onEdit={() => showEditForm()}
/>
```

### Display Opportunity
```tsx
<OpportunityCard
  opportunity={{
    title: "Big Deal",
    value: 50000,
    stage: "proposal"
  }}
  action="view"
/>
```

### Create Opportunity Form
```tsx
<OpportunityFormCard
  initialData={{
    contactName: "John Smith",
    company: "Acme Corp"
  }}
  onSubmit={(data) => createOpp(data)}
/>
```

### Show Action/Message
```tsx
<ActionCard
  title="Success!"
  description="Contact created"
  actionType="success"
/>
```

## 🎨 Component Props

### ContactFormCard
```typescript
{
  initialData?: {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    source?: string;
    tags?: string[];
  };
  onSubmit: (data) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  title?: string;
}
```

### OpportunityFormCard
```typescript
{
  initialData?: {
    title?: string;
    contactName?: string;
    company?: string;
    value?: number;
    stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation';
    probability?: number;
    description?: string;
  };
  onSubmit: (data) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}
```

### ContactDetailView
```typescript
{
  contact: {
    id: string;
    name: string;
    email: string;
    company?: string;
    // ... more fields
  };
  activities?: Array<{
    id: string;
    type: 'email' | 'call' | 'meeting' | 'note';
    description: string;
    date: string;
  }>;
  opportunities?: Array<{
    id: string;
    title: string;
    value: number;
    stage: string;
  }>;
  onClose?: () => void;
  onEdit?: () => void;
  onCreateOpportunity?: () => void;
  onSendMessage?: () => void;
}
```

## 🔤 Action Types

### For Cards
- `"create"` - Show as new item (green badge)
- `"update"` - Show as update (blue badge)
- `"view"` - Default display mode

### For ActionCard
- `"info"` - Blue, informational
- `"confirm"` - Purple, needs confirmation
- `"warning"` - Yellow, caution
- `"success"` - Green, success message

## ✅ Validation Rules

### Contact
- Name: Required, non-empty
- Email: Required, valid format

### Opportunity
- Title: Required, non-empty
- Value: Optional, must be ≥ 0
- Probability: Optional, must be 0-100

## 📝 Form Data Types

```typescript
// Contact Form Data
interface ContactFormData {
  name: string;        // required
  email: string;       // required
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

// Opportunity Form Data
interface OpportunityFormData {
  title: string;       // required
  contactName?: string;
  company?: string;
  value?: number;
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
  source?: string;
  tags?: string[];
}
```

## 🎯 Common Patterns

### Pattern: Show Form → Submit → Success
```typescript
const [showForm, setShowForm] = useState(false);
const [loading, setLoading] = useState(false);

// Show form
<ContactFormCard
  onSubmit={async (data) => {
    setLoading(true);
    await createContact(data);
    setLoading(false);
    setShowForm(false);
    // Show success
  }}
  isSubmitting={loading}
/>
```

### Pattern: View → Edit → Save
```typescript
const [mode, setMode] = useState<'view' | 'edit'>('view');

{mode === 'view' ? (
  <ContactDetailView
    contact={contact}
    onEdit={() => setMode('edit')}
  />
) : (
  <ContactFormCard
    initialData={contact}
    onSubmit={(data) => {
      updateContact(data);
      setMode('view');
    }}
  />
)}
```

### Pattern: Pre-fill from Context
```typescript
// Extract from conversation
const name = extractNameFromMessage(userMessage);
const company = extractCompanyFromMessage(userMessage);

// Show form with pre-filled data
<ContactFormCard
  initialData={{ name, company }}
  onSubmit={handleSubmit}
/>
```

## 🚀 Integration Examples

### With Agent Messages
```typescript
// Agent sends message with embedded form trigger
const message = `
I'll create that contact for you:

\`\`\`json:contact-form
${JSON.stringify({ initialData: { name: "John" } })}
\`\`\`
`;

// ChatEngine detects and renders ContactFormCard
```

### With WebSocket
```typescript
// Form submission
connection.send(JSON.stringify({
  type: 'form-submit',
  formType: 'contact',
  data: formData
}));

// Form result
connection.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'form-result') {
    if (message.success) {
      showSuccessMessage();
    } else {
      showErrorMessage(message.error);
    }
  }
};
```

## 🎨 Styling Notes

### Colors
- Primary: `sky-500` (blue) - Actions, links
- Success: `green-100/600/700` - Success messages
- Warning: `yellow-100/600` - Warnings
- Error: `red-50/300/600` - Errors
- Neutral: `gray-50/100/200/300` - Backgrounds, borders

### Spacing
- Card padding: `p-4` (16px)
- Section gap: `space-y-3` (12px)
- Button gap: `gap-2` (8px)

### Borders
- Card: `border border-gray-200 rounded-lg`
- Input: `border border-gray-300 rounded-lg`
- Error input: `border-red-300 bg-red-50`

## 🔧 Debug Tips

### Form not submitting?
- Check validation errors: `console.log(errors)`
- Check required fields are filled
- Check `onSubmit` is defined

### Card not rendering?
- Verify data structure matches props
- Check for missing required fields
- Look for console errors

### Styling issues?
- Check Tailwind classes are correct
- Verify parent container has space
- Check responsive classes

## 📱 Mobile Considerations

- All components are mobile-responsive
- Touch targets are 44px minimum
- Forms stack vertically on small screens
- Detail views scroll within container
- Use native date/time pickers on mobile

## ⚡ Performance Tips

1. **Lazy load detail views** - Only render when needed
2. **Memoize callbacks** - Use useCallback for handlers
3. **Debounce validation** - Don't validate every keystroke
4. **Virtual scroll** - For long lists
5. **Code split** - Load form components on demand

## 🆘 Need Help?

- **Design patterns**: See `INTERACTIVE_CARDS_DESIGN.md`
- **Full guide**: See `INTERACTIVE_FORMS_GUIDE.md`
- **Examples**: See `CARD_EXAMPLES.md`
- **Before/after**: See `UI_IMPROVEMENTS_SUMMARY.md`

---

## 📋 Checklist for Implementation

- [ ] Import required components
- [ ] Set up state for form data
- [ ] Add submit handler
- [ ] Add loading state
- [ ] Add error handling
- [ ] Test validation
- [ ] Test mobile view
- [ ] Add success message
- [ ] Handle cancellation
- [ ] Test with real data

---

**Quick Start:**
1. Import component
2. Pass data
3. Handle callbacks
4. Done!
