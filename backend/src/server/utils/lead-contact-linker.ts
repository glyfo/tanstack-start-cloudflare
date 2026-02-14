/**
 * Lead-Contact Auto-Linker
 *
 * Shared utility called from all webhook handlers after lead processing.
 * Finds or creates a contact in ContactDO, links it in SocialHubDO,
 * and logs the activity for the unified timeline.
 */

import { createLogger } from './logger';

const log = createLogger('LeadContactLinker');

export interface LeadContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source: 'facebook' | 'instagram' | 'tiktok' | 'whatsapp';
}

export interface LinkResult {
  contactId: string;
  contactName: string;
  isNewContact: boolean;
  linked: boolean;
}

/**
 * Find or create a contact for a lead, then link them.
 *
 * 1. Look up existing contact by email/phone
 * 2. If no match and we have name+email, create one
 * 3. Link lead to contact in SocialHubDO
 * 4. Log activity for unified timeline
 *
 * Never throws — returns null on failure so webhooks aren't blocked.
 * Idempotent — safe to call on every message.
 */
export async function linkLeadToContact(
  env: any,
  orgId: string,
  leadId: string,
  contactInfo: LeadContactInfo,
  sourceMetadata?: Record<string, any>,
): Promise<LinkResult | null> {
  try {
    if (!env.CONTACT_DO) {
      log.warn('CONTACT_DO not configured, skipping');
      return null;
    }

    const contactDoId = env.CONTACT_DO.idFromName(orgId);
    const contactStub = env.CONTACT_DO.get(contactDoId);

    // Step 1: Find existing contact
    let contact = await contactStub.findContactByEmailOrPhone(
      contactInfo.email,
      contactInfo.phone,
    );
    let isNewContact = false;

    // Step 2: Create if not found and we have enough data
    if (!contact && contactInfo.name && (contactInfo.email || contactInfo.phone)) {
      try {
        contact = await contactStub.createContact({
          name: contactInfo.name,
          email: contactInfo.email,
          phone: contactInfo.phone,
          company: contactInfo.company,
          source: contactInfo.source,
          tags: [`lead:${contactInfo.source}`, 'auto-created'],
          createdBy: 'system:webhook',
        });
        isNewContact = true;
        log.info('Created new contact', { contactId: contact.id, source: contactInfo.source });
      } catch (err: any) {
        // Handle duplicate email race condition
        if (err.message?.toLowerCase().includes('unique') || err.message?.toLowerCase().includes('duplicate')) {
          contact = contactInfo.email
            ? await contactStub.getContactByEmail(contactInfo.email)
            : await contactStub.getContactByPhone(contactInfo.phone);
        } else {
          throw err;
        }
      }
    }

    if (!contact) {
      log.info('No contact found or created', { leadId, hasEmail: !!contactInfo.email, hasPhone: !!contactInfo.phone });
      return null;
    }

    // Step 3: Link lead to contact in SocialHubDO
    let linked = false;
    if (env.SOCIAL_HUB_DO) {
      try {
        const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
        const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
        await socialHubStub.linkContact(leadId, contact.id);
        linked = true;
      } catch (err) {
        log.error('Failed to link in SocialHubDO', { err, leadId, contactId: contact.id });
      }
    }

    // Step 4: Log activity for unified timeline
    try {
      await contactStub.logActivity({
        contactId: contact.id,
        type: 'lead_received',
        description: `Lead received from ${contactInfo.source}${isNewContact ? ' (new contact)' : ''}`,
        createdBy: 'system:webhook',
        metadata: { leadId, source: contactInfo.source, isNewContact, linked, ...sourceMetadata },
      });
    } catch (err) {
      log.warn('Failed to log activity', { err });
    }

    return { contactId: contact.id, contactName: contact.name, isNewContact, linked };
  } catch (err) {
    log.error('Error linking lead to contact', { err, leadId, orgId });
    return null;
  }
}
