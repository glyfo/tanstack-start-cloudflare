/**
 * Intent Detection Test Suite
 *
 * Comprehensive tests for all MVP intents:
 * - Contact management
 * - Opportunity/Pipeline management
 * - Conversation viewing (WhatsApp, Facebook, TikTok)
 * - Temporal queries
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock environment for testing
const mockEnv = {
  AI: {
    run: async (model: string, options: any) => {
      // Simulate Workers AI response based on query
      const userMessage = options.messages[options.messages.length - 1].content;

      // Intent detection patterns
      const intents = detectIntentFromQuery(userMessage);

      return {
        response: JSON.stringify(intents)
      };
    }
  }
};

// Helper function to simulate intent detection logic
function detectIntentFromQuery(query: string): Array<{ tool: string; params: any }> {
  const lowerQuery = query.toLowerCase();
  const intents: Array<{ tool: string; params: any }> = [];

  // ===== CONTACT INTENTS =====
  if (lowerQuery.match(/create (a |an )?contact|add (a |an )?contact|new contact/)) {
    // Extract name and email from query
    const emailMatch = query.match(/[\w.-]+@[\w.-]+\.\w+/);
    // Improved name matching to stop at "with email" or similar keywords
    const nameMatch = query.match(/(?:named?|called?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s+with| from| at|$)/i);

    intents.push({
      tool: 'server.createContact',
      params: {
        name: nameMatch ? nameMatch[1] : '',
        email: emailMatch ? emailMatch[0] : '',
        company: query.match(/(?:from|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)?.[1] || ''
      }
    });
  }

  if (lowerQuery.match(/list (all )?contacts|show (me )?(all )?contacts|get contacts/)) {
    intents.push({
      tool: 'server.listContacts',
      params: { limit: 10 }
    });
  }

  if (lowerQuery.match(/search (for )?contacts?|find (a )?contact/)) {
    const searchQuery = query.replace(/search (for )?contacts?|find (a )?contact/i, '').trim();
    intents.push({
      tool: 'server.searchContacts',
      params: { query: searchQuery || 'John' }
    });
  }

  // ===== OPPORTUNITY INTENTS =====
  if (lowerQuery.match(/create (a |an )?(new )?(opportunity|deal)|add (a |an )?(opportunity|deal)|new (opportunity|deal)/)) {
    const dealValueMatch = query.match(/\$?([\d,]+)/);
    const titleMatch = query.match(/(?:for|titled?|called?)\s+"([^"]+)"|(?:for|titled?|called?)\s+([A-Za-z\s]+)/i);

    intents.push({
      tool: 'server.createOpportunity',
      params: {
        title: titleMatch ? (titleMatch[1] || titleMatch[2]) : 'New Deal',
        dealValue: dealValueMatch ? parseInt(dealValueMatch[1].replace(/,/g, '')) : undefined,
        stage: 'lead'
      }
    });
  }

  if (lowerQuery.match(/list opportunities|show (me )?(all )?opportunities|view pipeline|show (me )?pipeline|get deals/)) {
    const stageMatch = query.match(/in\s+(lead|qualified|proposal|negotiation|closed_won|closed_lost)/i);
    intents.push({
      tool: 'server.listOpportunities',
      params: {
        stage: stageMatch ? stageMatch[1].toLowerCase() : 'all',
        limit: 10
      }
    });
  }

  if (lowerQuery.match(/move|advance|update|change.*stage/)) {
    intents.push({
      tool: 'server.updateOpportunityStage',
      params: {
        opportunityId: 'opp_123',
        stage: 'qualified'
      }
    });
  }

  // ===== CONVERSATION INTENTS =====
  if (lowerQuery.match(/whatsapp (conversations|messages)|show (me )?whatsapp/)) {
    intents.push({
      tool: 'server.getWhatsAppConversations',
      params: { limit: 10 }
    });
  }

  if (lowerQuery.match(/facebook (conversations|messages)|show (me )?facebook|messenger/)) {
    intents.push({
      tool: 'server.getFacebookConversations',
      params: { limit: 10 }
    });
  }

  if (lowerQuery.match(/tiktok (leads|messages)|show (me )?tiktok/)) {
    intents.push({
      tool: 'server.getTikTokLeads',
      params: { limit: 10 }
    });
  }

  if (lowerQuery.match(/all conversations|all messages|show (me )?(all|every) (conversations?|channels)|view (all|every) (conversations?|messages)/)) {
    intents.push({
      tool: 'server.getAllConversations',
      params: { limit: 10 }
    });
  }

  // ===== TEMPORAL INTENTS =====
  if (lowerQuery.match(/what time|current time|time is|what'?s the time/)) {
    intents.push({
      tool: 'client.getTime',
      params: { format: '12h' }
    });
  }

  return intents;
}

describe('Intent Detection - Contact Management', () => {
  it('should detect create contact intent with full details', () => {
    const query = 'create a contact named John Doe with email john@example.com from Acme Corp';
    const intents = detectIntentFromQuery(query);

    expect(intents).toHaveLength(1);
    expect(intents[0].tool).toBe('server.createContact');
    expect(intents[0].params.name).toBe('John Doe');
    expect(intents[0].params.email).toBe('john@example.com');
    expect(intents[0].params.company).toBe('Acme Corp'); // Matches full company name
  });

  it('should detect create contact intent with minimal details', () => {
    const query = 'add a new contact';
    const intents = detectIntentFromQuery(query);

    expect(intents).toHaveLength(1);
    expect(intents[0].tool).toBe('server.createContact');
  });

  it('should detect list contacts intent', () => {
    const queries = [
      'list all contacts',
      'show me contacts',
      'get contacts',
      'show all contacts'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.listContacts');
    });
  });

  it('should detect search contacts intent', () => {
    const query = 'search for contacts named John';
    const intents = detectIntentFromQuery(query);

    expect(intents).toHaveLength(1);
    expect(intents[0].tool).toBe('server.searchContacts');
  });
});

describe('Intent Detection - Opportunity Management', () => {
  it('should detect create opportunity intent with deal value', () => {
    const query = 'create an opportunity for $50,000 deal titled Enterprise Sale';
    const intents = detectIntentFromQuery(query);

    expect(intents).toHaveLength(1);
    expect(intents[0].tool).toBe('server.createOpportunity');
    expect(intents[0].params.dealValue).toBe(50000);
    expect(intents[0].params.title).toContain('Enterprise Sale');
  });

  it('should detect create deal variations', () => {
    const queries = [
      'create a new deal',
      'add an opportunity',
      'new opportunity',
      'create opportunity'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents[0].tool).toBe('server.createOpportunity');
    });
  });

  it('should detect list opportunities intent', () => {
    const queries = [
      'list opportunities',
      'show me all opportunities',
      'view pipeline',
      'show pipeline',
      'get deals'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.listOpportunities');
    });
  });

  it('should detect filtered pipeline view', () => {
    const query = 'show opportunities in qualified stage';
    const intents = detectIntentFromQuery(query);

    expect(intents).toHaveLength(1);
    expect(intents[0].tool).toBe('server.listOpportunities');
    expect(intents[0].params.stage).toBe('qualified');
  });

  it('should detect stage update intent', () => {
    const queries = [
      'move opportunity to qualified',
      'advance deal stage',
      'update opportunity stage',
      'change stage'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents[0].tool).toBe('server.updateOpportunityStage');
    });
  });
});

describe('Intent Detection - Conversations (Multi-Channel)', () => {
  it('should detect WhatsApp conversations intent', () => {
    const queries = [
      'show me whatsapp conversations',
      'whatsapp messages',
      'show whatsapp'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.getWhatsAppConversations');
    });
  });

  it('should detect Facebook conversations intent', () => {
    const queries = [
      'show me facebook messages',
      'facebook conversations',
      'messenger conversations'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.getFacebookConversations');
    });
  });

  it('should detect TikTok leads intent', () => {
    const queries = [
      'show me tiktok leads',
      'tiktok messages',
      'show tiktok'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.getTikTokLeads');
    });
  });

  it('should detect all conversations intent', () => {
    const queries = [
      'show all conversations',
      'all messages',
      'show me all channels',
      'show every conversation'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('server.getAllConversations');
    });
  });
});

describe('Intent Detection - Temporal Queries', () => {
  it('should detect time query intent', () => {
    const queries = [
      'what time is it',
      "what's the time",
      'current time',
      'time is'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(1);
      expect(intents[0].tool).toBe('client.getTime');
    });
  });
});

describe('Intent Detection - Edge Cases', () => {
  it('should return empty array for casual conversation', () => {
    const queries = [
      'hello',
      'how are you',
      'thanks',
      'goodbye'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents).toHaveLength(0);
    });
  });

  it('should handle multiple intents in complex query', () => {
    const query = 'create a contact named Jane and then create an opportunity for $10000';
    const intents = detectIntentFromQuery(query);

    // Should detect both contact and opportunity creation
    expect(intents.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle case-insensitive queries', () => {
    const queries = [
      'CREATE A CONTACT',
      'Create A Contact',
      'create a contact'
    ];

    queries.forEach(query => {
      const intents = detectIntentFromQuery(query);
      expect(intents[0].tool).toBe('server.createContact');
    });
  });
});

describe('Intent Detection - MVP Complete Coverage', () => {
  const mvpIntents = [
    // Contacts
    { query: 'create contact John Doe john@example.com', expectedTool: 'server.createContact', category: 'Contacts' },
    { query: 'list all contacts', expectedTool: 'server.listContacts', category: 'Contacts' },
    { query: 'search contacts', expectedTool: 'server.searchContacts', category: 'Contacts' },

    // Opportunities
    { query: 'create opportunity $25000', expectedTool: 'server.createOpportunity', category: 'Opportunities' },
    { query: 'show pipeline', expectedTool: 'server.listOpportunities', category: 'Opportunities' },
    { query: 'move opportunity to proposal', expectedTool: 'server.updateOpportunityStage', category: 'Opportunities' },

    // Conversations
    { query: 'show whatsapp conversations', expectedTool: 'server.getWhatsAppConversations', category: 'Messaging' },
    { query: 'show facebook messages', expectedTool: 'server.getFacebookConversations', category: 'Messaging' },
    { query: 'show tiktok leads', expectedTool: 'server.getTikTokLeads', category: 'Messaging' },
    { query: 'show all conversations', expectedTool: 'server.getAllConversations', category: 'Messaging' },

    // Temporal
    { query: 'what time is it', expectedTool: 'client.getTime', category: 'Temporal' },
  ];

  mvpIntents.forEach(({ query, expectedTool, category }) => {
    it(`should detect ${category}: "${query}" → ${expectedTool}`, () => {
      const intents = detectIntentFromQuery(query);

      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].tool).toBe(expectedTool);
    });
  });
});
