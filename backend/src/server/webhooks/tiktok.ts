/**
 * TikTok Lead Generation Webhook Handler
 *
 * Handles incoming lead data from TikTok Lead Generation API
 * https://business-api.tiktok.com/portal/docs?id=1747719780398082
 *
 * Multi-tenant: Uses org-scoped DO keys for data isolation
 */

import { createLogger } from '../utils/logger';
import { linkLeadToContact } from '../utils/lead-contact-linker';
import { createOpportunityFromLead, syncQualificationScore } from '../workflows/opportunity-workflows';
import { checkForDuplicate, registerLead } from '../utils/deduplication';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import { getOrgIdForWebhook, scopedKey } from '../utils/webhook-routing';
import { verifyTikTokSignature as verifyTikTokSignatureUtil } from '../utils/webhook-verification';
import { checkAndMarkWebhookEvent } from '../utils/webhook-idempotency';

const logger = createLogger('TikTokWebhook');

export interface TikTokLead {
  event_id: string;
  event_time: number;
  event_type: 'FORM_SUBMIT';
  form_id: string;
  form_name: string;
  ad_id: string;
  ad_name?: string;
  campaign_id: string;
  campaign_name?: string;
  creative_id: string;
  page_id: string;
  page_name?: string;
  user_details: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    custom_fields?: Record<string, string>;
  };
}

export interface TikTokWebhookPayload {
  event: 'lead.create' | 'lead.update';
  timestamp: number;
  leads: TikTokLead[];
  page_id: string;
  page_name?: string;
}

/**
 * Verify TikTok webhook signature using Web Crypto API
 */
export async function verifyTikTokSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  return verifyTikTokSignatureUtil(payload, signature, secret);
}

/**
 * Process TikTok lead and create LeadQualificationDO
 * Multi-tenant: All DOs are scoped by orgId
 */
export async function processTikTokLead(
  lead: TikTokLead,
  env: any,
  orgId: string
): Promise<{
  leadId: string;
  processed: boolean;
  error?: string;
}> {
  try {
    // Generate unique lead ID
    const leadId = `tiktok-${lead.event_id}-${lead.form_id}`;
    // Org-scoped key for multi-tenant isolation
    const scopedLeadId = scopedKey(orgId, leadId);

    logger.info('[TikTokWebhook] Processing lead', {
      leadId,
      orgId,
      scopedLeadId,
      formName: lead.form_name,
      campaignName: lead.campaign_name
    });

    // Get or create LeadQualificationDO (org-scoped)
    const leadQualification = env.LEAD_QUALIFICATION_DO || env.LEAD_QUALIFICATION;
    if (!leadQualification) {
      throw new Error('LeadQualificationDO binding not configured');
    }
    const qualificationId = leadQualification.idFromName(scopedLeadId);
    const qualificationDO = leadQualification.get(qualificationId);

    // Extract contact information
    const contactData = {
      name: lead.user_details.name,
      email: lead.user_details.email,
      phone: lead.user_details.phone,
      company: lead.user_details.company
    };

    let socialHubLeadId: string | null = null;
    let socialHubStub: any = null;

    // Upsert into unified SocialHub lead storage for 360 customer visibility
    if (env.SOCIAL_HUB_DO) {
      const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
      socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
      const unifiedLead = await socialHubStub.upsertLead({
        platform: 'tiktok',
        platformLeadId: lead.event_id,
        contact: contactData,
        platformMetadata: {
          formId: lead.form_id,
          formName: lead.form_name,
          campaignId: lead.campaign_id,
          campaignName: lead.campaign_name,
          adId: lead.ad_id,
          adName: lead.ad_name,
          creativeId: lead.creative_id,
          pageId: lead.page_id,
          pageName: lead.page_name,
          eventId: lead.event_id,
        },
        platformCreatedAt: lead.event_time,
        rawPayload: JSON.stringify(lead),
      });
      socialHubLeadId = unifiedLead.id;
    }

    // Update contact info
    await qualificationDO.updateContact(contactData);

    // Get or create EnhancedConversationDO for this lead (org-scoped)
    const conversationId = env.ENHANCED_CONVERSATION.idFromName(scopedLeadId);
    const conversationDO = env.ENHANCED_CONVERSATION.get(conversationId);

    // Initialize conversation with TikTok source metadata
    await conversationDO.processMessage('system',
      `New lead from TikTok campaign: ${lead.campaign_name || 'Unknown'}`,
      {
        source: 'tiktok',
        formId: lead.form_id,
        formName: lead.form_name,
        campaignId: lead.campaign_id,
        campaignName: lead.campaign_name,
        adId: lead.ad_id,
        adName: lead.ad_name,
        creativeId: lead.creative_id
      }
    );

    // Extract initial BANT data from custom fields if available
    if (lead.user_details.custom_fields) {
      const customFields = lead.user_details.custom_fields;
      const bant: any = {};

      // Check for budget indicators
      if (customFields.budget || customFields.budget_range) {
        bant.budget = {
          range: customFields.budget_range || customFields.budget,
          qualified: true,
          confidence: 0.7, // Lower confidence from form data
          extractedAt: Date.now()
        };
      }

      // Check for timeline indicators
      if (customFields.timeline || customFields.when_needed) {
        bant.timeline = {
          range: customFields.timeline || customFields.when_needed,
          confidence: 0.7,
          extractedAt: Date.now()
        };
      }

      // Check for need/problem indicators
      if (customFields.problem || customFields.need || customFields.pain_point) {
        bant.need = {
          description: customFields.problem || customFields.need || customFields.pain_point,
          urgency: 'medium',
          painPoints: [customFields.problem || customFields.need || customFields.pain_point],
          confidence: 0.7,
          extractedAt: Date.now()
        };
      }

      // Check for role/authority indicators
      if (customFields.role || customFields.job_title) {
        const role = (customFields.role || customFields.job_title).toLowerCase();
        const isDecisionMaker =
          role.includes('ceo') ||
          role.includes('founder') ||
          role.includes('owner') ||
          role.includes('president') ||
          role.includes('director');

        bant.authority = {
          role: isDecisionMaker ? 'decision_maker' : 'influencer',
          canApprove: isDecisionMaker,
          confidence: 0.6,
          extractedAt: Date.now()
        };
      }

      // Update BANT if we extracted anything
      if (Object.keys(bant).length > 0) {
        await qualificationDO.updateBANT(bant);
      }
    }

    // Create Opportunity (org-scoped)
    const opportunityResult = await createOpportunityFromLead(env, {
      leadId: scopedLeadId,
      orgId,
      source: 'tiktok',
      sourceMetadata: {
        formId: lead.form_id,
        formName: lead.form_name,
        campaignId: lead.campaign_id,
        campaignName: lead.campaign_name,
        adId: lead.ad_id,
        adName: lead.ad_name,
        creativeId: lead.creative_id,
        videoId: lead.creative_id,
        eventId: lead.event_id
      }
    });

    if (opportunityResult.success) {
      // Sync qualification score to opportunity
      const qualificationState = await qualificationDO.getState();
      await syncQualificationScore(
        env,
        opportunityResult.opportunityId,
        qualificationState.score.total,
        qualificationState.classification === 'qualified'
      );

      logger.info('[TikTokWebhook] Opportunity created', {
        leadId,
        opportunityId: opportunityResult.opportunityId
      });
    }

    // Register lead in deduplication store (org-scoped)
    await registerLead(
      env,
      scopedLeadId,
      lead.user_details.email,
      lead.user_details.phone,
      'tiktok',
      orgId
    );

    // Auto-link lead to contact (or create new contact)
    const linkResult = await linkLeadToContact(env, orgId, scopedLeadId, {
      name: lead.user_details.name,
      email: lead.user_details.email,
      phone: lead.user_details.phone,
      company: lead.user_details.company,
      source: 'tiktok',
    }, { campaignName: lead.campaign_name, formName: lead.form_name });

    if (socialHubStub && socialHubLeadId && linkResult?.contactId) {
      await socialHubStub.linkContact(socialHubLeadId, linkResult.contactId);
    }

    logger.info('[TikTokWebhook] Lead processed successfully', { leadId, orgId, scopedLeadId });

    return {
      leadId,
      processed: true
    };

  } catch (error) {
    logger.error('[TikTokWebhook] Failed to process lead', error);
    return {
      leadId: `tiktok-${lead.event_id}`,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Deduplicate lead based on email or phone using KV namespace
 */
export async function deduplicateLead(
  lead: TikTokLead,
  env: any,
  orgId?: string
): Promise<{
  isDuplicate: boolean;
  existingLeadId?: string;
}> {
  const email = lead.user_details.email;
  const phone = lead.user_details.phone;

  if (!email && !phone) {
    return { isDuplicate: false };
  }

  // Use deduplication utility with KV namespace
  const result = await checkForDuplicate(env, email, phone, 'tiktok', orgId);

  return {
    isDuplicate: result.isDuplicate,
    existingLeadId: result.existingLeadId
  };
}

/**
 * Handle TikTok webhook request
 */
export async function handleTikTokWebhook(
  request: Request,
  env: any,
  ctx?: any
): Promise<Response> {
  try {
    // Verify method
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check rate limit (allow 60 requests per minute per IP)
    const clientId = getClientId(request);
    const rateLimit = await checkRateLimit(env, clientId, '/webhooks/tiktok', 60, 60);

    if (!rateLimit.allowed) {
      logger.warn('[TikTokWebhook] Rate limit exceeded', { clientId });
      return rateLimitResponse(rateLimit.retryAfter || 60);
    }

    // Get signature from header
    const signature = request.headers.get('X-TikTok-Signature') ||
                     request.headers.get('X-Hub-Signature-256') || '';

    // Read body
    const body = await request.text();

    // Verify signature
    const webhookSecret = env.TIKTOK_WEBHOOK_SECRET || 'dev-secret';
    const isValid = await verifyTikTokSignature(body, signature, webhookSecret);

    if (!isValid) {
      logger.warn('[TikTokWebhook] Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse payload
    let payload: TikTokWebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      logger.error('[TikTokWebhook] Invalid JSON payload', error);
      return new Response('Invalid payload', { status: 400 });
    }

    logger.info('[TikTokWebhook] Received webhook', {
      event: payload.event,
      leadCount: payload.leads?.length || 0,
      pageId: payload.page_id
    });

    // Get organization ID from webhook routing (multi-tenant)
    const orgId = await getOrgIdForWebhook(env, 'tiktok', payload.page_id);
    if (!orgId) {
      logger.error('[TikTokWebhook] No organization found for page_id', {
        pageId: payload.page_id
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Organization not configured for this TikTok page'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('[TikTokWebhook] Routing to organization', { orgId, pageId: payload.page_id });

    const processLeads = async () => Promise.all(
      (payload.leads || []).map(async (lead) => {
        const eventAccepted = await checkAndMarkWebhookEvent(
          env,
          'tiktok',
          lead.event_id
        );

        if (!eventAccepted) {
          logger.info('[TikTokWebhook] Duplicate event skipped', {
            eventId: lead.event_id,
          });
          return {
            lead_id: `tiktok-${lead.event_id}-${lead.form_id}`,
            status: 'duplicate'
          };
        }

        // Check for duplicates
        const dupeCheck = await deduplicateLead(lead, env, orgId);
        if (dupeCheck.isDuplicate) {
          logger.info('[TikTokWebhook] Duplicate lead skipped', {
            leadId: dupeCheck.existingLeadId
          });
          return {
            lead_id: dupeCheck.existingLeadId,
            status: 'duplicate'
          };
        }

        // Process lead with org-scoped isolation
        const result = await processTikTokLead(lead, env, orgId);
        return {
          lead_id: result.leadId,
          status: result.processed ? 'success' : 'error',
          error: result.error
        };
      })
    );

    const asyncEnabled = env.WEBHOOK_ASYNC_PROCESSING === 'true';
    if (asyncEnabled && ctx?.waitUntil) {
      ctx.waitUntil(
        processLeads().catch((error: unknown) => {
          logger.error('[TikTokWebhook] Async processing failed', error);
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          accepted: true,
          queued: payload.leads?.length || 0,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const results = await processLeads();

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('[TikTokWebhook] Webhook handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
