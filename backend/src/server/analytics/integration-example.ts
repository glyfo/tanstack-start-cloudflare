/**
 * ChatAgent Integration Example
 *
 * This file shows how to integrate conversation tracking
 * into your ChatAgent for the continuous improvement loop.
 *
 * Copy the relevant sections into your actual ChatAgent implementation.
 */

import { trackMessageExchange, trackConversationEvent } from './conversation-tracker';
import type { Env } from '../types/env';

/**
 * EXAMPLE 1: Track Message Exchange in ChatAgent
 *
 * Add this AFTER generating a response to the user
 */
export async function exampleTrackInChatAgent(
  env: Env,
  conversationId: string,
  customerId: string,
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'email' | 'slack' | 'discord' | 'telegram' | 'websocket',
  userMessage: string,
  agentResponse: string,
  metadata: {
    startTime: number;
    endTime: number;
    intentDetected?: string;
    intentConfidence?: number;
    toolsUsed?: string[];
  }
) {
  // Calculate response time
  const responseTimeMs = metadata.endTime - metadata.startTime;

  // Track the full exchange
  await trackMessageExchange(env, {
    conversationId,
    customerId,
    channel,
    userMessage,
    agentResponse,
    responseTimeMs,
    intentDetected: metadata.intentDetected,
    intentConfidence: metadata.intentConfidence,
    toolsUsed: metadata.toolsUsed,
    promptVersion: 'v1.0', // Update this when you change prompts
  });

  console.log('[Analytics] Tracked message exchange', {
    channel,
    responseTime: responseTimeMs,
    intent: metadata.intentDetected,
  });
}

/**
 * EXAMPLE 2: Integration in ChatAgent.handleAgentMessage()
 *
 * This shows where to add tracking in the actual ChatAgent class
 */
export class ExampleChatAgentIntegration {
  private env: Env;
  private conversationId: string;
  private customerId: string;
  private channel: string;

  constructor(env: Env, conversationId: string, customerId: string, channel: string) {
    this.env = env;
    this.conversationId = conversationId;
    this.customerId = customerId;
    this.channel = channel as any;
  }

  async handleUserMessage(userMessage: string): Promise<string> {
    const startTime = Date.now();

    // 1. Detect intent (your existing logic)
    const { intent, confidence } = await this.detectIntent(userMessage);

    // 2. Generate response (your existing logic)
    const toolsUsed: string[] = [];
    let response = '';

    try {
      // Your existing response generation...
      response = await this.generateResponse(userMessage, intent);

      // Track any tools that were used
      // Example: if you called searchContacts, add 'searchContacts' to toolsUsed
      // toolsUsed.push('searchContacts');

    } catch (error) {
      console.error('[ChatAgent] Error generating response:', error);
      response = 'I apologize, but I encountered an error. Please try again.';
    }

    const endTime = Date.now();

    // 3. **ADD THIS**: Track the conversation exchange
    try {
      await trackMessageExchange(this.env, {
        conversationId: this.conversationId,
        customerId: this.customerId,
        channel: this.channel as any,
        userMessage,
        agentResponse: response,
        responseTimeMs: endTime - startTime,
        intentDetected: intent,
        intentConfidence: confidence,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        promptVersion: 'v1.0', // Increment when you change prompts
      });
    } catch (analyticsError) {
      // Don't let analytics errors break the chat
      console.error('[Analytics] Failed to track exchange:', analyticsError);
    }

    return response;
  }

  // Placeholder methods (replace with your actual implementation)
  private async detectIntent(message: string) {
    return { intent: 'general_inquiry', confidence: 0.8 };
  }

  private async generateResponse(message: string, intent: string) {
    return 'Example response';
  }
}

/**
 * EXAMPLE 3: Track Customer Satisfaction
 *
 * After conversation resolution, track satisfaction
 */
export async function exampleTrackSatisfaction(
  env: Env,
  conversationId: string,
  customerId: string,
  channel: string,
  satisfaction: number, // 1-5
  resolved: boolean,
  escalated: boolean
) {
  await trackConversationEvent(env, {
    conversationId,
    customerId,
    channel: channel as any,
    messageType: 'system',
    messageLength: 0,
    resolved,
    escalated,
    customerSatisfaction: satisfaction,
    timestamp: Date.now(),
  });
}

/**
 * EXAMPLE 4: A/B Testing Integration
 *
 * Use different prompts based on active A/B tests
 */
export async function exampleABTestIntegration(
  env: Env,
  channel: string
): Promise<{ prompt: string; version: string }> {
  // TODO: Implement getActiveTest from KV or DO
  // For now, return default
  const hasActiveTest = false; // await getActiveTest(env, channel);

  if (hasActiveTest) {
    // const variant = Math.random() < 0.5 ? 'A' : 'B';
    // const prompt = activeTest[`variant${variant}`].prompt;
    // const version = `test-${activeTest.id}-${variant}`;
    // return { prompt, version };
    return { prompt: 'default', version: 'v1.0' };
  }

  // Default prompt
  return {
    prompt: 'You are a helpful assistant for customer support.',
    version: 'v1.0',
  };
}

/**
 * EXAMPLE 5: Channel-Specific Prompts
 *
 * Different prompts for different channels
 */
export function getChannelPrompt(channel: string): string {
  const prompts: Record<string, string> = {
    whatsapp: `You are a WhatsApp support specialist. Keep responses concise and use emojis sparingly.
Common intents: product inquiries, order status, shipping questions.
Always confirm the customer's question before providing a solution.`,

    instagram: `You are an Instagram DM support specialist. Responses should be friendly, visual-friendly, and concise.
Most customers ask about: products, pricing, shipping.
Use bullet points for clarity. Include product links when relevant.`,

    messenger: `You are a Facebook Messenger support specialist. Conversational but professional.
Common topics: product questions, account issues, general inquiries.
Provide clear, step-by-step solutions.`,

    email: `You are an email support specialist. Professional, detailed, and well-structured responses.
Use proper email formatting with greetings and signatures.
Provide comprehensive solutions with relevant links and resources.`,

    websocket: `You are a live chat support specialist. Quick, helpful, and conversational.
Respond promptly with clear, actionable information.
Guide customers through solutions step-by-step.`,
  };

  return prompts[channel] || prompts.websocket;
}

/**
 * INTEGRATION CHECKLIST
 *
 * ✅ Step 1: Run setup-analytics.sh script
 * ✅ Step 2: Deploy worker with Analytics Engine binding
 * ⬜ Step 3: Add trackMessageExchange after each response
 * ⬜ Step 4: Add intent detection tracking
 * ⬜ Step 5: Track tools used during conversation
 * ⬜ Step 6: Track customer satisfaction (if available)
 * ⬜ Step 7: Increment promptVersion when changing prompts
 * ⬜ Step 8: Test tracking with sample conversations
 * ⬜ Step 9: Monitor analytics dashboard
 * ⬜ Step 10: Wait 24 hours for first improvement loop run
 */

/**
 * TESTING
 *
 * To verify tracking is working:
 *
 * 1. Check logs:
 *    wrangler tail
 *
 * 2. Look for "[Analytics]" messages:
 *    [Analytics] Tracked message exchange { channel: 'whatsapp', ... }
 *
 * 3. Query API:
 *    curl http://localhost:8787/api/analytics/conversation-insights?timeRange=24h
 *
 * 4. Verify data in Cloudflare dashboard:
 *    Analytics > Analytics Engine > conversation_analytics
 */
