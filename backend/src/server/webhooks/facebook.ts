/**
 * Facebook Lead Ads Webhook Handler
 *
 * Handles incoming lead data from Facebook Lead Generation ads
 * https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
 *
 * Multi-tenant: Uses org-scoped DO keys for data isolation
 */

import { createLogger } from '../utils/logger';
import { linkLeadToContact } from '../utils/lead-contact-linker';
import { checkForDuplicate, registerLead } from '../utils/deduplication';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import { createOpportunityFromLead, syncQualificationScore } from '../workflows/opportunity-workflows';
import { fetchLeadData } from '../services/facebook-api';
import { getOrgIdForWebhook, scopedKey } from '../utils/webhook-routing';
import { verifyMetaSignature } from '../utils/webhook-verification';
import { checkAndMarkWebhookEvent } from '../utils/webhook-idempotency';

const logger = createLogger('FacebookWebhook');

export interface FacebookLeadField {
  name: string;
  values: string[];
}

export interface FacebookLeadData {
  id: string;
  created_time: string;
  field_data: FacebookLeadField[];
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
}

export interface FacebookWebhookEntry {
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
    };
  }>;
}

export interface FacebookWebhookPayload {
  object: 'page' | 'leadgen';
  entry: FacebookWebhookEntry[];
}

/**
 * Verify Facebook webhook signature using HMAC-SHA256
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export async function verifyFacebookSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  return verifyMetaSignature(payload, signature, appSecret);
}

/**
 * Extract contact information from Facebook lead field data
 */
export function extractContactInfo(fieldData: FacebookLeadField[]): {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  customFields: Record<string, string>;
} {
  const result: any = {
    customFields: {},
  };

  for (const field of fieldData) {
    const fieldName = field.name.toLowerCase();
    const value = field.values[0] || '';

    // Standard fields
    switch (fieldName) {
      case 'full_name':
        result.name = value;
        break;
      case 'first_name':
        result.firstName = value;
        break;
      case 'last_name':
        result.lastName = value;
        break;
      case 'email':
        result.email = value;
        break;
      case 'phone_number':
      case 'phone':
        result.phone = value;
        break;
      case 'company_name':
      case 'company':
        result.company = value;
        break;
      case 'city':
        result.city = value;
        break;
      case 'state':
      case 'province':
        result.state = value;
        break;
      case 'country':
        result.country = value;
        break;
      case 'zip_code':
      case 'zip':
      case 'postal_code':
        result.zip = value;
        break;
      default:
        // Store as custom field
        result.customFields[field.name] = value;
    }
  }

  // Construct full name if not provided
  if (!result.name && (result.firstName || result.lastName)) {
    result.name = [result.firstName, result.lastName].filter(Boolean).join(' ');
  }

  return result;
}

/**
 * Extract BANT data from custom fields
 */
export function extractBANTData(customFields: Record<string, string>): any {
  const bant: any = {};

  // Check for budget indicators
  const budgetFields = ['budget', 'budget_range', 'investment_range'];
  for (const field of budgetFields) {
    if (customFields[field]) {
      bant.budget = {
        range: customFields[field],
        qualified: true,
        confidence: 0.7,
        extractedAt: Date.now(),
      };
      break;
    }
  }

  // Check for timeline indicators
  const timelineFields = ['timeline', 'timeframe', 'when_needed', 'purchase_timeline'];
  for (const field of timelineFields) {
    if (customFields[field]) {
      bant.timeline = {
        range: customFields[field],
        confidence: 0.7,
        extractedAt: Date.now(),
      };
      break;
    }
  }

  // Check for need/problem indicators
  const needFields = ['problem', 'need', 'pain_point', 'challenge', 'goal'];
  for (const field of needFields) {
    if (customFields[field]) {
      bant.need = {
        description: customFields[field],
        urgency: 'medium',
        painPoints: [customFields[field]],
        confidence: 0.7,
        extractedAt: Date.now(),
      };
      break;
    }
  }

  // Check for authority indicators
  const authorityFields = ['job_title', 'role', 'position'];
  for (const field of authorityFields) {
    if (customFields[field]) {
      const role = customFields[field].toLowerCase();
      const isDecisionMaker =
        role.includes('ceo') ||
        role.includes('founder') ||
        role.includes('owner') ||
        role.includes('president') ||
        role.includes('director') ||
        role.includes('vp') ||
        role.includes('vice president') ||
        role.includes('chief');

      bant.authority = {
        role: isDecisionMaker ? 'decision_maker' : 'influencer',
        canApprove: isDecisionMaker,
        confidence: 0.6,
        extractedAt: Date.now(),
      };
      break;
    }
  }

  return bant;
}

/**
 * Process Facebook lead and create LeadQualificationDO
 * Multi-tenant: All DOs are scoped by orgId
 */
export async function processFacebookLead(
  leadData: FacebookLeadData,
  env: any,
  orgId: string
): Promise<{
  leadId: string;
  processed: boolean;
  error?: string;
}> {
  try {
    // Generate unique lead ID
    const leadId = `facebook-${leadData.id}-${leadData.form_id}`;
    // Org-scoped key for multi-tenant isolation
    const scopedLeadId = scopedKey(orgId, leadId);

    logger.info('[FacebookWebhook] Processing lead', {
      leadId,
      orgId,
      scopedLeadId,
      formId: leadData.form_id,
      campaignName: leadData.campaign_name,
    });

    // Extract contact information
    const contactInfo = extractContactInfo(leadData.field_data);
    let socialHubLeadId: string | null = null;
    let socialHubStub: any = null;

    // Upsert into unified SocialHub lead storage for 360 customer visibility
    if (env.SOCIAL_HUB_DO) {
      const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
      socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
      const unifiedLead = await socialHubStub.upsertLead({
        platform: 'facebook',
        platformLeadId: leadData.id,
        contact: {
          name: contactInfo.name,
          email: contactInfo.email,
          phone: contactInfo.phone,
          company: contactInfo.company,
        },
        platformMetadata: {
          formId: leadData.form_id,
          formName: leadData.form_name,
          campaignId: leadData.campaign_id,
          campaignName: leadData.campaign_name,
          adsetId: leadData.adset_id,
          adsetName: leadData.adset_name,
          adId: leadData.ad_id,
          adName: leadData.ad_name,
          pageId: leadData.page_id,
          pageName: leadData.page_name,
          createdTime: leadData.created_time,
        },
        platformCreatedAt: Date.parse(leadData.created_time),
        rawPayload: JSON.stringify(leadData),
      });
      socialHubLeadId = unifiedLead.id;
    }

    // Check for duplicates (using scoped key)
    const dupeCheck = await checkForDuplicate(
      env,
      contactInfo.email,
      contactInfo.phone,
      'facebook',
      orgId
    );

    if (dupeCheck.isDuplicate) {
      logger.info('[FacebookWebhook] Duplicate lead skipped', {
        leadId,
        existingLeadId: dupeCheck.existingLeadId,
      });
      return {
        leadId: dupeCheck.existingLeadId!,
        processed: true,
      };
    }

    // Get or create LeadQualificationDO (org-scoped)
    const leadQualification = env.LEAD_QUALIFICATION_DO || env.LEAD_QUALIFICATION;
    if (!leadQualification) {
      throw new Error('LeadQualificationDO binding not configured');
    }
    const qualificationId = leadQualification.idFromName(scopedLeadId);
    const qualificationDO = leadQualification.get(qualificationId);

    // Update contact info
    await qualificationDO.fetch(
      new Request('https://internal/updateContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactInfo.name,
          email: contactInfo.email,
          phone: contactInfo.phone,
          company: contactInfo.company,
        }),
      })
    );

    // Get or create EnhancedConversationDO (org-scoped)
    const conversationId = env.ENHANCED_CONVERSATION.idFromName(scopedLeadId);
    const conversationDO = env.ENHANCED_CONVERSATION.get(conversationId);

    // Initialize conversation with Facebook source metadata
    await conversationDO.fetch(
      new Request('https://internal/processMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'system',
          content: `New lead from Facebook campaign: ${leadData.campaign_name || 'Unknown'}`,
          metadata: {
            source: 'facebook',
            formId: leadData.form_id,
            formName: leadData.form_name,
            campaignId: leadData.campaign_id,
            campaignName: leadData.campaign_name,
            adsetId: leadData.adset_id,
            adsetName: leadData.adset_name,
            adId: leadData.ad_id,
            adName: leadData.ad_name,
          },
        }),
      })
    );

    // Extract and update BANT data
    const bant = extractBANTData(contactInfo.customFields);
    if (Object.keys(bant).length > 0) {
      await qualificationDO.fetch(
        new Request('https://internal/updateBANT', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bant),
        })
      );
    }

    // Create Opportunity (org-scoped)
    const opportunityResult = await createOpportunityFromLead(env, {
      leadId: scopedLeadId,
      orgId,
      source: 'facebook',
      sourceMetadata: {
        formId: leadData.form_id,
        formName: leadData.form_name,
        campaignId: leadData.campaign_id,
        campaignName: leadData.campaign_name,
        adsetId: leadData.adset_id,
        adsetName: leadData.adset_name,
        adId: leadData.ad_id,
        adName: leadData.ad_name,
        leadgenId: leadData.id,
        createdTime: leadData.created_time,
      },
    });

    if (opportunityResult.success) {
      // Get qualification state and sync score
      const qualificationResponse = await qualificationDO.fetch(
        new Request('https://internal/getState', { method: 'GET' })
      );
      const qualificationState = await qualificationResponse.json();

      await syncQualificationScore(
        env,
        opportunityResult.opportunityId,
        qualificationState.score.total,
        qualificationState.classification === 'qualified'
      );

      logger.info('[FacebookWebhook] Opportunity created', {
        leadId,
        orgId,
        opportunityId: opportunityResult.opportunityId,
      });
    }

    // Register lead in deduplication store (org-scoped)
    await registerLead(
      env,
      scopedLeadId,
      contactInfo.email,
      contactInfo.phone,
      'facebook',
      orgId
    );

    // Auto-link lead to contact (or create new contact)
    const linkResult = await linkLeadToContact(env, orgId, scopedLeadId, {
      name: contactInfo.name,
      email: contactInfo.email,
      phone: contactInfo.phone,
      company: contactInfo.company,
      source: 'facebook',
    }, { campaignName: leadData.campaign_name, formName: leadData.form_name });

    if (socialHubStub && socialHubLeadId && linkResult?.contactId) {
      await socialHubStub.linkContact(socialHubLeadId, linkResult.contactId);
    }

    logger.info('[FacebookWebhook] Lead processed successfully', { leadId, orgId, scopedLeadId });

    return {
      leadId,
      processed: true,
    };
  } catch (error) {
    logger.error('[FacebookWebhook] Failed to process lead', error);
    return {
      leadId: `facebook-${leadData.id}`,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle Facebook webhook verification (GET request)
 */
export function handleFacebookVerification(request: Request, env: any): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = env.FACEBOOK_VERIFY_TOKEN || 'dev-facebook-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[FacebookWebhook] Webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  logger.warn('[FacebookWebhook] Webhook verification failed', { mode, token });
  return new Response('Forbidden', { status: 403 });
}

/**
 * Handle Facebook webhook request
 */
export async function handleFacebookWebhook(
  request: Request,
  env: any,
  ctx?: any
): Promise<Response> {
  try {
    // Handle verification (GET)
    if (request.method === 'GET') {
      return handleFacebookVerification(request, env);
    }

    // Handle webhook events (POST)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check rate limit (allow 100 requests per minute per IP)
    const clientId = getClientId(request);
    const rateLimit = await checkRateLimit(
      env,
      clientId,
      '/webhooks/facebook',
      100,
      60
    );

    if (!rateLimit.allowed) {
      logger.warn('[FacebookWebhook] Rate limit exceeded', { clientId });
      return rateLimitResponse(rateLimit.retryAfter || 60);
    }

    // Get signature from header
    const signature =
      request.headers.get('X-Hub-Signature-256') ||
      request.headers.get('X-Hub-Signature') ||
      '';

    // Read body
    const body = await request.text();

    // Verify signature
    const appSecret = env.FACEBOOK_APP_SECRET || 'dev-facebook-app-secret';
    const isValid = await verifyFacebookSignature(body, signature, appSecret);

    if (!isValid) {
      logger.warn('[FacebookWebhook] Invalid signature');
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse payload
    let payload: FacebookWebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      logger.error('[FacebookWebhook] Invalid JSON payload', error);
      return new Response('Invalid payload', { status: 400 });
    }

    logger.info('[FacebookWebhook] Received webhook', {
      object: payload.object,
      entries: payload.entry?.length || 0,
    });

    const processEntries = async (): Promise<any[]> => {
      const results: any[] = [];

      for (const entry of payload.entry || []) {
        // Get organization ID from webhook routing (multi-tenant)
        // entry.id is the page_id for leadgen webhooks
        const pageId = entry.id;
        const orgId = await getOrgIdForWebhook(env, 'facebook', pageId);

        if (!orgId) {
          logger.error('[FacebookWebhook] No organization found for page_id', {
            pageId,
          });
          results.push({
            status: 'error',
            error: 'Organization not configured for this Facebook page',
          });
          continue;
        }

        logger.info('[FacebookWebhook] Routing to organization', { orgId, pageId });

        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id;
            const eventAccepted = await checkAndMarkWebhookEvent(
              env,
              'facebook',
              leadgenId
            );

            if (!eventAccepted) {
              logger.info('[FacebookWebhook] Duplicate event skipped', { leadgenId });
              results.push({
                leadgen_id: leadgenId,
                status: 'duplicate',
              });
              continue;
            }

            logger.info('[FacebookWebhook] Lead event received', {
              leadgenId,
              formId: change.value.form_id,
              adId: change.value.ad_id,
              orgId,
            });

            // Fetch full lead data from Facebook API
            const accessToken =
              env.FACEBOOK_PAGE_ACCESS_TOKEN || 'dev-facebook-page-token';
            const leadData = await fetchLeadData(leadgenId, accessToken);

            if (!leadData) {
              logger.error('[FacebookWebhook] Failed to fetch lead data', {
                leadgenId,
              });
              results.push({
                leadgen_id: leadgenId,
                status: 'error',
                error: 'Failed to fetch lead data from Facebook API',
              });
              continue;
            }

            // Process the lead with org-scoped isolation
            const processResult = await processFacebookLead(leadData, env, orgId);

            results.push({
              leadgen_id: leadgenId,
              lead_id: processResult.leadId,
              status: processResult.processed ? 'success' : 'error',
              error: processResult.error,
            });
          }
        }
      }

      return results;
    };

    const asyncEnabled = env.WEBHOOK_ASYNC_PROCESSING === 'true';
    if (asyncEnabled && ctx?.waitUntil) {
      ctx.waitUntil(
        processEntries().catch((error: unknown) => {
          logger.error('[FacebookWebhook] Async processing failed', error);
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          accepted: true,
          queued: payload.entry?.length || 0,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const results = await processEntries();

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('[FacebookWebhook] Webhook handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
