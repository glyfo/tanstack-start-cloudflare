# Admin UI Guide - Channel Management & 360° Customer View

## Overview

The admin UI provides comprehensive tools for managing all 7 communication channels and viewing unified customer profiles across channels. This enables true 360° customer visibility and cross-channel conversation management.

---

## UI Components

### 1. **Channel Dashboard** 📊

**Location:** `/admin/channels`

**Purpose:** Real-time overview of all communication channels

**Features:**
- **Channel Health Monitoring**
  - Status indicators: Healthy, Degraded, Down, Unconfigured
  - Real-time uptime percentage
  - Response time metrics
  - Error count and last error messages

- **Message Volume Stats**
  - Inbound message count per channel
  - Outbound message count per channel
  - Total messages across all channels
  - Message rate trends

- **Active Sessions**
  - Current active conversations per channel
  - Total sessions (all-time)
  - Session distribution chart

- **Channel Cards**
  - Click any channel card for detailed view
  - Shows: WebSocket, WhatsApp, SMS, Slack, Discord, Telegram, Email
  - Color-coded status badges
  - Quick actions: View Details, Configure, Disable

**Visual Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Channel Dashboard                    [Summary Stats]  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │WebSocket│  │WhatsApp │  │   SMS   │  │  Slack  │  │
│  │ ✓ Healthy│  │ ✓ Healthy│  │ ⚠ Degraded│ │ ✓ Healthy│  │
│  │ 245 ↓↑  │  │ 1,203 ↓↑│  │  89 ↓↑  │  │ 156 ↓↑  │  │
│  │ 12 sessions│ │ 45 sessions│ │ 8 sessions│ │ 23 sessions││
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │ Discord │  │Telegram │  │  Email  │               │
│  │ ✓ Healthy│  │ ✗ Down  │  │ ✓ Healthy│               │
│  │ 345 ↓↑  │  │  0 ↓↑   │  │ 678 ↓↑  │               │
│  │ 34 sessions│ │ 0 sessions│ │ 56 sessions││              │
│  └─────────┘  └─────────┘  └─────────┘               │
└────────────────────────────────────────────────────────┘
```

---

### 2. **Customer Profile View** 👤

**Location:** `/admin/customers/:customerId`

**Purpose:** 360° view of a single customer across all channels

**Features:**

#### **Header Section**
- Customer avatar (generated from initials)
- Display name
- Primary email & phone
- Tags (VIP, Technical Support, etc.)
- Quick stats: # Channels, Total Messages, Days as Customer

#### **Tabs:**

##### **Overview Tab**
- **Channel Activity Chart**
  - Progress bars showing message distribution per channel
  - WhatsApp: 50 messages (45%)
  - Email: 30 messages (27%)
  - SMS: 15 messages (14%)
  - Slack: 15 messages (14%)

- **Custom Fields**
  - Account Type: Enterprise
  - Contract Value: $50,000/year
  - Support Tier: Premium
  - Account Manager: John Doe

- **Timeline Stats**
  - First Contact: Jan 5, 2026
  - Last Activity: 2 hours ago
  - Total Interactions: 110 messages

##### **Activity Timeline Tab**
- Shows `UnifiedActivityTimeline` component (see below)
- Chronological messages from ALL channels
- Filterable by channel, date range, search
- Color-coded by channel

##### **Channel Identities Tab**
- Lists all linked identities:
  ```
  ✓ WhatsApp: +1-234-567-8900 [Primary] [Verified]
    50 messages • Last seen 2h ago

  ✓ Email: john@example.com [Primary]
    30 messages • Last seen 5h ago

  ✓ SMS: +1-234-567-8900 [Verified]
    15 messages • Last seen 1d ago

  ✓ Slack: @john
    15 messages • Last seen 3d ago
  ```

- **Actions:**
  - Link new identity
  - Unlink identity
  - Mark as verified
  - Set as primary

**Visual Layout:**
```
┌────────────────────────────────────────────────────────┐
│  [Avatar] John Doe                    [Quick Stats]    │
│  john@example.com  |  +1-234-567-8900                  │
│  [VIP] [Enterprise] [Technical Support]                │
│  ────────────────────────────────────────────────────  │
│  [Overview] [Activity Timeline] [Channel Identities]   │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  Channel Activity:                                     │
│  WhatsApp  ██████████████████░░░░░░ 50 msgs (45%)    │
│  Email     ███████████░░░░░░░░░░░░░ 30 msgs (27%)    │
│  SMS       ███████░░░░░░░░░░░░░░░░░ 15 msgs (14%)    │
│  Slack     ███████░░░░░░░░░░░░░░░░░ 15 msgs (14%)    │
│                                                         │
│  Custom Fields:                                        │
│  Account Type: Enterprise                              │
│  Contract Value: $50,000/year                          │
└────────────────────────────────────────────────────────┘
```

---

### 3. **Unified Activity Timeline** 📅

**Location:** Embedded in Customer Profile View or `/admin/timeline/:customerId`

**Purpose:** Chronological view of ALL conversations across channels

**Features:**

#### **Filters**
- **Search:** Full-text search across all messages
- **Channel Filter:** Show only specific channel (WhatsApp, Email, etc.)
- **Date Range:** Last 7d, 30d, 90d, All time
- **Message Count:** Shows filtered result count

#### **Timeline Display**
- **Date Grouping:** Messages grouped by date
- **Channel Icons:** Color-coded icons per channel
- **Role Indicators:** Customer (blue) vs Assistant (purple)
- **Metadata Tags:** Sentiment, Intent, Priority
- **Thread Lines:** Visual lines connecting related messages

**Visual Layout:**
```
┌────────────────────────────────────────────────────────┐
│  [Search...] [Channel: All ▾] [Date: Last 30d ▾]      │
│  Showing 47 messages                                   │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  ─────────── February 15, 2026 ──────────────          │
│                                                         │
│  ● WhatsApp │ 2:30 PM │ Customer                       │
│  │ "Still having issues with the export feature!"      │
│  │ [Negative Sentiment] [Support Intent]               │
│  │                                                      │
│  ● Email    │ 10:15 AM │ Customer                       │
│  │ "Export feature is broken, can't download data"     │
│  │ [Support Intent] [High Priority]                    │
│  │                                                      │
│  ● Email    │ 10:20 AM │ Assistant                      │
│  │ "Thanks for reporting! Our team is investigating."  │
│  │                                                      │
│  ─────────── February 14, 2026 ──────────────          │
│                                                         │
│  ● Slack    │ 4:00 PM │ Customer                        │
│  │ "Thanks for the quick help yesterday!"              │
│  │ [Positive Sentiment]                                │
└────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- ✅ See context from previous channels
- ✅ Identify escalation patterns (Email → WhatsApp → SMS)
- ✅ Track sentiment changes over time
- ✅ No more asking customers to repeat themselves

---

### 4. **Pairing Requests Panel** 🔐

**Location:** `/admin/pairing-requests`

**Purpose:** Approve/reject access requests from unknown senders

**Features:**

#### **Request List**
- Shows pending pairing requests from:
  - WhatsApp unknown numbers
  - Telegram unknown users
  - Discord unknown DMs
  - Email unknown senders (if policy = pairing)

#### **Request Details**
- **Sender Info:** Phone, username, email
- **Channel:** Which channel they contacted from
- **First Message:** What they said
- **Timestamp:** When they requested
- **Expiry:** Auto-reject after 7 days

#### **Actions**
- **Approve:** Grant access, future messages allowed
- **Reject:** Deny access, messages blocked
- **Bulk Actions:** Approve/reject multiple

**Visual Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Pairing Requests           [Pending (3)] [All]        │
│  Approve or reject access from unknown senders         │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ +1-555-0123 [WHATSAPP]                           │ │
│  │ Requested 2 hours ago • Expires in 6d 22h         │ │
│  │                                                   │ │
│  │ First message:                                    │ │
│  │ "Hi! I'm interested in your enterprise plan"     │ │
│  │                                                   │ │
│  │           [✓ Approve]     [✗ Reject]            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ @unknown_user [TELEGRAM]                          │ │
│  │ Requested 1 day ago • Expires in 6d                │ │
│  │                                                   │ │
│  │ First message:                                    │ │
│  │ "Need help with my account"                       │ │
│  │                                                   │ │
│  │           [✓ Approve]     [✗ Reject]            │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## User Workflows

### Workflow 1: Monitor Channel Health

1. Navigate to `/admin/channels`
2. View dashboard showing all 7 channels
3. Identify degraded/down channels (yellow/red indicators)
4. Click channel card for detailed diagnostics
5. View error logs, response times, last successful message
6. Take action: Restart, reconfigure, or contact support

### Workflow 2: Review Customer 360° Profile

1. Search for customer by name, email, or phone
2. Navigate to `/admin/customers/:customerId`
3. **Overview Tab:** See channel distribution and custom fields
4. **Activity Timeline Tab:** Review all cross-channel conversations
5. **Identities Tab:** Verify linked identities, mark as primary
6. Identify patterns:
   - Customer prefers WhatsApp (70% of messages)
   - Last email was 5 days ago about export issue
   - Followed up via WhatsApp today
   - No SMS activity (can remove SMS from preferences)

### Workflow 3: Validate Cross-Channel Conversations

**Scenario:** Customer says "I already told you this!"

1. Open customer profile
2. Switch to Activity Timeline tab
3. Filter: Last 7 days, All channels
4. Search: "export issue"
5. **Find context:**
   - Feb 14 (Email): Customer reported export issue
   - Feb 14 (Email): Agent said "We're investigating"
   - Feb 15 (WhatsApp): Customer follows up "Still not working!"
6. **AI sees full context** - responds:
   "I see you emailed yesterday about the export issue. Our team is still investigating. ETA 2 hours."

### Workflow 4: Approve Pairing Requests

1. Navigate to `/admin/pairing-requests`
2. Review pending requests (3 new)
3. For each request:
   - Read first message
   - Check sender info
   - Decide: Legitimate or spam?
4. **Approve:** Customer can now chat freely
5. **Reject:** Messages blocked, sender notified (optional)

### Workflow 5: Identify Channel Preferences

1. Open customer profile
2. View Channel Activity chart:
   - WhatsApp: 120 messages (60%)
   - Email: 40 messages (20%)
   - SMS: 20 messages (10%)
   - Slack: 20 messages (10%)
3. **Insight:** Customer heavily prefers WhatsApp
4. **Action:** Set WhatsApp as primary contact method
5. **Result:** Future proactive messages sent via WhatsApp

---

## API Endpoints (for UI)

### Channel Stats
```typescript
GET /api/channel-stats
→ { channels: ChannelStats[] }

GET /api/channel-health
→ { health: ChannelHealth[] }
```

### Customer Profile
```typescript
GET /api/customer-identity/customer?customerId=xxx
→ CustomerProfile

GET /api/customer-identity/messages?customerId=xxx&limit=100
→ { messages: UnifiedMessage[] }

GET /api/customer-identity/search?q=john&orgId=xxx
→ CustomerProfile[]
```

### Pairing Requests
```typescript
GET /api/pairing-requests?status=pending
→ { requests: PairingRequest[] }

POST /api/pairing-requests/approve
{ requestId, reviewedBy }
→ { success: true }

POST /api/pairing-requests/reject
{ requestId, reviewedBy }
→ { success: true }
```

### Identity Linking
```typescript
POST /api/customer-identity/link
{ customerId, channelType, identifier }
→ { success: true }

POST /api/customer-identity/merge
{ fromCustomerId, toCustomerId }
→ { success: true }
```

---

## Design System

All admin UI components use the existing design system:

### Colors
- **Primary:** `sky-500` (links, buttons, active states)
- **Success:** `emerald-500` (approved, healthy, positive)
- **Warning:** `amber-500` (degraded, expiring, pending)
- **Danger:** `red-500` (down, rejected, errors)
- **Neutral:** `stone-50/100/200/400/500/700/900` (backgrounds, text)

### Channel Colors
- **WebSocket:** `sky-500` (blue)
- **WhatsApp:** `emerald-500` (green)
- **SMS:** `purple-500` (purple)
- **Slack:** `violet-500` (violet)
- **Discord:** `indigo-500` (indigo)
- **Telegram:** `blue-500` (blue)
- **Email:** `amber-500` (amber)

### Typography
- **Headings:** `font-bold text-stone-900`
- **Body:** `text-sm text-stone-700`
- **Labels:** `text-xs text-stone-500`
- **Mono:** `font-mono` (IDs, timestamps)

---

## Summary

The admin UI provides **4 main components** for complete channel and customer management:

1. **ChannelDashboard** - Monitor all 7 channels in real-time
2. **CustomerProfileView** - 360° customer view with all identities
3. **UnifiedActivityTimeline** - Chronological cross-channel conversations
4. **PairingRequestsPanel** - Approve/reject unknown senders

**Key Benefits:**
- ✅ **No context loss** - See all customer interactions across channels
- ✅ **Proactive monitoring** - Identify channel health issues immediately
- ✅ **Security control** - Approve/reject access requests
- ✅ **Customer insights** - Identify channel preferences and communication patterns
- ✅ **Unified view** - One place to see everything about a customer

**Next Steps:**
1. Connect UI to backend APIs (currently using mock data)
2. Add real-time updates via WebSocket
3. Add export functionality (CSV, PDF reports)
4. Add analytics dashboard (charts, trends, insights)
