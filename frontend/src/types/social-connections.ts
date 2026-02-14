/**
 * Social Media Connections - Type Definitions
 *
 * Defines interfaces for managing OAuth connections to social platforms
 * (Facebook, Instagram, WhatsApp, TikTok).
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type SocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok' | 'gmail';

export type ConnectionStatus = 'active' | 'expired' | 'disconnected' | 'error';

export type ConnectionEventType =
  | 'connected'
  | 'disconnected'
  | 'token_refreshed'
  | 'token_expired'
  | 'error'
  | 'verified';

// =============================================================================
// PLATFORM CONFIGURATION
// =============================================================================

export interface PlatformConfig {
  platform: SocialPlatform;
  displayName: string;
  icon: string;
  description: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  tokenExpiryDays: number;
  supportsRefresh: boolean;
  color: string;
}

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  facebook: {
    platform: 'facebook',
    displayName: 'Facebook',
    icon: 'facebook',
    description: 'Connect to Facebook Pages and Lead Ads',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'leads_retrieval',
      'pages_manage_metadata',
    ],
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenExpiryDays: 60,
    supportsRefresh: true,
    color: '#1877F2',
  },
  instagram: {
    platform: 'instagram',
    displayName: 'Instagram',
    icon: 'instagram',
    description: 'Connect to Instagram Business accounts',
    scopes: [
      'instagram_basic',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
    ],
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenExpiryDays: 60,
    supportsRefresh: true,
    color: '#E4405F',
  },
  whatsapp: {
    platform: 'whatsapp',
    displayName: 'WhatsApp',
    icon: 'whatsapp',
    description: 'Connect to WhatsApp Business API',
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenExpiryDays: 60,
    supportsRefresh: true,
    color: '#25D366',
  },
  tiktok: {
    platform: 'tiktok',
    displayName: 'TikTok',
    icon: 'tiktok',
    description: 'Connect to TikTok Lead Generation',
    scopes: ['user.info.basic', 'lead.read'],
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    tokenExpiryDays: 1, // TikTok tokens expire in 24 hours
    supportsRefresh: true,
    color: '#000000',
  },
  gmail: {
    platform: 'gmail',
    displayName: 'Gmail',
    icon: 'mail',
    description: 'Connect Gmail for email-based lead capture',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    tokenExpiryDays: 0.042, // ~1 hour (3600 seconds)
    supportsRefresh: true,
    color: '#EA4335',
  },
};

// =============================================================================
// CONNECTION DATA
// =============================================================================

export interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  platformUserId?: string;
  platformUsername?: string;
  platformPageId?: string;
  platformPageName?: string;

  // Token info (not the actual tokens - those stay encrypted in DO)
  scope?: string;
  expiresAt?: number;

  // Status
  status: ConnectionStatus;
  lastVerifiedAt?: number;
  errorMessage?: string;

  // Webhook
  webhookSecret?: string;
  webhookUrl?: string;

  // Audit
  connectedAt: number;
  connectedBy: string;
  updatedAt: number;
}

export interface ConnectionEvent {
  id: string;
  connectionId: string;
  eventType: ConnectionEventType;
  eventData?: Record<string, unknown>;
  createdAt: number;
}

// =============================================================================
// OAUTH FLOW
// =============================================================================

export interface OAuthState {
  platform: SocialPlatform;
  orgId: string;
  userId: string;
  nonce: string;
  redirectUrl: string;
  createdAt: number;
  expiresAt: number;
  // For PKCE (TikTok)
  codeVerifier?: string;
}

export interface OAuthStartParams {
  platform: SocialPlatform;
  orgId: string;
  userId: string;
  redirectUrl: string;
}

export interface OAuthStartResult {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackParams {
  platform: SocialPlatform;
  code: string;
  state: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  connection?: SocialConnection;
  error?: string;
}

// =============================================================================
// TOKEN ENCRYPTION
// =============================================================================

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  salt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

export interface EncryptedTokenPair {
  accessToken: EncryptedToken;
  refreshToken?: EncryptedToken;
  expiresAt?: number;
  scope?: string;
}

// =============================================================================
// API REQUESTS/RESPONSES
// =============================================================================

export interface ListConnectionsResponse {
  connections: SocialConnection[];
  total: number;
}

export interface ConnectionStatusResponse {
  platform: SocialPlatform;
  status: ConnectionStatus;
  lastVerifiedAt?: number;
  expiresAt?: number;
  daysUntilExpiry?: number;
  errorMessage?: string;
}

export interface RefreshTokenRequest {
  platform: SocialPlatform;
}

export interface RefreshTokenResponse {
  success: boolean;
  expiresAt?: number;
  error?: string;
}

export interface DisconnectRequest {
  platform: SocialPlatform;
}

export interface DisconnectResponse {
  success: boolean;
  error?: string;
}

// =============================================================================
// WEBHOOK CONFIGURATION
// =============================================================================

export interface WebhookConfig {
  platform: SocialPlatform;
  webhookUrl: string;
  verifyToken?: string;
  secret?: string;
  isVerified: boolean;
  lastEventAt?: number;
  eventCount: number;
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export interface ConnectionHealth {
  platform: SocialPlatform;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: {
    tokenValid: boolean;
    daysUntilExpiry?: number;
    lastApiCall?: number;
    apiCallSuccess?: boolean;
  };
}

// =============================================================================
// UI STATE
// =============================================================================

export interface ConnectionsState {
  connections: SocialConnection[];
  loading: boolean;
  error?: string;
  connecting?: SocialPlatform;
  disconnecting?: SocialPlatform;
  refreshing?: SocialPlatform;
}

export interface ConnectionCardProps {
  connection?: SocialConnection;
  platform: SocialPlatform;
  config: PlatformConfig;
  onConnect: (platform: SocialPlatform) => void;
  onDisconnect: (platform: SocialPlatform) => void;
  onRefresh: (platform: SocialPlatform) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  isRefreshing?: boolean;
}
