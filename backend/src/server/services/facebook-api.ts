/**
 * Facebook Lead Ads API Client
 *
 * Handles interactions with Facebook Graph API for Lead Generation
 * https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */

import { createLogger } from '../utils/logger';
import type { FacebookLeadData } from '../webhooks/facebook';

const logger = createLogger('FacebookAPI');

const FACEBOOK_API_VERSION = 'v21.0';
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

/**
 * Fetch lead data from Facebook Graph API
 *
 * @param leadgenId - Lead ID from webhook
 * @param accessToken - Page access token
 * @returns Full lead data with field values
 */
export async function fetchLeadData(
  leadgenId: string,
  accessToken: string
): Promise<FacebookLeadData | null> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/${leadgenId}?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id&access_token=${accessToken}`;

    logger.info('[FacebookAPI] Fetching lead data', { leadgenId });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[FacebookAPI] Failed to fetch lead', {
        leadgenId,
        status: response.status,
        error: errorData,
      });
      return null;
    }

    const data = await response.json() as any as FacebookLeadData;

    logger.info('[FacebookAPI] Lead data fetched successfully', {
      leadgenId,
      fieldCount: data.field_data?.length || 0,
    });

    return data as FacebookLeadData;
  } catch (error) {
    logger.error('[FacebookAPI] Error fetching lead data', error);
    return null;
  }
}

/**
 * Fetch form structure and field mappings
 *
 * @param formId - Form ID
 * @param accessToken - Page access token
 * @returns Form configuration with questions and field types
 */
export async function fetchFormData(
  formId: string,
  accessToken: string
): Promise<{
  id: string;
  name: string;
  locale: string;
  questions: Array<{
    id: string;
    label: string;
    type: string;
    key: string;
  }>;
} | null> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/${formId}?fields=id,name,locale,questions&access_token=${accessToken}`;

    logger.info('[FacebookAPI] Fetching form data', { formId });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[FacebookAPI] Failed to fetch form', {
        formId,
        status: response.status,
        error: errorData,
      });
      return null;
    }

    const data = await response.json() as any;

    logger.info('[FacebookAPI] Form data fetched successfully', {
      formId,
      questionCount: data.questions?.length || 0,
    });

    return data;
  } catch (error) {
    logger.error('[FacebookAPI] Error fetching form data', error);
    return null;
  }
}

/**
 * Fetch multiple leads with pagination
 *
 * @param formId - Form ID
 * @param accessToken - Page access token
 * @param limit - Number of leads to fetch (max 100)
 * @param after - Pagination cursor
 * @returns Paginated lead results
 */
export async function fetchLeadsByForm(
  formId: string,
  accessToken: string,
  limit: number = 25,
  after?: string
): Promise<{
  data: FacebookLeadData[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
} | null> {
  try {
    let url = `${FACEBOOK_GRAPH_API_BASE}/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id&limit=${limit}&access_token=${accessToken}`;

    if (after) {
      url += `&after=${after}`;
    }

    logger.info('[FacebookAPI] Fetching leads by form', { formId, limit, after });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[FacebookAPI] Failed to fetch leads', {
        formId,
        status: response.status,
        error: errorData,
      });
      return null;
    }

    const data = await response.json() as any;

    logger.info('[FacebookAPI] Leads fetched successfully', {
      formId,
      leadCount: data.data?.length || 0,
      hasNext: !!data.paging?.next,
    });

    return data;
  } catch (error) {
    logger.error('[FacebookAPI] Error fetching leads by form', error);
    return null;
  }
}

/**
 * Test Facebook API connection and permissions
 *
 * @param accessToken - Page access token
 * @returns Test result with permissions and pages
 */
export async function testFacebookConnection(
  accessToken: string
): Promise<{
  success: boolean;
  user?: {
    id: string;
    name: string;
  };
  pages?: Array<{
    id: string;
    name: string;
    access_token: string;
  }>;
  permissions?: string[];
  error?: string;
}> {
  try {
    // Test token and get user info
    const meUrl = `${FACEBOOK_GRAPH_API_BASE}/me?fields=id,name&access_token=${accessToken}`;
    const meResponse = await fetch(meUrl);

    if (!meResponse.ok) {
      const errorData = await meResponse.json() as any;
      return {
        success: false,
        error: errorData.error?.message || 'Invalid access token',
      };
    }

    const userData = await meResponse.json() as any;

    // Get pages
    const pagesUrl = `${FACEBOOK_GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);

    let pages: any[] = [];
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json() as any;
      pages = pagesData.data || [];
    }

    // Get permissions
    const permissionsUrl = `${FACEBOOK_GRAPH_API_BASE}/me/permissions?access_token=${accessToken}`;
    const permissionsResponse = await fetch(permissionsUrl);

    let permissions: string[] = [];
    if (permissionsResponse.ok) {
      const permissionsData = await permissionsResponse.json() as any;
      permissions = (permissionsData.data || [])
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);
    }

    logger.info('[FacebookAPI] Connection test successful', {
      userId: userData.id,
      pageCount: pages.length,
      permissionCount: permissions.length,
    });

    return {
      success: true,
      user: userData,
      pages,
      permissions,
    };
  } catch (error) {
    logger.error('[FacebookAPI] Connection test failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send conversion event to Facebook Conversions API
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * @param pixelId - Facebook Pixel ID
 * @param accessToken - Conversions API access token
 * @param eventName - Event name (e.g., "Lead", "Purchase")
 * @param eventData - Event data
 */
export async function sendConversionEvent(
  pixelId: string,
  accessToken: string,
  eventName: string,
  eventData: {
    eventId?: string;
    eventTime?: number;
    userData?: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    customData?: Record<string, any>;
    actionSource: 'website' | 'email' | 'phone_call' | 'system_generated' | 'other';
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${FACEBOOK_GRAPH_API_BASE}/${pixelId}/events?access_token=${accessToken}`;

    const payload = {
      data: [
        {
          event_name: eventName,
          event_id: eventData.eventId || crypto.randomUUID(),
          event_time: eventData.eventTime || Math.floor(Date.now() / 1000),
          user_data: eventData.userData,
          custom_data: eventData.customData,
          action_source: eventData.actionSource,
        },
      ],
    };

    logger.info('[FacebookAPI] Sending conversion event', {
      pixelId,
      eventName,
      actionSource: eventData.actionSource,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[FacebookAPI] Failed to send conversion', {
        pixelId,
        eventName,
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send conversion',
      };
    }

    const result = await response.json() as any;

    logger.info('[FacebookAPI] Conversion event sent successfully', {
      pixelId,
      eventName,
      eventsReceived: result.events_received,
    });

    return { success: true };
  } catch (error) {
    logger.error('[FacebookAPI] Error sending conversion event', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
