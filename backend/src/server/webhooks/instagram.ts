/**
 * Instagram Lead Ads Webhook Handler
 *
 * Handles incoming lead data from Instagram Lead Generation ads
 * Note: Instagram uses the same webhook system as Facebook since it's part of Meta
 * https://developers.facebook.com/docs/instagram-api/guides/lead-ads
 */

import { createLogger } from '../utils/logger';
import { checkForDuplicate, registerLead } from '../utils/deduplication';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import { createOpportunityFromLead, syncQualificationScore } from '../workflows/opportunity-workflows';
import { getOrgIdForWebhook, scopedKey } from '../utils/webhook-routing';
import { fetchLeadData } from '../services/facebook-api'; // Instagram uses Facebook Graph API
import { verifyMetaSignature } from '../utils/webhook-verification';
import { checkAndMarkWebhookEvent } from '../utils/webhook-idempotency';

const logger = createLogger('InstagramWebhook');

export interface InstagramLeadField {
  name: string;
  values: string[];
}

export interface InstagramLeadData {
  id: string;
  created_time: string;
  field_data: InstagramLeadField[];
  ad_id: string;
  ad_name?: string;
  adset_id: string;
  adset_name?: string;
  campaign_id: string;
  campaign_name?: string;
  form_id: string;
  form_name?: string;
  page_id?: string;
  page_name?: string;
  platform: 'instagram'; // Distinguish from Facebook leads
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  changes: Array<{
    field: string;
    value: {
      ad_id: string;
      form_id: string;
      leadgen_id: string;
      created_time: number;
      page_id: string;
      adgroup_id: string;
      platform?: 'instagram'; // Meta may include this field
    };
  }>;
}

export interface InstagramWebhookPayload {
  object: 'page' | 'instagram' | 'leadgen';
  entry: InstagramWebhookEntry[];
}

/**
 * Verify Instagram webhook signature using HMAC-SHA256
 * Uses the same verification as Facebook since Instagram is part of Meta
 */
export async function verifyInstagramSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  return verifyMetaSignature(payload, signature, appSecret);
}

/**
 * Parse Instagram lead field data into structured contact info
 */
export function parseInstagramLeadFields(fields: InstagramLeadField[]): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const field of fields) {
    const name = field.name.toLowerCase();
    const value = field.values[0] || '';

    // Map common field names
    switch (name) {
      case 'full_name':
      case 'name':
        parsed.name = value;
        break;
      case 'email':
        parsed.email = value;
        break;
      case 'phone_number':
      case 'phone':
        parsed.phone = value;
        break;
      case 'company_name':
      case 'company':
        parsed.company = value;
        break;
      case 'city':
        parsed.city = value;
        break;
      case 'state':
        parsed.state = value;
        break;
      case 'country':
        parsed.country = value;
        break;
      case 'zip_code':
      case 'zip':
        parsed.zip = value;
        break;
      default:
        // Store custom fields
        if (!parsed.customFields) {
          parsed.customFields = {};
        }
        parsed.customFields[field.name] = value;
    }
  }

  return parsed;
}

/**
 * Handle Instagram webhook verification challenge
 */
export function handleInstagramVerification(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): Response | null {
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[InstagramWebhook] Webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  logger.warn('[InstagramWebhook] Webhook verification failed', {
    mode,
    tokenMatch: token === verifyToken,
  });

  return new Response('Forbidden', { status: 403 });
}

/**
 * Process Instagram lead webhook
 */
export async function handleInstagramWebhook(
  request: Request,
  env: any,
  ctx?: any
): Promise<Response> {
  // Handle GET request for webhook verification
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode && token && challenge) {
      const verification = handleInstagramVerification(
        mode,
        token,
        challenge,
        env.INSTAGRAM_VERIFY_TOKEN || env.FACEBOOK_VERIFY_TOKEN || 'dev-facebook-verify-token'
      );
      if (verification) return verification;
    }

    return new Response('Invalid verification request', { status: 400 });
  }

  // Handle POST request for webhook events
  if (request.method === 'POST') {
    try {
      // Rate limiting
      const clientId = getClientId(request);
      const rateLimitCheck = await checkRateLimit(
        env,
        clientId,
        'instagram-webhook',
        100, // 100 requests
        60 // per minute
      );

      if (!rateLimitCheck.allowed) {
        return rateLimitResponse(rateLimitCheck.retryAfter || 60);
      }

      // Verify signature
      const signature = request.headers.get('x-hub-signature-256');
      const body = await request.text();

      const appSecret = env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET || 'dev-facebook-app-secret';
      if (!signature || !appSecret) {
        logger.error('[InstagramWebhook] Missing signature or app secret');
        return new Response('Unauthorized', { status: 401 });
      }

      const isValid = await verifyInstagramSignature(
        body,
        signature,
        appSecret
      );

      if (!isValid) {
        logger.error('[InstagramWebhook] Invalid signature');
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse webhook payload
      const payload: InstagramWebhookPayload = JSON.parse(body);

      logger.info('[InstagramWebhook] Received webhook', {
        object: payload.object,
        entries: payload.entry?.length || 0,
      });

      const processEntries = async () => {
        // Process each entry
        for (const entry of payload.entry || []) {
          // Resolve org for this page (multi-tenant)
          const pageId = entry.id;
          const orgId = await getOrgIdForWebhook(env, 'instagram', pageId) || env.DEFAULT_WEBHOOK_ORG || 'default-org';

          for (const change of entry.changes || []) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id;
              const eventAccepted = await checkAndMarkWebhookEvent(
                env,
                'instagram',
                leadgenId
              );

              if (!eventAccepted) {
                logger.info('[InstagramWebhook] Duplicate event skipped', { leadgenId });
                continue;
              }

              try {
                // Fetch full lead data from Graph API
                const accessToken = env.INSTAGRAM_ACCESS_TOKEN || env.FACEBOOK_PAGE_ACCESS_TOKEN || 'dev-facebook-page-token';
                const leadData = await fetchLeadData(
                  leadgenId,
                  accessToken
                );

                if (!leadData) {
                  logger.warn('[InstagramWebhook] Could not fetch lead data', { leadgenId });
                  continue;
                }

                // Parse contact info
                const userDetails = parseInstagramLeadFields(leadData.field_data || []);
                const dupeCheck = await checkForDuplicate(
                  env,
                  userDetails.email,
                  userDetails.phone,
                  'instagram',
                  orgId
                );

                if (dupeCheck.isDuplicate) {
                  logger.info('[InstagramWebhook] Duplicate lead detected, skipping', {
                    leadgenId,
                    existingLeadId: dupeCheck.existingLeadId,
                  });
                  continue;
                }

                const scopedLeadId = scopedKey(
                  orgId,
                  `instagram-${leadData.id}-${leadData.form_id || change.value.form_id}`
                );

                let socialHubLeadId: string | null = null;
                let socialHubStub: any = null;
                if (env.SOCIAL_HUB_DO) {
                  const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
                  socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
                  const unifiedLead = await socialHubStub.upsertLead({
                    platform: 'instagram',
                    platformLeadId: leadData.id,
                    contact: {
                      name: userDetails.name,
                      email: userDetails.email,
                      phone: userDetails.phone,
                      company: userDetails.company,
                    },
                    platformMetadata: {
                      formId: leadData.form_id || change.value.form_id,
                      formName: (leadData as any).form_name,
                      campaignId: leadData.campaign_id,
                      campaignName: leadData.campaign_name,
                      adsetId: leadData.adset_id || change.value.adgroup_id,
                      adsetName: leadData.adset_name,
                      adId: leadData.ad_id || change.value.ad_id,
                      adName: leadData.ad_name,
                      pageId: (leadData as any).page_id || change.value.page_id,
                      pageName: (leadData as any).page_name,
                      platform: 'instagram',
                    },
                    platformCreatedAt: Date.parse(leadData.created_time),
                    rawPayload: JSON.stringify(leadData),
                  });
                  socialHubLeadId = unifiedLead.id;
                }

                // Register lead to prevent duplicates
                await registerLead(env, scopedLeadId, userDetails.email, userDetails.phone, 'instagram', orgId);

                // Create opportunity workflow
                const opportunityResult = await createOpportunityFromLead(env, {
                  leadId: scopedLeadId,
                  orgId,
                  source: 'instagram',
                  sourceMetadata: {
                    platform: 'instagram',
                    contactEmail: userDetails.email,
                    contactName: userDetails.name,
                    contactPhone: userDetails.phone,
                  },
                });

                if (opportunityResult.success) {
                  // Sync default qualification score
                  await syncQualificationScore(env, opportunityResult.opportunityId, 50, false);
                }

                // Best-effort contact linking in SocialHub when ContactDO is available.
                if (socialHubStub && socialHubLeadId && env.CONTACT_DO) {
                  const contactDoId = env.CONTACT_DO.idFromName(orgId);
                  const contactStub = env.CONTACT_DO.get(contactDoId);
                  const contact = await contactStub.findContactByEmailOrPhone(
                    userDetails.email,
                    userDetails.phone
                  );
                  if (contact?.id) {
                    await socialHubStub.linkContact(socialHubLeadId, contact.id);
                  }
                }

                logger.info('[InstagramWebhook] Lead processed successfully', {
                  leadId: scopedLeadId,
                  email: userDetails.email,
                });
              } catch (error) {
                logger.error('[InstagramWebhook] Error processing lead', {
                  leadgenId,
                  error,
                });
              }
            }
          }
        }
      };

      const asyncEnabled = env.WEBHOOK_ASYNC_PROCESSING === 'true';
      if (asyncEnabled && ctx?.waitUntil) {
        ctx.waitUntil(
          processEntries().catch((error: unknown) => {
            logger.error('[InstagramWebhook] Async processing failed', { error });
          })
        );
        return new Response('EVENT_ACCEPTED', { status: 202 });
      }

      await processEntries();
      return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error) {
      logger.error('[InstagramWebhook] Error processing webhook', { error });
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
