# Phone Call & SMS Integration Proposal

**Date**: 2026-01-20
**Status**: 📋 Proposal for Review
**Integration Target**: Voice Calls + SMS using Twilio on Cloudflare Workers

---

## Executive Summary

This proposal outlines the integration of **phone calls and SMS** into the existing unified lead management system, following the same architectural patterns established for TikTok, Facebook, Instagram, and WhatsApp integrations.

### Recommended Provider: **Twilio**

**Why Twilio:**
1. ✅ **Cloudflare Workers Compatible** - REST API works perfectly with fetch()
2. ✅ **Mature SMS & Voice APIs** - Industry standard for 15+ years
3. ✅ **Global Coverage** - 180+ countries for SMS, programmable voice worldwide
4. ✅ **Webhook-Based** - Matches existing architecture (similar to WhatsApp)
5. ✅ **Rich Features** - Call recording, transcription, IVR, SMS delivery tracking
6. ✅ **Scalable Pricing** - Pay-as-you-go, no minimum commitments
7. ✅ **Excellent Documentation** - Easy integration with comprehensive SDKs

**Alternative Considered**: Vonage (Nexmo)
- Similar capabilities but more complex API
- Twilio has better Cloudflare Workers compatibility

---

## Architecture Overview

### Consistency with Existing Patterns

The integration will follow the **exact same pattern** as WhatsApp:

```
┌─────────────────────────────────────────────────────────────┐
│                    Twilio Cloud                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ Voice Calls  │              │     SMS      │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │ Webhooks                    │ Webhooks            │
└─────────┼─────────────────────────────┼────────────────────┘
          │                             │
          ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│             Cloudflare Workers (Your App)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/server/webhooks/twilio.ts                       │  │
│  │  - handleTwilioVerification()                        │  │
│  │  - processTwilioSMS()                                │  │
│  │  - processTwilioVoiceEvent()                         │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Durable Objects (State Management)                  │  │
│  │  ┌──────────────────────┐  ┌────────────────────┐   │  │
│  │  │ SMSConversationDO    │  │  VoiceCallDO       │   │  │
│  │  │ - Message history    │  │  - Call metadata   │   │  │
│  │  │ - Thread tracking    │  │  - Recording URL   │   │  │
│  │  │ - Contact linking    │  │  - Transcription   │   │  │
│  │  └──────────────────────┘  └────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services                                             │  │
│  │  - src/server/services/twilio-api.ts                 │  │
│  │  - src/server/services/sms-parser.ts                 │  │
│  │  - src/server/services/call-analytics.ts             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                             │
          ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Chat UI (Frontend)                         │
│  ┌──────────────────────┐  ┌────────────────────┐          │
│  │  SMSConversationCard │  │   VoiceCallCard    │          │
│  │  - Thread view       │  │  - Call duration   │          │
│  │  - Send/receive      │  │  - Recording       │          │
│  │  - Delivery status   │  │  - Transcription   │          │
│  └──────────────────────┘  └────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Structure

### 1. Webhook Handler (`src/server/webhooks/twilio.ts`)

Following the WhatsApp pattern:

```typescript
/**
 * Twilio Webhook Handler
 *
 * Handles incoming SMS and Voice webhooks from Twilio
 * https://www.twilio.com/docs/usage/webhooks
 */

export interface TwilioSMSWebhook {
  MessageSid: string;
  SmsSid: string;
  AccountSid: string;
  From: string;  // E.164 format: +15551234567
  To: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus: 'received' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  MessageStatus: 'accepted' | 'queued' | 'sending' | 'sent' | 'receiving' | 'received' | 'delivered' | 'undelivered' | 'failed';
  ApiVersion: string;
}

export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  Duration?: string;  // Call duration in seconds
  RecordingUrl?: string;
  TranscriptionText?: string;
  CallerName?: string;
  ApiVersion: string;
}

// Verification using Twilio signature validation
export function handleTwilioVerification(
  request: Request,
  env: any
): boolean {
  // Validate X-Twilio-Signature header
  // https://www.twilio.com/docs/usage/security#validating-requests
}

// Process inbound SMS
export async function processTwilioSMS(
  webhook: TwilioSMSWebhook,
  env: any
): Promise<Response> {
  // Store in SMSConversationDO
  // Link to ContactDO
  // Trigger auto-response if configured
}

// Process voice call events
export async function processTwilioVoiceEvent(
  webhook: TwilioVoiceWebhook,
  env: any
): Promise<Response> {
  // Store in VoiceCallDO
  // Link to ContactDO
  // Process recording/transcription
}
```

### 2. Durable Objects

#### A. SMS Conversation DO (`src/server/durable-objects/SMSConversationDO.ts`)

**Pattern**: Identical to `WhatsAppConversationDO.ts`

```typescript
export class SMSConversationDO extends DurableObject {
  private sql: SqlStorage;

  // Schema:
  // - conversation table (phone_number, contact_name, message_count, last_message_time)
  // - messages table (id, sid, direction, body, media_urls, status, timestamp)
  // - delivery_receipts table (message_sid, status, error_code, timestamp)

  async addMessage(data: {
    messageSid: string;
    from: string;
    to: string;
    body: string;
    media?: Array<{ url: string; contentType: string }>;
    direction: 'inbound' | 'outbound';
    timestamp: number;
  }): Promise<void>

  async updateDeliveryStatus(
    messageSid: string,
    status: string,
    errorCode?: string
  ): Promise<void>

  async getConversationThread(
    phoneNumber: string,
    limit: number = 50
  ): Promise<SMSMessage[]>

  async getState(): Promise<SMSConversationState>
}
```

#### B. Voice Call DO (`src/server/durable-objects/VoiceCallDO.ts`)

**Pattern**: Similar to conversation tracking but for calls

```typescript
export class VoiceCallDO extends DurableObject {
  private sql: SqlStorage;

  // Schema:
  // - calls table (call_sid, from, to, direction, status, duration, recording_url, transcription, started_at, ended_at)
  // - call_events table (call_sid, event_type, timestamp, metadata)

  async recordCallStart(data: {
    callSid: string;
    from: string;
    to: string;
    direction: 'inbound' | 'outbound';
    startTime: number;
  }): Promise<void>

  async recordCallEnd(
    callSid: string,
    duration: number,
    status: string
  ): Promise<void>

  async addRecording(
    callSid: string,
    recordingUrl: string,
    duration: number
  ): Promise<void>

  async addTranscription(
    callSid: string,
    transcription: string
  ): Promise<void>

  async getCallHistory(
    phoneNumber: string,
    limit: number = 50
  ): Promise<VoiceCall[]>

  async getCallDetails(callSid: string): Promise<VoiceCallDetails>
}
```

### 3. API Service (`src/server/services/twilio-api.ts`)

**Pattern**: Same as `whatsapp-api.ts`

```typescript
/**
 * Twilio API Client
 *
 * Handles sending SMS and making calls via Twilio API
 */

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

// Send SMS
export async function sendSMS(
  accountSid: string,
  authToken: string,
  from: string,  // Twilio phone number
  to: string,
  body: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageSid?: string; error?: string }>

// Make outbound call
export async function makeCall(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  twimlUrl: string  // URL that returns TwiML instructions
): Promise<{ success: boolean; callSid?: string; error?: string }>

// Get call recording
export async function getCallRecording(
  accountSid: string,
  authToken: string,
  callSid: string
): Promise<{ success: boolean; recordingUrl?: string; error?: string }>

// Get call transcription
export async function getCallTranscription(
  accountSid: string,
  authToken: string,
  transcriptionSid: string
): Promise<{ success: boolean; text?: string; error?: string }>

// Send SMS with template (similar to WhatsApp templates)
export async function sendSMSTemplate(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  templateId: string,
  variables: Record<string, string>
): Promise<{ success: boolean; messageSid?: string; error?: string }>
```

### 4. UI Components

#### A. SMS Conversation Card (`src/components/chat/SMSConversationCard.tsx`)

**Pattern**: Clone of `WhatsAppConversationCard.tsx` with SMS-specific styling

```typescript
export interface SMSMessage {
  id: string;
  messageSid: string;
  direction: 'inbound' | 'outbound';
  body: string;
  media?: Array<{ url: string; contentType: string }>;
  status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  timestamp: number;
  errorCode?: string;
}

export interface SMSConversationData {
  phoneNumber: string;
  contactName?: string;
  messageCount: number;
  lastMessageTime: number;
  messages: SMSMessage[];
  fromNumber: string;  // Your Twilio number
}

export function SMSConversationCard({
  conversation,
  onSendMessage,
  onViewDetails,
}: SMSConversationCardProps) {
  // Layout: Same as WhatsApp card
  // Icon: SMS/Message icon with blue color
  // Features:
  // - Message thread view
  // - Send message input
  // - Delivery status indicators
  // - Media attachment support
  // - Error handling display
}
```

#### B. Voice Call Card (`src/components/chat/VoiceCallCard.tsx`)

**Pattern**: New card type for call history

```typescript
export interface VoiceCallData {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'no-answer' | 'busy' | 'failed';
  duration: number;  // seconds
  recordingUrl?: string;
  transcription?: string;
  startTime: number;
  endTime?: number;
  contactName?: string;
}

export function VoiceCallCard({
  call,
  onPlayRecording,
  onDownloadRecording,
  onViewTranscription,
  onCallBack,
}: VoiceCallCardProps) {
  // Features:
  // - Call direction indicator (inbound/outbound)
  // - Duration display (formatted: "5:32")
  // - Recording player (if available)
  // - Transcription viewer
  // - Quick call-back button
  // - Status badge (completed, missed, busy, failed)
  // - Timestamp
}
```

#### Card Design (Consistent with Existing)

```tsx
// SMS Card Icon - Blue message bubble
<div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
  <svg><!-- SMS icon --></svg>
</div>

// Voice Call Card Icon - Green phone
<div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
  <svg><!-- Phone icon --></svg>
</div>

// Status Colors (consistent with classification system)
- Completed: bg-green-100 text-green-700
- In Progress: bg-blue-100 text-blue-700
- Failed: bg-red-100 text-red-700
- Missed: bg-orange-100 text-orange-700
```

### 5. Chat Engine Integration

Update `src/components/chat/ChatEngine.tsx`:

```typescript
import { SMSConversationCard } from "./SMSConversationCard";
import { VoiceCallCard } from "./VoiceCallCard";

// Add to card regex:
const cardRegex = /```json:(contact|opportunity|action|tiktok-lead|facebook-lead|instagram-lead|whatsapp-conversation|sms-conversation|voice-call)\n([\s\S]*?)```/g;

// Add to card rendering:
else if (part.cardType === 'sms-conversation') {
  return <SMSConversationCard key={idx} conversation={part.data} />;
} else if (part.cardType === 'voice-call') {
  return <VoiceCallCard key={idx} call={part.data} />;
}
```

---

## Data Flow Examples

### SMS Inbound Flow

```
1. User sends SMS to your Twilio number
   ↓
2. Twilio sends webhook to /api/webhooks/twilio/sms
   ↓
3. Webhook handler validates signature
   ↓
4. SMSConversationDO stores message
   ↓
5. ContactDO linked/created with phone number
   ↓
6. Auto-response triggered (if configured)
   ↓
7. Chat UI shows new message in SMSConversationCard
```

### Voice Call Inbound Flow

```
1. User calls your Twilio number
   ↓
2. Twilio sends webhook to /api/webhooks/twilio/voice
   ↓
3. Return TwiML response (greeting, recording instructions)
   ↓
4. VoiceCallDO records call start
   ↓
5. Call completes, Twilio sends status callback
   ↓
6. VoiceCallDO records call end, duration
   ↓
7. Recording webhook received
   ↓
8. VoiceCallDO stores recording URL
   ↓
9. Optional: Trigger transcription
   ↓
10. Chat UI shows call in VoiceCallCard with recording
```

---

## Implementation Plan

### Phase 1: SMS Integration (Week 1)

**Day 1-2: Foundation**
- [ ] Set up Twilio account and phone number
- [ ] Create `src/server/webhooks/twilio.ts`
- [ ] Implement webhook verification
- [ ] Create `SMSConversationDO.ts`
- [ ] Test basic inbound SMS reception

**Day 3-4: API & Services**
- [ ] Create `src/server/services/twilio-api.ts`
- [ ] Implement `sendSMS()` function
- [ ] Create `src/server/services/sms-parser.ts`
- [ ] Implement delivery status tracking
- [ ] Test outbound SMS sending

**Day 5: UI Components**
- [ ] Create `SMSConversationCard.tsx`
- [ ] Update ChatEngine to support sms-conversation cards
- [ ] Add to README-CARDS.md documentation
- [ ] Test end-to-end SMS flow in UI

### Phase 2: Voice Call Integration (Week 2)

**Day 1-2: Call Handling**
- [ ] Extend twilio webhook for voice events
- [ ] Create `VoiceCallDO.ts`
- [ ] Implement TwiML response generation
- [ ] Test inbound call reception

**Day 3-4: Recordings & Transcription**
- [ ] Implement call recording storage
- [ ] Set up transcription webhooks
- [ ] Create `src/server/services/call-analytics.ts`
- [ ] Test recording playback

**Day 5: UI Components**
- [ ] Create `VoiceCallCard.tsx`
- [ ] Add recording player
- [ ] Add transcription viewer
- [ ] Update ChatEngine
- [ ] Test end-to-end voice flow

### Phase 3: Advanced Features (Week 3)

**Day 1-2: SMS Templates & Automation**
- [ ] Create SMS template system
- [ ] Implement auto-response workflows
- [ ] Add scheduling for SMS sending
- [ ] Bulk SMS capabilities

**Day 3-4: IVR & Call Routing**
- [ ] Create TwiML IVR flows
- [ ] Implement call forwarding
- [ ] Add voicemail handling
- [ ] Call queue management

**Day 5: Analytics & Reporting**
- [ ] SMS analytics (delivery rates, response times)
- [ ] Call analytics (duration, outcomes)
- [ ] Unified communication dashboard
- [ ] Cost tracking per channel

### Phase 4: Integration & Testing (Week 4)

**Day 1-2: Cross-Channel Features**
- [ ] Link SMS conversations to leads
- [ ] Link calls to opportunities
- [ ] Unified contact timeline (all channels)
- [ ] Smart routing based on channel preference

**Day 3-4: Production Readiness**
- [ ] Load testing
- [ ] Security audit
- [ ] Error handling improvements
- [ ] Monitoring & alerting setup

**Day 5: Documentation & Launch**
- [ ] Update all documentation
- [ ] Create user guides
- [ ] Train team on new features
- [ ] Production deployment

---

## Configuration

### Environment Variables

Add to `wrangler.jsonc`:

```json
{
  "vars": {
    // Existing vars...

    // Twilio Configuration
    "TWILIO_ACCOUNT_SID": "your-account-sid",
    "TWILIO_AUTH_TOKEN": "your-auth-token",
    "TWILIO_PHONE_NUMBER": "+15551234567",
    "TWILIO_WEBHOOK_BASE_URL": "https://your-app.workers.dev",

    // SMS Configuration
    "SMS_AUTO_RESPONSE_ENABLED": "true",
    "SMS_AUTO_RESPONSE_TEXT": "Thanks for contacting us! We'll respond soon.",

    // Voice Configuration
    "VOICE_RECORDING_ENABLED": "true",
    "VOICE_TRANSCRIPTION_ENABLED": "true",
    "VOICE_FORWARD_TO": "+15559876543"
  }
}
```

### Durable Object Bindings

Add to `wrangler.jsonc`:

```json
{
  "durable_objects": {
    "bindings": [
      // Existing bindings...
      {
        "name": "SMS_CONVERSATION",
        "class_name": "SMSConversationDO",
        "script_name": "your-app"
      },
      {
        "name": "VOICE_CALL",
        "class_name": "VoiceCallDO",
        "script_name": "your-app"
      }
    ]
  }
}
```

### Route Configuration

Update `src/entry.cloudflare.ts`:

```typescript
// SMS webhooks
app.post('/api/webhooks/twilio/sms', async (c) => {
  const signature = c.req.header('X-Twilio-Signature');
  if (!handleTwilioVerification(c.req.raw, c.env)) {
    return c.json({ error: 'Invalid signature' }, 403);
  }

  const body = await c.req.parseBody();
  return await processTwilioSMS(body as TwilioSMSWebhook, c.env);
});

// Voice webhooks
app.post('/api/webhooks/twilio/voice', async (c) => {
  const signature = c.req.header('X-Twilio-Signature');
  if (!handleTwilioVerification(c.req.raw, c.env)) {
    return c.text('Invalid signature', 403);
  }

  const body = await c.req.parseBody();
  return await processTwilioVoiceEvent(body as TwilioVoiceWebhook, c.env);
});

// Voice status callback
app.post('/api/webhooks/twilio/voice/status', async (c) => {
  // Handle call completion, recording ready, transcription complete
});
```

---

## Pricing Estimate

### Twilio Costs (US Numbers)

**SMS:**
- Inbound: $0.0075 per message
- Outbound: $0.0079 per message
- Phone number: $1.15/month

**Voice:**
- Inbound: $0.0085 per minute
- Outbound: $0.013 per minute
- Recording: $0.0025 per minute
- Transcription: $0.05 per minute
- Phone number: $1.15/month

**Example Monthly Cost (100 leads):**
- 200 SMS (inbound + outbound): $3.08
- 50 calls @ 5 min avg: $6.75
- 50 recordings @ 5 min avg: $0.63
- 25 transcriptions @ 5 min avg: $6.25
- Phone number: $1.15
- **Total: ~$17.86/month**

**Scaling (1,000 leads):**
- 2,000 SMS: $30.80
- 500 calls: $67.50
- 500 recordings: $6.25
- 250 transcriptions: $62.50
- Phone number: $1.15
- **Total: ~$168/month**

---

## Benefits

### 1. Unified Communication Hub

All channels in one interface:
- TikTok Leads → Initial contact
- Facebook/Instagram Leads → Social engagement
- WhatsApp → Chat conversations
- **SMS → Text messaging** ✨ NEW
- **Voice → Phone calls** ✨ NEW

### 2. Complete Customer Journey

```
Lead Generation (Social Ads)
  ↓
Initial Contact (WhatsApp/SMS)
  ↓
Qualification (Chat/SMS)
  ↓
Discovery Call (Voice) ✨
  ↓
Follow-up (SMS/Email)
  ↓
Close (Opportunity)
```

### 3. Improved Response Times

- SMS for quick responses (98% open rate within 3 minutes)
- Voice for urgent matters or high-value leads
- Automated SMS responses for after-hours

### 4. Better Lead Quality

- Call recordings for training and quality assurance
- Transcriptions for sentiment analysis
- SMS engagement tracking

### 5. Consistent Experience

- Same card-based UI
- Unified conversation history
- Cross-channel context

---

## Risks & Mitigation

### Risk 1: Cost Overruns

**Mitigation:**
- Set up rate limiting on SMS/voice APIs
- Implement cost alerts in Twilio dashboard
- Add daily/monthly caps per phone number
- Monitor usage in real-time

### Risk 2: Spam/Abuse

**Mitigation:**
- Implement phone number verification
- Rate limit inbound webhooks
- Block known spam numbers
- Require opt-in for SMS marketing

### Risk 3: Compliance (TCPA, GDPR)

**Mitigation:**
- Implement opt-in/opt-out flows
- Store consent records in ContactDO
- Include unsubscribe links in SMS
- Respect DNC (Do Not Call) lists
- Data retention policies

### Risk 4: Recording Storage

**Mitigation:**
- Use Cloudflare R2 for long-term storage
- Automatic deletion after 90 days
- Compression for older recordings
- Transcription-only option (delete audio)

---

## Success Metrics

### Technical Metrics

- [ ] SMS delivery rate > 98%
- [ ] Call connection rate > 95%
- [ ] Average latency < 2s for webhooks
- [ ] Zero message loss
- [ ] Uptime > 99.9%

### Business Metrics

- [ ] Lead response time < 5 minutes (SMS)
- [ ] Call pickup rate > 60%
- [ ] SMS engagement rate > 40%
- [ ] Cost per conversation < $0.50
- [ ] Unified conversation view adoption > 80%

---

## Next Steps

1. **Review & Approve** this proposal
2. **Set up Twilio account** (if not already done)
3. **Start Phase 1** (SMS Integration)
4. **Weekly check-ins** to review progress
5. **Iterate based on feedback**

---

## Appendix A: File Structure

```
src/
├── server/
│   ├── webhooks/
│   │   ├── twilio.ts                    ← New
│   │   ├── tiktok.ts
│   │   ├── facebook.ts
│   │   ├── instagram.ts
│   │   └── whatsapp.ts
│   ├── durable-objects/
│   │   ├── SMSConversationDO.ts         ← New
│   │   ├── VoiceCallDO.ts               ← New
│   │   ├── WhatsAppConversationDO.ts
│   │   ├── ContactDO.ts
│   │   └── OpportunityDO.ts
│   ├── services/
│   │   ├── twilio-api.ts                ← New
│   │   ├── sms-parser.ts                ← New
│   │   ├── call-analytics.ts            ← New
│   │   ├── whatsapp-api.ts
│   │   └── unified-lead-service.ts
│   └── tools/
│       ├── sms-tools.ts                 ← New
│       ├── voice-tools.ts               ← New
│       └── whatsapp-tools.ts
├── components/
│   └── chat/
│       ├── SMSConversationCard.tsx      ← New
│       ├── VoiceCallCard.tsx            ← New
│       ├── WhatsAppConversationCard.tsx
│       ├── TikTokLeadCard.tsx
│       ├── FacebookLeadCard.tsx
│       ├── InstagramLeadCard.tsx
│       └── ChatEngine.tsx               ← Update
└── docs/
    ├── PHONE-SMS-INTEGRATION-PROPOSAL.md  ← This file
    ├── UI-VALIDATION-SUMMARY.md
    └── README-CARDS.md                  ← Update
```

---

## Appendix B: Agent Integration Examples

### SMS Conversation in Chat

```markdown
I see you've been texting with John Smith. Here's the conversation:

```json:sms-conversation
{
  "phoneNumber": "+15551234567",
  "contactName": "John Smith",
  "messageCount": 5,
  "lastMessageTime": 1706227200000,
  "fromNumber": "+15559876543",
  "messages": [
    {
      "id": "msg_1",
      "messageSid": "SM123abc",
      "direction": "inbound",
      "body": "Hi, I'm interested in your product",
      "status": "received",
      "timestamp": 1706227200000
    },
    {
      "id": "msg_2",
      "messageSid": "SM456def",
      "direction": "outbound",
      "body": "Great! When would be a good time to chat?",
      "status": "delivered",
      "timestamp": 1706227260000
    }
  ]
}
```

Would you like me to send a follow-up message?
```

### Voice Call in Chat

```markdown
John Smith called 5 minutes ago. Here's the call summary:

```json:voice-call
{
  "callSid": "CA123abc456def",
  "from": "+15551234567",
  "to": "+15559876543",
  "direction": "inbound",
  "status": "completed",
  "duration": 332,
  "recordingUrl": "https://api.twilio.com/recordings/RE123",
  "transcription": "Hi, I'm calling about the pricing for your enterprise plan...",
  "startTime": 1706227500000,
  "endTime": 1706227832000,
  "contactName": "John Smith"
}
```

The call lasted 5 minutes 32 seconds. Would you like me to create an opportunity for this lead?
```

---

**Prepared by**: Claude Code Agent
**Review Status**: ✅ Ready for Review
**Estimated Timeline**: 4 weeks (full implementation)
**Confidence Level**: High - Based on proven WhatsApp integration pattern
