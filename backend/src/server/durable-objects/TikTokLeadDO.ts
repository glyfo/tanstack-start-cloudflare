/**
 * TikTokLeadDO - Manages leads captured from TikTok Lead Generation API
 *
 * Responsibilities:
 * - Store TikTok lead data (form responses, metadata)
 * - Track lead source (video_id, campaign_id, creative_id)
 * - Deduplicate leads across channels
 * - Link to LeadQualificationDO for scoring
 * - Store webhook payload history
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("TikTokLeadDO");

export interface TikTokFormField {
  field_name: string;
  field_value: string;
}

export interface TikTokLeadSource {
  videoId?: string;
  videoTitle?: string;
  campaignId?: string;
  campaignName?: string;
  creativeId?: string;
  creativeName?: string;
  adGroupId?: string;
  adGroupName?: string;
}

export interface TikTokLeadData {
  leadId: string;                    // TikTok's lead ID
  organizationId: string;            // Our organization ID

  // Form fields
  formFields: TikTokFormField[];

  // Extracted contact info
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };

  // Source metadata
  source: TikTokLeadSource;

  // Status
  status: 'new' | 'processing' | 'qualified' | 'contacted' | 'converted' | 'duplicate' | 'invalid';

  // Deduplication
  isDuplicate: boolean;
  duplicateOfLeadId?: string;

  // Integration
  qualificationDOId?: string;       // Link to LeadQualificationDO
  contactDOId?: string;              // Link to ContactDO
  conversationId?: string;           // Link to conversation session

  // Timestamps
  tiktokCreatedAt: number;          // When TikTok created the lead
  receivedAt: number;                // When we received the webhook
  processedAt?: number;              // When we processed the lead

  // Metadata
  rawPayload: string;                // Original webhook payload (JSON)
  webhookAttempts: number;           // Number of webhook delivery attempts
  lastWebhookAt: number;             // Last webhook timestamp

  createdAt: number;
  updatedAt: number;
}

/**
 * TikTokLeadDO - One instance per TikTok lead
 */
export class TikTokLeadDO {
  private sql: SqlStorage;
  private leadId: string;

  constructor(ctx: any) {
    this.sql = ctx.storage.sql;
    this.leadId = ctx.id.toString();
    this.initializeSchema();
    logger.info(`[TikTokLeadDO] Initialized: ${this.leadId}`);
  }

  private initializeSchema(): void {
    // Main lead data table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS tiktok_lead (
        id TEXT PRIMARY KEY DEFAULT 'current',
        lead_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,

        -- Contact info
        name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,

        -- Source metadata
        video_id TEXT,
        video_title TEXT,
        campaign_id TEXT,
        campaign_name TEXT,
        creative_id TEXT,
        creative_name TEXT,
        ad_group_id TEXT,
        ad_group_name TEXT,

        -- Status
        status TEXT NOT NULL DEFAULT 'new',
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of_lead_id TEXT,

        -- Integration IDs
        qualification_do_id TEXT,
        contact_do_id TEXT,
        conversation_id TEXT,

        -- Timestamps
        tiktok_created_at INTEGER NOT NULL,
        received_at INTEGER NOT NULL,
        processed_at INTEGER,

        -- Metadata
        raw_payload TEXT NOT NULL,
        webhook_attempts INTEGER DEFAULT 1,
        last_webhook_at INTEGER NOT NULL,

        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Form fields table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS form_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_name TEXT NOT NULL,
        field_value TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Index for deduplication
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_email ON tiktok_lead(email)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_phone ON tiktok_lead(phone)
    `);

    logger.info(`[TikTokLeadDO] Schema initialized`);
  }

  /**
   * Create or update lead from TikTok webhook
   */
  async upsertLead(payload: {
    leadId: string;
    organizationId: string;
    formFields: TikTokFormField[];
    source: TikTokLeadSource;
    tiktokCreatedAt: number;
    rawPayload: any;
  }): Promise<TikTokLeadData> {
    const now = Date.now();

    // Extract contact info from form fields
    const contact = this.extractContactInfo(payload.formFields);

    // Check for existing lead
    const existing = this.sql.exec(`
      SELECT id FROM tiktok_lead WHERE id = 'current'
    `).toArray();

    if (existing.length > 0) {
      // Update existing lead (webhook retry)
      this.sql.exec(`
        UPDATE tiktok_lead
        SET
          webhook_attempts = webhook_attempts + 1,
          last_webhook_at = ?,
          updated_at = unixepoch()
        WHERE id = 'current'
      `, now);

      logger.info(`[TikTokLeadDO] Webhook retry`, {
        leadId: this.leadId,
        attempts: Number(existing[0].webhook_attempts) + 1
      });
    } else {
      // Insert new lead
      this.sql.exec(`
        INSERT INTO tiktok_lead (
          id, lead_id, organization_id,
          name, email, phone, company,
          video_id, video_title, campaign_id, campaign_name,
          creative_id, creative_name, ad_group_id, ad_group_name,
          status, tiktok_created_at, received_at,
          raw_payload, last_webhook_at
        ) VALUES (
          'current', ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          'new', ?, ?,
          ?, ?
        )
      `,
        payload.leadId,
        payload.organizationId,
        contact.name || null,
        contact.email || null,
        contact.phone || null,
        contact.company || null,
        payload.source.videoId || null,
        payload.source.videoTitle || null,
        payload.source.campaignId || null,
        payload.source.campaignName || null,
        payload.source.creativeId || null,
        payload.source.creativeName || null,
        payload.source.adGroupId || null,
        payload.source.adGroupName || null,
        payload.tiktokCreatedAt,
        now,
        JSON.stringify(payload.rawPayload),
        now
      );

      // Insert form fields
      for (const field of payload.formFields) {
        this.sql.exec(`
          INSERT INTO form_fields (field_name, field_value)
          VALUES (?, ?)
        `, field.field_name, field.field_value);
      }

      logger.info(`[TikTokLeadDO] Lead created`, {
        leadId: this.leadId,
        email: contact.email,
        phone: contact.phone
      });
    }

    return this.getData();
  }

  /**
   * Extract contact information from form fields
   */
  private extractContactInfo(fields: TikTokFormField[]): {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  } {
    const contact: any = {};

    for (const field of fields) {
      const name = field.field_name.toLowerCase();
      const value = field.field_value.trim();

      // Match common field names
      if (name.includes('email') || name.includes('e-mail')) {
        contact.email = value;
      } else if (name.includes('phone') || name.includes('mobile') || name.includes('tel')) {
        contact.phone = value;
      } else if (name.includes('name') && !name.includes('company')) {
        contact.name = value;
      } else if (name.includes('company') || name.includes('business') || name.includes('organization')) {
        contact.company = value;
      }
    }

    return contact;
  }

  /**
   * Mark lead as duplicate
   */
  async markDuplicate(duplicateOfLeadId: string): Promise<TikTokLeadData> {
    this.sql.exec(`
      UPDATE tiktok_lead
      SET
        status = 'duplicate',
        is_duplicate = 1,
        duplicate_of_lead_id = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `, duplicateOfLeadId);

    logger.info(`[TikTokLeadDO] Marked as duplicate`, {
      leadId: this.leadId,
      duplicateOf: duplicateOfLeadId
    });

    return this.getData();
  }

  /**
   * Update status
   */
  async updateStatus(status: TikTokLeadData['status']): Promise<TikTokLeadData> {
    this.sql.exec(`
      UPDATE tiktok_lead
      SET status = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `, status);

    logger.info(`[TikTokLeadDO] Status updated`, {
      leadId: this.leadId,
      status
    });

    return this.getData();
  }

  /**
   * Link to qualification DO
   */
  async linkQualificationDO(qualificationDOId: string): Promise<TikTokLeadData> {
    this.sql.exec(`
      UPDATE tiktok_lead
      SET
        qualification_do_id = ?,
        status = 'processing',
        processed_at = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `, qualificationDOId, Date.now());

    logger.info(`[TikTokLeadDO] Linked to qualification DO`, {
      leadId: this.leadId,
      qualificationDOId
    });

    return this.getData();
  }

  /**
   * Link to contact DO
   */
  async linkContactDO(contactDOId: string): Promise<TikTokLeadData> {
    this.sql.exec(`
      UPDATE tiktok_lead
      SET contact_do_id = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `, contactDOId);

    return this.getData();
  }

  /**
   * Link to conversation
   */
  async linkConversation(conversationId: string): Promise<TikTokLeadData> {
    this.sql.exec(`
      UPDATE tiktok_lead
      SET conversation_id = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `, conversationId);

    return this.getData();
  }

  /**
   * Get lead data
   */
  async getData(): Promise<TikTokLeadData> {
    const row = this.sql.exec(`
      SELECT * FROM tiktok_lead WHERE id = 'current'
    `).toArray()[0] as any;

    if (!row) {
      throw new Error(`Lead not found: ${this.leadId}`);
    }

    // Get form fields
    const fields = this.sql.exec(`
      SELECT field_name, field_value FROM form_fields ORDER BY id
    `).toArray() as any[];

    return {
      leadId: row.lead_id,
      organizationId: row.organization_id,
      formFields: fields.map(f => ({
        field_name: f.field_name,
        field_value: f.field_value
      })),
      contact: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        company: row.company
      },
      source: {
        videoId: row.video_id,
        videoTitle: row.video_title,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        creativeId: row.creative_id,
        creativeName: row.creative_name,
        adGroupId: row.ad_group_id,
        adGroupName: row.ad_group_name
      },
      status: row.status,
      isDuplicate: row.is_duplicate === 1,
      duplicateOfLeadId: row.duplicate_of_lead_id,
      qualificationDOId: row.qualification_do_id,
      contactDOId: row.contact_do_id,
      conversationId: row.conversation_id,
      tiktokCreatedAt: row.tiktok_created_at,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
      rawPayload: row.raw_payload,
      webhookAttempts: row.webhook_attempts,
      lastWebhookAt: row.last_webhook_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get form field by name
   */
  async getFormField(fieldName: string): Promise<string | null> {
    const result = this.sql.exec(`
      SELECT field_value FROM form_fields WHERE field_name = ?
    `, fieldName).toArray();

    return result.length > 0 ? String(result[0].field_value) : null;
  }

  /**
   * Check if lead has valid contact info
   */
  async isValid(): Promise<boolean> {
    const data = await this.getData();
    return !!(data.contact.email || data.contact.phone);
  }
}
