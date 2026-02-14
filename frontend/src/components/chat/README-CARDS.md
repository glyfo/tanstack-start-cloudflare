# Chat UI Cards Documentation

This document explains how to use structured data cards in the chat interface to improve user experience.

> **Important**: See `/docs/DESIGN-PRINCIPLES.md` for mandatory implementation rules.

## Core Design Principles

All card implementations MUST follow these rules:

1. **No Navigation** - Everything happens inline in the chat
2. **Pre-filled Data** - Any info mentioned is pre-populated
3. **Real-time Validation** - Errors shown before submission
4. **Visual Feedback** - Animated thinking indicator with status
5. **Consistent Design** - Matches ui-examples color scheme
6. **Collapsible Optional Fields** - Clean interface, advanced options available

## Overview

The chat interface supports rendering structured data as interactive cards instead of plain text. This makes it easier for users to review and interact with contacts, opportunities, action items, and leads from multiple channels (TikTok, Facebook, Instagram, WhatsApp).

## Available Card Types

### 1. ContactCard

Display contact information in a clean, organized card format.

**Usage in Agent Response:**

```json:contact
{
  "action": "create",
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Corp",
  "phone": "+1 (555) 123-4567",
  "status": "active",
  "source": "LinkedIn",
  "tags": ["VIP", "Enterprise"]
}
```

**Fields:**
- `action` (optional): "create", "update", or "view"
- `name` (required): Contact's full name
- `email` (required): Contact's email
- `company` (optional): Company name
- `phone` (optional): Phone number
- `status` (optional): Contact status
- `source` (optional): Where the contact came from
- `tags` (optional): Array of tag strings

### 2. OpportunityCard

Display opportunity/deal information with value, stage, and probability.

**Usage in Agent Response:**

```json:opportunity
{
  "action": "create",
  "title": "Enterprise Software Deal",
  "contactName": "John Doe",
  "company": "Acme Corp",
  "value": 50000,
  "stage": "proposal",
  "probability": 75,
  "expectedCloseDate": "2026-03-15",
  "description": "Implementation of our enterprise software solution",
  "source": "Referral",
  "tags": ["Enterprise", "Q1-2026"]
}
```

**Fields:**
- `action` (optional): "create", "update", or "view"
- `title` (required): Opportunity title
- `contactName` (optional): Associated contact
- `company` (optional): Company name
- `value` (optional): Deal value in dollars
- `stage` (optional): "lead", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"
- `probability` (optional): Win probability (0-100)
- `expectedCloseDate` (optional): Expected close date string
- `description` (optional): Deal description
- `source` (optional): Lead source
- `tags` (optional): Array of tag strings

### 3. ActionCard

Display information messages or confirmation requests.

**Usage in Agent Response:**

```json:action
{
  "title": "Contact Created Successfully",
  "description": "The contact has been added to your CRM",
  "actionType": "success",
  "content": "You can now view this contact in your contacts list or create an opportunity."
}
```

**Fields:**
- `title` (required): Card title
- `description` (optional): Short description
- `actionType` (optional): "info", "confirm", "warning", "success"
- `content` (optional): Additional content to display

## Example Agent Responses

### Creating a Contact

```markdown
I'll create a new contact for you. Here's what I'm adding:

```json:contact
{
  "action": "create",
  "name": "Jane Smith",
  "email": "jane.smith@techcorp.com",
  "company": "TechCorp Inc",
  "phone": "+1 (555) 987-6543",
  "source": "Website Form",
  "tags": ["Marketing", "Lead"]
}
```

Would you like me to proceed with creating this contact?
```

### Displaying an Opportunity

```markdown
I found the opportunity you were looking for:

```json:opportunity
{
  "action": "view",
  "title": "Q1 Enterprise Deal",
  "contactName": "Jane Smith",
  "company": "TechCorp Inc",
  "value": 125000,
  "stage": "negotiation",
  "probability": 80,
  "expectedCloseDate": "2026-02-28",
  "description": "Full platform implementation with custom integrations"
}
```

The deal is currently in the negotiation stage with 80% probability of closing.
```

### Success Confirmation

```markdown
```json:action
{
  "title": "✓ Contact Created Successfully",
  "description": "Jane Smith has been added to your CRM",
  "actionType": "success"
}
```

What would you like to do next?
```

## Implementation Notes

1. **Card Format**: Cards must be wrapped in triple backticks with the format `json:cardType`
2. **Mixed Content**: You can mix regular markdown text with card blocks
3. **Multiple Cards**: You can include multiple cards in a single response
4. **Fallback**: If JSON parsing fails, the content will render as regular markdown

### 4. TikTok Lead Card

Display lead information captured from TikTok Lead Generation ads.

**Usage in Agent Response:**

```json:tiktok-lead
{
  "leadId": "tiktok_123456",
  "eventId": "evt_789",
  "formName": "Summer Campaign Form",
  "formId": "form_456",
  "campaignName": "Summer Sale 2026",
  "campaignId": "camp_123",
  "adId": "ad_789",
  "creativeId": "creative_456",
  "pageId": "page_123",
  "eventTime": 1706227200,
  "userDetails": {
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "+1 (555) 234-5678",
    "company": "Tech Startup Inc"
  },
  "qualificationScore": 85,
  "classification": "hot"
}
```

### 5. Facebook Lead Card

Display lead information captured from Facebook Lead Generation ads.

**Usage in Agent Response:**

```json:facebook-lead
{
  "leadId": "fb_123456",
  "leadgenId": "leadgen_789",
  "formName": "Newsletter Signup",
  "formId": "form_456",
  "campaignName": "Q1 Campaign",
  "campaignId": "camp_123",
  "adId": "ad_789",
  "pageId": "page_123",
  "createdTime": "2026-01-20T10:00:00Z",
  "userDetails": {
    "name": "Mike Chen",
    "email": "mike@example.com",
    "phone": "+1 (555) 345-6789",
    "city": "San Francisco",
    "state": "CA"
  },
  "qualificationScore": 70,
  "classification": "warm"
}
```

### 6. Instagram Lead Card

Display lead information captured from Instagram Lead Generation ads.

**Usage in Agent Response:**

```json:instagram-lead
{
  "leadId": "ig_123456",
  "leadgenId": "leadgen_789",
  "formName": "Product Interest Form",
  "formId": "form_456",
  "campaignName": "Spring Launch",
  "campaignId": "camp_123",
  "adId": "ad_789",
  "pageId": "page_123",
  "createdTime": "2026-01-20T10:00:00Z",
  "userDetails": {
    "name": "Emma Wilson",
    "email": "emma@example.com",
    "phone": "+1 (555) 456-7890",
    "company": "Design Studio"
  },
  "qualificationScore": 90,
  "classification": "hot"
}
```

### 7. WhatsApp Conversation Card

Display WhatsApp conversation with message history and 24-hour window status.

**Usage in Agent Response:**

```json:whatsapp-conversation
{
  "waId": "1234567890",
  "contactName": "John Smith",
  "phoneNumber": "+1 (555) 123-4567",
  "messageCount": 5,
  "lastInboundMessageTime": 1706227200000,
  "withinWindow": true,
  "messages": [
    {
      "id": "msg_1",
      "messageId": "wamid_123",
      "direction": "inbound",
      "type": "text",
      "content": "Hi, I'm interested in your product",
      "status": "delivered",
      "timestamp": 1706227200000
    },
    {
      "id": "msg_2",
      "messageId": "wamid_124",
      "direction": "outbound",
      "type": "text",
      "content": "Thank you for your interest! How can I help you?",
      "status": "read",
      "timestamp": 1706227260000
    }
  ]
}
```

## Lead Card Classification Colors

All lead cards (TikTok, Facebook, Instagram) use a consistent classification system:

- **Hot**: `bg-red-100 text-red-700 border-red-200` - High priority, ready to convert
- **Warm**: `bg-orange-100 text-orange-700 border-orange-200` - Interested, needs nurturing
- **Cold**: `bg-blue-100 text-blue-700 border-blue-200` - Low engagement, long-term follow-up
- **Unqualified**: `bg-gray-100 text-stone-600 border-gray-200` - Does not meet criteria

## Interactive Form Cards (Zero Context Switching)

These cards allow users to fill in data directly in the chat without navigating away.

### 8. Create Contact Form

Shows an inline form for creating a contact. Pre-fill any known data.

**Usage in Agent Response:**

```json:create-contact-form
{
  "name": "John",
  "email": "",
  "company": "Acme Corp",
  "phone": "",
  "source": ""
}
```

**Fields:**
- `name`: Pre-filled contact name
- `email`: Pre-filled email (required for submission)
- `company`: Pre-filled company name
- `phone`: Pre-filled phone number
- `source`: Pre-filled lead source
- `tags`: Array of pre-filled tags

### 9. Create Opportunity Form

Shows an inline form for creating an opportunity. Pre-fill any known data.

**Usage in Agent Response:**

```json:create-opportunity-form
{
  "title": "",
  "contactName": "John Smith",
  "company": "Acme Corp",
  "dealValue": 50000,
  "stage": "lead"
}
```

**Fields:**
- `title`: Opportunity title (required for submission)
- `contactName`: Associated contact name
- `company`: Company name
- `dealValue`: Deal value in dollars
- `stage`: Pipeline stage (lead, qualified, proposal, negotiation, closed-won, closed-lost)
- `probability`: Win probability (auto-calculated from stage)
- `expectedCloseDate`: Expected close date
- `description`: Deal description
- `source`: Lead source
- `tags`: Array of tags

### 10. Success Card

Shows a confirmation after successful operations.

**Usage in Agent Response:**

```json:success
{
  "type": "contact",
  "action": "created",
  "title": "John Smith",
  "subtitle": "Contact added to your CRM",
  "details": [
    {"label": "Email", "value": "john@example.com"},
    {"label": "Company", "value": "Acme Corp"}
  ]
}
```

**Fields:**
- `type`: "contact", "opportunity", or "lead"
- `action`: "created", "updated", or "deleted"
- `title`: Main title (usually the record name)
- `subtitle`: Optional description
- `details`: Array of {label, value} pairs to display

### 11. Notification

Inline notification for quick status messages.

**Usage in Agent Response:**

```json:notification
{
  "message": "Contact saved successfully",
  "type": "success"
}
```

**Fields:**
- `message`: The notification message
- `type`: "success", "info", or "warning"

## Best Practices

1. **Use Form Cards for Create Requests**: When user wants to create something, show a form card
2. **Pre-fill Known Data**: Extract any mentioned info and pre-populate the form
3. **Use Success Cards for Confirmations**: After creating/updating, show a success card
4. **Keep Text Minimal**: Let the card speak for itself, add context before/after
5. **Action Types**: Use appropriate action types (create/update/view) to show intent
6. **Unified Lead Management**: Use consistent card types across all channels for better UX
7. **Classification Consistency**: Always use the same classification system across all lead sources
8. **Never Ask One Question at a Time**: If you need info, show a form card instead
