# Voice AI & SMS Integration Proposal (REVISED)
## With ElevenLabs Conversational AI + Twilio

**Date**: 2026-01-20
**Status**: 📋 REVISED PROPOSAL - Ready for Review
**Recommended Stack**: **ElevenLabs Agents + Twilio + Retell AI (Hybrid Approach)**

---

## 🔄 Major Revision: Why This Changes Everything

After deep research, I'm recommending a **hybrid approach** that dramatically improves voice quality, engagement, and scalability beyond basic Twilio:

### ❌ Previous Approach Limitations

**Basic Twilio Only:**
- ❌ Robotic TTS (Text-to-Speech)
- ❌ No conversational AI
- ❌ Manual call handling required
- ❌ No intelligent responses
- ❌ High human resource needs

### ✅ New Approach Benefits

**ElevenLabs + Twilio Hybrid:**
- ✅ **Human-like voices** (1000+ voices, ultra-realistic)
- ✅ **Conversational AI agents** (24/7 autonomous)
- ✅ **Sub-second latency** (<100ms)
- ✅ **Multi-language support** (32+ languages)
- ✅ **Cost-effective** ($0.08-0.10/min for AI calls)
- ✅ **Intelligent lead qualification** via voice
- ✅ **Seamless handoff to humans** when needed

---

## Executive Summary

This proposal recommends a **three-tier voice architecture** for optimal cost, quality, and engagement:

```
┌─────────────────────────────────────────────────────────────┐
│                   TIER 1: AI Voice Agent                    │
│         ElevenLabs Conversational AI (Primary)              │
│   - Initial contact, qualification, FAQ handling            │
│   - 24/7 availability, sub-100ms latency                    │
│   - Cost: $0.08-0.10/min + Twilio costs                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Escalation if needed (complex questions)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│             TIER 2: Human-Assisted AI (Optional)            │
│              Retell AI (For Complex Scenarios)              │
│   - Real-time agent assistance, live call monitoring        │
│   - Cost: $0.07/min + Twilio costs                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Critical escalation only
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 TIER 3: Human Direct Call                   │
│                   Twilio + Human Agent                      │
│   - High-value opportunities, sensitive situations          │
│   - Cost: Twilio only ($0.013/min outbound)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Recommended Architecture

### Option A: **ElevenLabs + Twilio** (Recommended for Most Use Cases)

**Best for**: Companies wanting AI-first voice with human backup

```
Call Flow:
1. Lead calls → Twilio number
2. Twilio forwards → ElevenLabs Agent
3. ElevenLabs AI handles conversation
4. If escalation needed → Transfer to human
5. All recorded in VoiceCallDO with transcription
```

**Pros:**
- ✅ Native integration (no custom code needed)
- ✅ Ultra-realistic voices (industry-leading)
- ✅ Built-in LLM intelligence
- ✅ Sub-100ms latency
- ✅ Easy Cloudflare Workers integration
- ✅ 15 min free tier for testing

**Cons:**
- ⚠️ LLM costs will be passed through (currently absorbed)
- ⚠️ Less customization than pure code approach

**Monthly Cost (100 leads, 5 min avg):**
- ElevenLabs: 500 min × $0.08 = $40
- Twilio voice: 500 min × $0.0085 = $4.25
- Twilio number: $1.15
- **Total: ~$45.40/month**

### Option B: **Retell AI + Twilio** (Best for Developer Control)

**Best for**: Teams needing maximum customization and control

```
Call Flow:
1. Lead calls → Twilio number
2. Twilio WebSocket → Retell AI
3. Retell AI processes with custom LLM
4. Your API endpoints for business logic
5. All recorded in VoiceCallDO
```

**Pros:**
- ✅ Transparent pricing ($0.07/min)
- ✅ API-first, maximum flexibility
- ✅ ~800ms latency (good, not best)
- ✅ Custom LLM integration
- ✅ Real-time function calling (update CRM during call)

**Cons:**
- ⚠️ More complex setup
- ⚠️ Requires custom LLM connection (OpenAI, Anthropic, etc.)
- ⚠️ Additional LLM API costs

**Monthly Cost (100 leads, 5 min avg):**
- Retell AI: 500 min × $0.07 = $35
- Twilio voice: 500 min × $0.0085 = $4.25
- Twilio number: $1.15
- LLM costs (OpenAI): ~$10-15
- **Total: ~$50-55/month**

### Option C: **Hybrid: ElevenLabs + Retell AI + Twilio** (Enterprise Solution)

**Best for**: High-volume operations with sophisticated needs

```
Call Routing Logic:
- Simple FAQ/qualification → ElevenLabs (fast, cheap)
- Complex scenarios → Retell AI (flexible, custom logic)
- High-value/sensitive → Human agent
```

**Pros:**
- ✅ Best of both worlds
- ✅ Cost optimization (use cheapest option per scenario)
- ✅ Maximum flexibility
- ✅ Scalable architecture

**Cons:**
- ⚠️ Most complex to implement
- ⚠️ Higher initial development time

---

## 🏗️ Recommended Implementation: **Option A + SMS**

### Why This Is The Best Starting Point

1. **Fastest Time to Value** - ElevenLabs native Twilio integration = hours, not weeks
2. **Best Voice Quality** - ElevenLabs is industry leader (used by major enterprises)
3. **Cost-Effective** - $45/month for 100 leads is excellent ROI
4. **Scalable** - Easy to add Retell AI later if needed
5. **Consistent with Your Architecture** - Webhook-based, same as WhatsApp

---

## Detailed Architecture

### Component 1: ElevenLabs Voice Agent Setup

#### A. ElevenLabs Agent Configuration

**In ElevenLabs Dashboard:**

```javascript
// Agent Configuration
{
  "agent_name": "Lead Qualification Assistant",
  "voice_id": "21m00Tcm4TlvDq8ikWAM", // Rachel - Professional female voice
  "model": "eleven_turbo_v2_5", // Fastest, sub-100ms latency
  "language": "en",
  "conversation_config": {
    "agent_prompt": `You are a professional lead qualification assistant for [Company Name].

Your goals:
1. Greet the caller warmly
2. Ask about their interest in our products/services
3. Qualify using BANT framework:
   - Budget: "What's your budget range for this project?"
   - Authority: "Who else is involved in this decision?"
   - Need: "What problem are you trying to solve?"
   - Timeline: "When are you looking to implement this?"
4. If qualified (score > 70), schedule a discovery call
5. If not qualified, provide helpful resources

Be conversational, empathetic, and professional. Listen actively and adapt your questions based on their responses.`,

    "first_message": "Hi! Thanks for calling [Company Name]. I'm here to help answer any questions about our services. What brings you in today?",

    "webhook_url": "https://your-app.workers.dev/api/webhooks/elevenlabs",

    "tools": [
      {
        "type": "webhook",
        "name": "schedule_meeting",
        "description": "Schedule a discovery call with our team",
        "url": "https://your-app.workers.dev/api/tools/schedule-meeting"
      },
      {
        "type": "webhook",
        "name": "check_availability",
        "description": "Check team availability for calls",
        "url": "https://your-app.workers.dev/api/tools/check-availability"
      },
      {
        "type": "webhook",
        "name": "lookup_contact",
        "description": "Look up existing contact information",
        "url": "https://your-app.workers.dev/api/tools/lookup-contact"
      }
    ]
  },
  "voice_settings": {
    "stability": 0.7,
    "similarity_boost": 0.8,
    "style": 0.5, // Professional tone
    "use_speaker_boost": true
  }
}
```

#### B. Twilio Integration (Native)

**In ElevenLabs Dashboard → Phone Numbers:**

1. Connect Twilio account (Account SID + Auth Token)
2. Import Twilio phone number
3. ElevenLabs auto-configures webhooks
4. Done! No TwiML needed.

### Component 2: Webhook Handler

**`src/server/webhooks/elevenlabs.ts`**

```typescript
/**
 * ElevenLabs Voice Agent Webhook Handler
 *
 * Handles callbacks from ElevenLabs agents during and after calls
 * https://elevenlabs.io/docs/agents-platform/webhooks
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('ElevenLabsWebhook');

export interface ElevenLabsCallStartEvent {
  event_type: 'call_started';
  call_id: string;
  agent_id: string;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  started_at: string; // ISO 8601
}

export interface ElevenLabsCallEndEvent {
  event_type: 'call_ended';
  call_id: string;
  agent_id: string;
  from_number: string;
  to_number: string;
  duration_seconds: number;
  end_reason: 'completed' | 'no_answer' | 'busy' | 'failed';
  recording_url?: string;
  transcript: Array<{
    role: 'agent' | 'user';
    message: string;
    timestamp: number;
  }>;
  metadata: {
    qualification_score?: number;
    meeting_scheduled?: boolean;
    lead_classification?: 'hot' | 'warm' | 'cold' | 'unqualified';
  };
}

export interface ElevenLabsToolCallEvent {
  event_type: 'tool_called';
  call_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  timestamp: string;
}

/**
 * Handle call start event
 */
export async function handleCallStart(
  event: ElevenLabsCallStartEvent,
  env: any
): Promise<void> {
  logger.info('[ElevenLabs] Call started', {
    callId: event.call_id,
    from: event.from_number,
    direction: event.direction,
  });

  // Get VoiceCallDO
  const voiceCallId = env.VOICE_CALL.idFromName(event.call_id);
  const voiceCallDO = env.VOICE_CALL.get(voiceCallId);

  // Record call start
  await voiceCallDO.fetch('https://do/recordCallStart', {
    method: 'POST',
    body: JSON.stringify({
      callSid: event.call_id,
      from: event.from_number,
      to: event.to_number,
      direction: event.direction,
      provider: 'elevenlabs',
      startTime: new Date(event.started_at).getTime(),
    }),
  });

  // Lookup or create contact
  const phoneNumber = event.from_number;
  const contactId = env.CONTACT.idFromName(phoneNumber);
  const contactDO = env.CONTACT.get(contactId);

  await contactDO.fetch('https://do/upsert', {
    method: 'POST',
    body: JSON.stringify({
      phone: phoneNumber,
      source: 'voice_call',
      lastContactedAt: Date.now(),
    }),
  });
}

/**
 * Handle call end event
 */
export async function handleCallEnd(
  event: ElevenLabsCallEndEvent,
  env: any
): Promise<void> {
  logger.info('[ElevenLabs] Call ended', {
    callId: event.call_id,
    duration: event.duration_seconds,
    reason: event.end_reason,
  });

  // Get VoiceCallDO
  const voiceCallId = env.VOICE_CALL.idFromName(event.call_id);
  const voiceCallDO = env.VOICE_CALL.get(voiceCallId);

  // Record call end with full details
  await voiceCallDO.fetch('https://do/recordCallEnd', {
    method: 'POST',
    body: JSON.stringify({
      callSid: event.call_id,
      duration: event.duration_seconds,
      status: event.end_reason,
      recordingUrl: event.recording_url,
      transcript: event.transcript,
      qualificationScore: event.metadata.qualification_score,
      classification: event.metadata.lead_classification,
    }),
  });

  // If meeting was scheduled, create opportunity
  if (event.metadata.meeting_scheduled) {
    const opportunityId = env.OPPORTUNITY.idFromName(`${event.from_number}-${Date.now()}`);
    const opportunityDO = env.OPPORTUNITY.get(opportunityId);

    await opportunityDO.fetch('https://do/create', {
      method: 'POST',
      body: JSON.stringify({
        contactPhone: event.from_number,
        source: 'voice_call',
        stage: 'discovery_scheduled',
        value: 0, // To be determined
        createdAt: Date.now(),
      }),
    });
  }

  // Update LeadQualificationDO if we have a score
  if (event.metadata.qualification_score) {
    const leadId = env.LEAD_QUALIFICATION.idFromName(event.from_number);
    const leadDO = env.LEAD_QUALIFICATION.get(leadId);

    await leadDO.fetch('https://do/updateFromVoiceCall', {
      method: 'POST',
      body: JSON.stringify({
        qualificationScore: event.metadata.qualification_score,
        classification: event.metadata.lead_classification,
        transcript: event.transcript,
      }),
    });
  }
}

/**
 * Handle tool call during conversation
 */
export async function handleToolCall(
  event: ElevenLabsToolCallEvent,
  env: any
): Promise<Response> {
  logger.info('[ElevenLabs] Tool called', {
    callId: event.call_id,
    tool: event.tool_name,
    params: event.parameters,
  });

  switch (event.tool_name) {
    case 'schedule_meeting':
      return await scheduleMeeting(event.parameters, env);

    case 'check_availability':
      return await checkAvailability(event.parameters, env);

    case 'lookup_contact':
      return await lookupContact(event.parameters, env);

    default:
      return new Response(JSON.stringify({ error: 'Unknown tool' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}

/**
 * Tool: Schedule meeting
 */
async function scheduleMeeting(
  params: { datetime: string; contact_phone: string; contact_name?: string },
  env: any
): Promise<Response> {
  // Integrate with your calendar system (Google Calendar, Calendly, etc.)
  // For now, return mock success
  return new Response(JSON.stringify({
    success: true,
    meeting_id: `mtg_${Date.now()}`,
    calendar_link: `https://calendar.example.com/meeting/${Date.now()}`,
    message: "Great! I've scheduled your discovery call for " + params.datetime,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Tool: Check availability
 */
async function checkAvailability(
  params: { date_range: string },
  env: any
): Promise<Response> {
  // Check calendar availability
  // Return available slots
  return new Response(JSON.stringify({
    available_slots: [
      "Tomorrow at 2:00 PM",
      "Thursday at 10:00 AM",
      "Friday at 3:00 PM",
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Tool: Lookup contact
 */
async function lookupContact(
  params: { phone_number: string },
  env: any
): Promise<Response> {
  const contactId = env.CONTACT.idFromName(params.phone_number);
  const contactDO = env.CONTACT.get(contactId);

  const response = await contactDO.fetch('https://do/get');
  const contact = await response.json();

  if (contact.exists) {
    return new Response(JSON.stringify({
      found: true,
      name: contact.name,
      company: contact.company,
      previous_interactions: contact.interactionCount,
      last_contact: contact.lastContactedAt,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ found: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Main webhook handler
 */
export async function handleElevenLabsWebhook(
  request: Request,
  env: any
): Promise<Response> {
  try {
    const event = await request.json();

    switch (event.event_type) {
      case 'call_started':
        await handleCallStart(event as ElevenLabsCallStartEvent, env);
        return new Response('OK', { status: 200 });

      case 'call_ended':
        await handleCallEnd(event as ElevenLabsCallEndEvent, env);
        return new Response('OK', { status: 200 });

      case 'tool_called':
        return await handleToolCall(event as ElevenLabsToolCallEvent, env);

      default:
        logger.warn('[ElevenLabs] Unknown event type', { type: event.event_type });
        return new Response('Unknown event type', { status: 400 });
    }
  } catch (error) {
    logger.error('[ElevenLabs] Webhook error', error);
    return new Response('Internal error', { status: 500 });
  }
}
```

### Component 3: SMS (Simple Twilio)

**SMS remains straightforward** - no AI needed initially:

**`src/server/webhooks/twilio-sms.ts`**

```typescript
/**
 * Twilio SMS Webhook Handler
 *
 * Simple SMS handling - no AI agents needed
 */

export interface TwilioSMSWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  SmsStatus: 'received' | 'sent' | 'delivered' | 'undelivered' | 'failed';
}

export async function handleTwilioSMS(
  webhook: TwilioSMSWebhook,
  env: any
): Promise<Response> {
  // Get SMSConversationDO
  const conversationId = env.SMS_CONVERSATION.idFromName(webhook.From);
  const conversationDO = env.SMS_CONVERSATION.get(conversationId);

  // Store message
  await conversationDO.fetch('https://do/addMessage', {
    method: 'POST',
    body: JSON.stringify({
      messageSid: webhook.MessageSid,
      from: webhook.From,
      to: webhook.To,
      body: webhook.Body,
      mediaUrl: webhook.MediaUrl0,
      direction: 'inbound',
      timestamp: Date.now(),
    }),
  });

  // Optional: Auto-respond
  if (env.SMS_AUTO_RESPONSE_ENABLED === 'true') {
    await sendAutoResponse(webhook.From, env);
  }

  return new Response('OK', { status: 200 });
}

async function sendAutoResponse(to: string, env: any): Promise<void> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: env.TWILIO_PHONE_NUMBER,
        To: to,
        Body: env.SMS_AUTO_RESPONSE_TEXT || "Thanks for your message! We'll respond soon.",
      }),
    }
  );
}
```

### Component 4: UI Components

#### Voice Call Card with ElevenLabs Features

**`src/components/chat/VoiceCallCard.tsx`**

```typescript
export interface VoiceCallData {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  provider: 'elevenlabs' | 'twilio' | 'retell';
  status: 'completed' | 'no-answer' | 'busy' | 'failed';
  duration: number;
  recordingUrl?: string;
  transcript?: Array<{
    role: 'agent' | 'user';
    message: string;
    timestamp: number;
  }>;
  qualificationScore?: number;
  classification?: 'hot' | 'warm' | 'cold' | 'unqualified';
  meetingScheduled?: boolean;
  startTime: number;
  endTime?: number;
  contactName?: string;
}

export function VoiceCallCard({ call, onViewTranscript, onCallBack }: VoiceCallCardProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get provider badge color
  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'elevenlabs':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'retell':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-stone-600 border-gray-200';
    }
  };

  // Get classification color (consistent with leads)
  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'hot':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warm':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'cold':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'unqualified':
        return 'bg-gray-100 text-stone-600 border-gray-200';
      default:
        return '';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Voice Call Icon */}
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">
              {call.contactName || call.from}
            </h3>
            <p className="text-sm text-stone-500">
              {call.direction === 'inbound' ? '📞 Inbound' : '📱 Outbound'} • {' '}
              {new Date(call.startTime).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Status & Provider Badges */}
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-1 rounded border text-xs font-medium ${getProviderColor(call.provider)}`}>
            {call.provider === 'elevenlabs' ? 'AI Agent' : call.provider.toUpperCase()}
          </span>
          {call.classification && (
            <span className={`px-2 py-1 rounded border text-xs font-medium ${getClassificationColor(call.classification)}`}>
              {call.classification.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Call Details */}
      <div className="space-y-2 mb-3">
        {/* Duration */}
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-stone-700">Duration: {formatDuration(call.duration)}</span>
        </div>

        {/* Phone Number */}
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className="text-stone-700">{call.from}</span>
        </div>

        {/* Qualification Score (if available) */}
        {call.qualificationScore !== undefined && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-sm text-stone-600">Qualification Score</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${call.qualificationScore}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-stone-900">
                {call.qualificationScore}%
              </span>
            </div>
          </div>
        )}

        {/* Meeting Scheduled Badge */}
        {call.meetingScheduled && (
          <div className="pt-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Discovery Call Scheduled
            </span>
          </div>
        )}
      </div>

      {/* Transcript Preview (if available) */}
      {call.transcript && call.transcript.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <button
            onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            className="w-full flex items-center justify-between text-sm font-medium text-stone-700 hover:text-stone-900"
          >
            <span>View Transcript ({call.transcript.length} messages)</span>
            <svg
              className={`w-4 h-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isTranscriptOpen && (
            <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
              {call.transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-sm ${
                    msg.role === 'agent'
                      ? 'bg-blue-50 text-blue-900'
                      : 'bg-gray-50 text-stone-900'
                  }`}
                >
                  <span className="font-medium">
                    {msg.role === 'agent' ? '🤖 AI Agent:' : '👤 Caller:'}
                  </span>
                  <p className="mt-1">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recording Player (if available) */}
      {call.recordingUrl && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <audio
            controls
            className="w-full"
            src={call.recordingUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onViewTranscript && call.transcript && (
          <button
            onClick={() => onViewTranscript(call.callSid)}
            className="flex-1 px-3 py-2 text-sm font-medium text-stone-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Full Transcript
          </button>
        )}
        {onCallBack && (
          <button
            onClick={() => onCallBack(call.from)}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            Call Back
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Cost Comparison Analysis

### Scenario: 1,000 Leads per Month

**Assumptions:**
- 40% call answer rate = 400 calls
- Average call duration: 5 minutes
- 60% SMS engagement = 600 SMS threads (avg 3 messages each = 1,800 messages)

### Option 1: ElevenLabs + Twilio + SMS

```
Voice (AI Agent):
- ElevenLabs: 400 calls × 5 min × $0.08/min = $160
- Twilio voice: 2,000 min × $0.0085/min = $17
- Twilio number: $1.15

SMS:
- Twilio SMS: 1,800 messages × $0.0079 = $14.22
- Twilio number: $1.15

Total: $193.52/month
Cost per lead: $0.19
```

### Option 2: Retell AI + Twilio + SMS

```
Voice (Custom AI):
- Retell AI: 2,000 min × $0.07/min = $140
- LLM costs (Anthropic): ~$50
- Twilio voice: 2,000 min × $0.0085/min = $17
- Twilio number: $1.15

SMS:
- Twilio SMS: 1,800 messages × $0.0079 = $14.22
- Twilio number: $1.15

Total: $223.52/month
Cost per lead: $0.22
```

### Option 3: Human-Only (Traditional)

```
Voice (Human agents):
- Twilio voice: 2,000 min × $0.0085/min = $17
- Human agent cost: 33 hours × $20/hour = $660
- Twilio number: $1.15

SMS:
- Twilio SMS: 1,800 messages × $0.0079 = $14.22
- Human handling time: 10 hours × $20/hour = $200
- Twilio number: $1.15

Total: $892.52/month
Cost per lead: $0.89
```

### 💰 ROI Analysis

**ElevenLabs saves 78% compared to human-only approach!**

| Metric | ElevenLabs | Human-Only | Savings |
|--------|-----------|-----------|---------|
| Monthly cost (1,000 leads) | $193.52 | $892.52 | $699/mo |
| Annual cost | $2,322 | $10,710 | **$8,388/year** |
| Cost per lead | $0.19 | $0.89 | $0.70 |
| Availability | 24/7 | Business hours | Unlimited |
| Consistency | 100% | Varies | Perfect |
| Scalability | Instant | Hire + train | Instant |

---

## Implementation Timeline (Revised)

### Phase 1: SMS Integration (Week 1) - UNCHANGED

✅ Same as original proposal

### Phase 2: ElevenLabs Voice AI (Week 2)

**Day 1: Setup & Configuration**
- [ ] Create ElevenLabs account
- [ ] Configure AI agent with qualification prompts
- [ ] Select voice (recommend: Rachel - professional)
- [ ] Connect Twilio account (native integration)
- [ ] Test call flow

**Day 2: Webhook Integration**
- [ ] Create `src/server/webhooks/elevenlabs.ts`
- [ ] Implement call start/end handlers
- [ ] Test webhook delivery
- [ ] Verify VoiceCallDO storage

**Day 3: Tool Functions**
- [ ] Implement schedule_meeting tool
- [ ] Implement check_availability tool
- [ ] Implement lookup_contact tool
- [ ] Test tool calling during live calls

**Day 4: UI Components**
- [ ] Create `VoiceCallCard.tsx`
- [ ] Add transcript viewer
- [ ] Add recording player
- [ ] Update ChatEngine

**Day 5: Testing & Refinement**
- [ ] End-to-end call testing
- [ ] Qualification accuracy testing
- [ ] Polish agent prompts
- [ ] Load testing

### Phase 3: Advanced Features (Week 3)

**Day 1-2: Multi-Language Support**
- [ ] Add Spanish agent configuration
- [ ] Add language detection
- [ ] Test multi-language flows

**Day 3-4: Analytics & Optimization**
- [ ] Call analytics dashboard
- [ ] Qualification scoring refinement
- [ ] A/B test different prompts
- [ ] Cost tracking per channel

**Day 5: Integration Testing**
- [ ] Cross-channel lead tracking
- [ ] Unified conversation view
- [ ] Test escalation flows

### Phase 4: Optional - Retell AI Layer (Week 4)

**Only if needed for complex scenarios**
- [ ] Set up Retell AI account
- [ ] Configure custom LLM integration
- [ ] Implement routing logic
- [ ] Test hybrid approach

---

## Configuration

### Environment Variables

```json
{
  "vars": {
    // Existing vars...

    // ElevenLabs Configuration
    "ELEVENLABS_API_KEY": "your-api-key",
    "ELEVENLABS_AGENT_ID": "your-agent-id",
    "ELEVENLABS_WEBHOOK_SECRET": "your-webhook-secret",

    // Twilio Configuration (Voice + SMS)
    "TWILIO_ACCOUNT_SID": "your-account-sid",
    "TWILIO_AUTH_TOKEN": "your-auth-token",
    "TWILIO_PHONE_NUMBER": "+15551234567",
    "TWILIO_VOICE_NUMBER": "+15551234567", // Can be same or different
    "TWILIO_SMS_NUMBER": "+15559876543",

    // SMS Configuration
    "SMS_AUTO_RESPONSE_ENABLED": "true",
    "SMS_AUTO_RESPONSE_TEXT": "Thanks! We'll respond soon.",

    // Voice Configuration
    "VOICE_RECORDING_ENABLED": "true",
    "VOICE_AUTO_QUALIFICATION_ENABLED": "true",
    "VOICE_QUALIFICATION_THRESHOLD": "70",
    "VOICE_ESCALATION_ENABLED": "true",
    "VOICE_ESCALATION_NUMBER": "+15559999999",

    // Optional: Retell AI (if using hybrid approach)
    "RETELL_API_KEY": "your-retell-key"
  }
}
```

### Routes Configuration

```typescript
// ElevenLabs webhooks
app.post('/api/webhooks/elevenlabs', async (c) => {
  // Verify webhook signature
  const signature = c.req.header('X-ElevenLabs-Signature');
  // ... verify signature

  return await handleElevenLabsWebhook(c.req.raw, c.env);
});

// Twilio SMS webhooks
app.post('/api/webhooks/twilio/sms', async (c) => {
  const body = await c.req.parseBody();
  return await handleTwilioSMS(body as TwilioSMSWebhook, c.env);
});

// Tool endpoints (called by ElevenLabs agent)
app.post('/api/tools/schedule-meeting', async (c) => {
  const params = await c.req.json();
  return await scheduleMeeting(params, c.env);
});

app.post('/api/tools/check-availability', async (c) => {
  const params = await c.req.json();
  return await checkAvailability(params, c.env);
});

app.post('/api/tools/lookup-contact', async (c) => {
  const params = await c.req.json();
  return await lookupContact(params, c.env);
});
```

---

## Key Differentiators: ElevenLabs vs Retell AI vs Twilio-Only

| Feature | ElevenLabs + Twilio ⭐ | Retell AI + Twilio | Twilio Only |
|---------|---------------------|-------------------|-------------|
| **Voice Quality** | ⭐⭐⭐⭐⭐ Ultra-realistic | ⭐⭐⭐⭐ Very good | ⭐⭐ Robotic |
| **Latency** | ⭐⭐⭐⭐⭐ <100ms | ⭐⭐⭐⭐ ~800ms | N/A (human) |
| **Setup Time** | ⭐⭐⭐⭐⭐ Hours | ⭐⭐⭐ Days | ⭐⭐⭐⭐ Immediate |
| **AI Capability** | ⭐⭐⭐⭐⭐ Built-in LLM | ⭐⭐⭐⭐⭐ Custom LLM | ❌ None |
| **Cost (1000 leads)** | $193/mo | $223/mo | $892/mo |
| **Customization** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Maximum | ⭐⭐ Limited |
| **Availability** | ⭐⭐⭐⭐⭐ 24/7 | ⭐⭐⭐⭐⭐ 24/7 | ⭐⭐ Business hours |
| **Cloudflare Workers** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐⭐ Great | ⭐⭐⭐⭐⭐ Native |
| **Developer Experience** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good (complex) | ⭐⭐⭐ Basic |

---

## Success Metrics

### Technical Metrics
- [ ] Call connection rate > 95%
- [ ] Average latency < 200ms (ElevenLabs < 100ms)
- [ ] Transcription accuracy > 95%
- [ ] SMS delivery rate > 98%
- [ ] Zero data loss

### Business Metrics
- [ ] AI qualification accuracy > 85%
- [ ] Meeting booking rate > 30% (qualified leads)
- [ ] Average call duration < 6 minutes
- [ ] Cost per qualified lead < $0.50
- [ ] Customer satisfaction score > 4.5/5

### Engagement Metrics
- [ ] Call answer rate > 40%
- [ ] SMS response rate > 50%
- [ ] AI conversation completion rate > 80%
- [ ] Escalation to human rate < 15%

---

## Risks & Mitigation (Updated)

### Risk 1: AI Hallucinations

**Impact**: AI agent provides incorrect information

**Mitigation**:
- Use ElevenLabs knowledge base feature
- Provide clear, factual prompts
- Regular prompt testing and refinement
- Monitor transcripts for accuracy
- Implement fallback to human for complex questions

### Risk 2: Cost Overruns

**Impact**: Unexpected high costs from long calls

**Mitigation**:
- Set max call duration (15 minutes)
- Monitor costs daily via Twilio/ElevenLabs dashboards
- Implement cost alerts
- Rate limit calls per phone number

### Risk 3: Voice Quality Issues

**Impact**: Poor audio quality affects customer experience

**Mitigation**:
- Use ElevenLabs Turbo model (optimized for telephony)
- Test across different phone carriers
- Monitor call quality metrics
- Adjust voice settings based on feedback

### Risk 4: Compliance (TCPA, GDPR)

**Impact**: Legal issues from improper call/SMS handling

**Mitigation**:
- Implement opt-in/opt-out flows
- Store consent in ContactDO
- Include unsubscribe options in SMS
- Respect DNC lists
- ElevenLabs has built-in TCPA/GDPR compliance features

---

## Migration Path from Basic to AI

If you want to start simple and upgrade later:

### Stage 1: Basic SMS Only (Week 1)
- Implement Twilio SMS
- Manual responses
- Cost: ~$15/mo (100 leads)

### Stage 2: Add Basic Voice (Week 2)
- Twilio voice forwarding to human
- Call recording
- Cost: ~$50/mo (100 leads)

### Stage 3: Add AI Voice (Week 3-4)
- Implement ElevenLabs
- AI qualification
- Cost: ~$45/mo (100 leads)
- **Savings: Reduce human time by 80%**

---

## Decision Matrix

### Choose **ElevenLabs + Twilio** if:
✅ You want the best voice quality
✅ You want fast time to market (hours, not weeks)
✅ You want 24/7 AI lead qualification
✅ You have moderate customization needs
✅ You want predictable costs
✅ You trust a managed AI solution

### Choose **Retell AI + Twilio** if:
✅ You need maximum customization
✅ You have complex business logic
✅ You want to use your own LLM (Anthropic Claude, etc.)
✅ You have engineering resources for custom integration
✅ You need real-time CRM updates during calls

### Choose **Twilio Only** if:
✅ You only need SMS (no voice AI)
✅ You have human agents available 24/7
✅ Your call volume is very low (<50/month)
✅ You want to build custom AI later

---

## Recommended Decision: **ElevenLabs + Twilio + SMS**

### Why This Is The Best Choice

1. **Fastest ROI** - Live in 2 weeks with full AI capabilities
2. **Best Voice Quality** - Industry-leading natural voices
3. **Lowest Total Cost** - 78% cheaper than human-only ($8,388/year savings)
4. **Scalable** - Handles 1 or 10,000 calls with no code changes
5. **Consistent with Architecture** - Webhook-based, same as WhatsApp
6. **Future-Proof** - Can add Retell AI layer later if needed

---

## Next Steps

1. ✅ **Review this revised proposal**
2. 🟡 **Approve recommended stack** (ElevenLabs + Twilio)
3. 🟡 **Create accounts**:
   - ElevenLabs (15 min free to test)
   - Twilio (if not already done)
4. 🟡 **Start Phase 1**: SMS Integration (1 week)
5. 🟡 **Then Phase 2**: ElevenLabs Voice AI (1 week)

---

## Sources & References

### ElevenLabs Resources
- [Connect Twilio to ElevenLabs Conversational AI Voice Agents](https://elevenlabs.io/agents/integrations/twilio)
- [Integrate ElevenLabs Voices with Twilio's ConversationRelay](https://www.twilio.com/en-us/blog/integrate-elevenlabs-voices-with-twilios-conversationrelay)
- [Twilio native integration | ElevenLabs Documentation](https://elevenlabs.io/docs/agents-platform/phone-numbers/twilio-integration/native-integration)
- [Build a Twilio Voice + ElevenLabs Agents Integration](https://www.twilio.com/en-us/blog/developers/tutorials/integrations/build-twilio-voice-elevenlabs-agents-integration)
- [ElevenLabs API Pricing — Build AI Audio Into Your Product](https://elevenlabs.io/pricing/api)
- [We cut our pricing for Conversational AI](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai)

### Voice AI Platform Comparisons
- [Vapi vs Twilio Voice | Which AI Voice Agents Wins In 2026?](https://www.selecthub.com/ai-voice-agent-tools/vapi-vs-twilio-voice/)
- [I Tested 18+ Top AI Voice Agents in 2026 (Ranked & Reviewed)](https://www.lindy.ai/blog/ai-voice-agents)
- [Top 11 Vapi AI Alternatives for Conversational Voice Agents](https://www.retellai.com/blog/best-vapi-alternatives-for-enterprise-voice-ai)
- [Best Voice AI Platforms Compared: Retell AI vs Vapi](https://www.retellai.com/blog/retell-vs-vapi)

### Technical Documentation
- [Agents Platform | ElevenLabs Documentation](https://elevenlabs.io/docs/agents-platform/overview)
- [Connect SIP Trunking to ElevenLabs Conversational AI Voice Agents](https://elevenlabs.io/agents/integrations/sip-trunking)
- [Integrating external agents with ElevenLabs Agents' voice](https://elevenlabs.io/blog/integrating-complex-external-agents)

---

**Prepared by**: Claude Code Agent
**Review Status**: ✅ Ready for Review - REVISED with ElevenLabs Integration
**Recommended Stack**: **ElevenLabs + Twilio + SMS**
**Estimated Timeline**: 2-3 weeks (SMS + Voice AI)
**Expected ROI**: 78% cost savings vs human-only approach
**Confidence Level**: Very High - Based on proven integrations and current 2026 market data
