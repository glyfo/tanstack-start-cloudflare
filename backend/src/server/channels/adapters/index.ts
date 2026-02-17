/**
 * Channel Adapters Export
 *
 * Central export file for all channel adapters.
 */

// Channel adapters
export { WebSocketAdapter } from './websocket-adapter';
export { WhatsAppAdapter } from './whatsapp-adapter';
export { TwilioAdapter } from './twilio-adapter';
export { SlackAdapter } from './slack-adapter';
export { DiscordAdapter } from './discord-adapter';
export { TelegramAdapter } from './telegram-adapter';
export { EmailAdapter } from './email-adapter';

// Export base adapter for custom implementations
export { BaseChannelAdapter } from '../channel-adapter';
export type { ChannelAdapter } from '../channel-adapter';
