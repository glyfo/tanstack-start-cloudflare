/**
 * Environment Variable Type Extensions
 *
 * This file extends the Cloudflare Env interface with our application-specific
 * environment variables for social media integrations.
 */

declare module 'cloudflare:workers' {
  interface Env {
    // AI Binding
    AI: any;

    // Durable Object Bindings
    CHAT_AGENT: DurableObjectNamespace;
    CONVERSATION_STATE: DurableObjectNamespace;
    CONTACT_DO: DurableObjectNamespace;
    LEAD_QUALIFICATION_DO: DurableObjectNamespace;
    ENHANCED_CONVERSATION: DurableObjectNamespace;
    TIKTOK_LEAD_DO: DurableObjectNamespace;
    OPPORTUNITY_DO: DurableObjectNamespace;
    SOCIAL_CONNECTIONS_DO: DurableObjectNamespace;
    SOCIAL_HUB_DO: DurableObjectNamespace;
    WHATSAPP_CONVERSATION_DO: DurableObjectNamespace;
    FACEBOOK_LEAD_DO: DurableObjectNamespace;
    RATE_LIMITER: DurableObjectNamespace;

    // AI Model Configuration
    AI_MODEL: string;

    // Meta Facebook/Instagram OAuth
    FACEBOOK_APP_ID: string;
    FACEBOOK_APP_SECRET: string;
    FACEBOOK_PAGE_ACCESS_TOKEN: string;
    FACEBOOK_VERIFY_TOKEN: string;

    // WhatsApp Business API
    WHATSAPP_VERIFY_TOKEN: string;
    WHATSAPP_PHONE_NUMBER_ID: string;
    WHATSAPP_ACCESS_TOKEN: string;

    // TikTok Lead Generation
    TIKTOK_CLIENT_KEY: string;
    TIKTOK_CLIENT_SECRET: string;
    TIKTOK_WEBHOOK_SECRET: string;

    // Gmail OAuth
    GMAIL_CLIENT_ID: string;
    GMAIL_CLIENT_SECRET: string;

    // Token Encryption
    TOKEN_ENCRYPTION_SECRET: string;

    // Webhook Routing
    DEFAULT_WEBHOOK_ORG?: string;

    // KV Namespaces (optional - for caching/deduplication)
    LEADS_KV?: KVNamespace;
    LEAD_INDEX_KV?: KVNamespace;
    WEBHOOK_ROUTING_KV?: KVNamespace;
    TOKENS_KV?: KVNamespace;
    METRICS_KV?: KVNamespace;
    CONVERSATIONS_KV?: KVNamespace;
  }
}

export {};
