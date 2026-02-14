/**
 * Facebook Lead Durable Object
 *
 * Manages leads captured from Facebook Lead Generation ads
 * Stores lead data, form fields, and ad campaign metadata
 */

import { DurableObject } from 'cloudflare:workers';
import { createLogger } from '../utils/logger';
import type { FacebookLeadData } from '../webhooks/facebook';

const logger = createLogger('FacebookLeadDO');

export class FacebookLeadDO extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Create leads table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        leadgen_id TEXT NOT NULL,
        form_id TEXT NOT NULL,
        form_name TEXT,
        ad_id TEXT,
        ad_name TEXT,
        adset_id TEXT,
        adset_name TEXT,
        campaign_id TEXT,
        campaign_name TEXT,
        page_id TEXT,
        page_name TEXT,
        created_time TEXT NOT NULL,
        processed_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create field_data table for storing form responses
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS field_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_value TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      )
    `);

    // Create contact_info table for extracted contact details
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS contact_info (
        lead_id TEXT PRIMARY KEY,
        name TEXT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        zip TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      )
    `);

    // Create indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_leadgen_id ON leads(leadgen_id)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_form_id ON leads(form_id)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_campaign_id ON leads(campaign_id)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_email ON contact_info(email)
    `);
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/upsert':
        return this.upsertLead(request);
      case '/getData':
        return this.getData();
      case '/linkQualification':
        return this.linkQualification(request);
      case '/getByEmail':
        return this.getByEmail(request);
      case '/getByFormId':
        return this.getByFormId(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Insert or update lead data
   */
  private async upsertLead(request: Request): Promise<Response> {
    try {
      const data = await request.json<{
        leadData: FacebookLeadData;
        contactInfo?: {
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
        };
      }>();

      const { leadData, contactInfo } = data;

      // Insert or update lead
      this.sql.exec(
        `
        INSERT INTO leads (
          id, leadgen_id, form_id, form_name, ad_id, ad_name,
          adset_id, adset_name, campaign_id, campaign_name,
          page_id, page_name, created_time, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(id) DO UPDATE SET
          form_name = excluded.form_name,
          ad_name = excluded.ad_name,
          adset_name = excluded.adset_name,
          campaign_name = excluded.campaign_name,
          page_name = excluded.page_name,
          updated_at = unixepoch()
      `,
        leadData.id,
        leadData.id,
        leadData.form_id,
        leadData.form_name || null,
        leadData.ad_id,
        leadData.ad_name || null,
        leadData.adset_id,
        leadData.adset_name || null,
        leadData.campaign_id,
        leadData.campaign_name || null,
        leadData.page_id || null,
        leadData.page_name || null,
        leadData.created_time
      );

      // Clear and insert field data
      this.sql.exec('DELETE FROM field_data WHERE lead_id = ?', leadData.id);

      for (const field of leadData.field_data) {
        for (const value of field.values) {
          this.sql.exec(
            'INSERT INTO field_data (lead_id, field_name, field_value) VALUES (?, ?, ?)',
            leadData.id,
            field.name,
            value
          );
        }
      }

      // Insert or update contact info if provided
      if (contactInfo) {
        this.sql.exec(
          `
          INSERT INTO contact_info (
            lead_id, name, first_name, last_name, email, phone,
            company, city, state, country, zip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(lead_id) DO UPDATE SET
            name = excluded.name,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            email = excluded.email,
            phone = excluded.phone,
            company = excluded.company,
            city = excluded.city,
            state = excluded.state,
            country = excluded.country,
            zip = excluded.zip
        `,
          leadData.id,
          contactInfo.name || null,
          contactInfo.firstName || null,
          contactInfo.lastName || null,
          contactInfo.email || null,
          contactInfo.phone || null,
          contactInfo.company || null,
          contactInfo.city || null,
          contactInfo.state || null,
          contactInfo.country || null,
          contactInfo.zip || null
        );
      }

      logger.info('[FacebookLeadDO] Lead upserted', { leadId: leadData.id });

      return new Response(
        JSON.stringify({ success: true, leadId: leadData.id }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[FacebookLeadDO] Error upserting lead', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get all lead data
   */
  private getData(): Response {
    try {
      // Get lead data
      const lead = this.sql
        .exec('SELECT * FROM leads LIMIT 1')
        .toArray()[0] as any;

      if (!lead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Get field data
      const fieldData = this.sql
        .exec('SELECT field_name, field_value FROM field_data WHERE lead_id = ?', lead.id)
        .toArray() as any[];

      // Get contact info
      const contactInfo = this.sql
        .exec('SELECT * FROM contact_info WHERE lead_id = ?', lead.id)
        .toArray()[0] as any;

      return new Response(
        JSON.stringify({
          success: true,
          lead,
          fieldData,
          contactInfo: contactInfo || null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[FacebookLeadDO] Error getting data', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Link to LeadQualificationDO
   */
  private async linkQualification(request: Request): Promise<Response> {
    try {
      const { qualificationId } = await request.json<{
        qualificationId: string;
      }>();

      // Add qualification_id column if it doesn't exist
      try {
        this.sql.exec(`
          ALTER TABLE leads ADD COLUMN qualification_id TEXT
        `);
      } catch {
        // Column already exists
      }

      this.sql.exec(
        'UPDATE leads SET qualification_id = ? WHERE id = (SELECT id FROM leads LIMIT 1)',
        qualificationId
      );

      logger.info('[FacebookLeadDO] Linked to qualification', {
        qualificationId,
      });

      return new Response(
        JSON.stringify({ success: true, qualificationId }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[FacebookLeadDO] Error linking qualification', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get lead by email
   */
  private async getByEmail(request: Request): Promise<Response> {
    try {
      const { email } = await request.json<{ email: string }>();

      const contactInfo = this.sql
        .exec('SELECT * FROM contact_info WHERE email = ?', email.toLowerCase())
        .toArray()[0] as any;

      if (!contactInfo) {
        return new Response(
          JSON.stringify({ success: false, found: false }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const lead = this.sql
        .exec('SELECT * FROM leads WHERE id = ?', contactInfo.lead_id)
        .toArray()[0] as any;

      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          lead,
          contactInfo,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[FacebookLeadDO] Error getting by email', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get leads by form ID
   */
  private async getByFormId(request: Request): Promise<Response> {
    try {
      const { formId } = await request.json<{ formId: string }>();

      const leads = this.sql
        .exec('SELECT * FROM leads WHERE form_id = ? ORDER BY created_time DESC', formId)
        .toArray() as any[];

      return new Response(
        JSON.stringify({
          success: true,
          leads,
          count: leads.length,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[FacebookLeadDO] Error getting by form ID', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
}
