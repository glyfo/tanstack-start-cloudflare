export interface Env {
  // Durable Objects (primary bindings)
  CHAT_AGENT: DurableObjectNamespace;
  CONTACT_DO: DurableObjectNamespace;
  OPPORTUNITY_DO: DurableObjectNamespace;
  SOCIAL_CONNECTIONS_DO: DurableObjectNamespace;
  RATE_LIMITER?: DurableObjectNamespace;
  LEAD_QUALIFICATION_DO?: DurableObjectNamespace;
  ENHANCED_CONVERSATION: DurableObjectNamespace;
  WHATSAPP_CONVERSATION: DurableObjectNamespace;
  SOCIAL_HUB_DO?: DurableObjectNamespace;

  // Legacy/alias bindings still referenced in some modules
  CONVERSATION_STATE?: DurableObjectNamespace;
  LEAD_QUALIFICATION?: DurableObjectNamespace;
  TIKTOK_LEAD?: DurableObjectNamespace;
  FACEBOOK_LEAD?: DurableObjectNamespace;
  OPPORTUNITY?: DurableObjectNamespace;
  SOCIAL_CONNECTIONS?: DurableObjectNamespace;
  SOCIAL_HUB?: DurableObjectNamespace;

  // KV Namespaces
  LEADS_KV?: KVNamespace;
  LEAD_INDEX_KV?: KVNamespace;
  WEBHOOK_ROUTING_KV?: KVNamespace;

  // AI
  AI: any; // Cloudflare AI binding
  AI_MODEL?: string; // e.g., "@cf/zai-org/glm-4.7-flash"

  // Secrets & Config
  TIKTOK_WEBHOOK_SECRET?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_VERIFY_TOKEN?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  INSTAGRAM_VERIFY_TOKEN?: string;
  INSTAGRAM_APP_SECRET?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  
  // App Config
  APP_URL?: string;
  ENVIRONMENT?: "development" | "production" | "staging";
  DEFAULT_WEBHOOK_ORG?: string;
  WEBHOOK_ASYNC_PROCESSING?: string;

  // Scheduled Gmail autonomous review
  GMAIL_AUTONOMOUS_ENABLED?: string;
  GMAIL_AUTONOMOUS_ORGS?: string;
  GMAIL_AUTONOMOUS_QUERY?: string;
  GMAIL_AUTONOMOUS_MAX_RESULTS?: string;
}
