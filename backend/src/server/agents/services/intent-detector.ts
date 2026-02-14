/**
 * IntentDetector - Extracted from ChatAgent.detectToolIntent and detectToolIntentWithLLM
 *
 * Uses fast pattern matching for all registered tools (~90% of queries).
 * Falls back to LLM-based detection only for ambiguous messages.
 */

export class IntentDetector {
  constructor(
    private agent: any, // Reference to ChatAgent instance for env and toolRegistry access
  ) {}

  /**
   * Detect tool intent from user message.
   * Uses fast pattern matching for all registered tools (~90% of queries).
   * Falls back to LLM-based detection only for ambiguous messages.
   */
  async detectToolIntent(userMessage: string): Promise<Array<{ tool: string; params: any }>> {
    try {
      const msg = userMessage.toLowerCase().trim();
      console.log("[ChatAgent] 🔍 Detecting intent for:", msg);

      // Helper: check if message contains any of the given words
      const has = (...words: string[]) => words.some(w => msg.includes(w));
      // Helper: extract text after a keyword
      const after = (keyword: string): string => {
        const idx = msg.indexOf(keyword);
        if (idx === -1) return '';
        return userMessage.slice(idx + keyword.length).trim();
      };
      // Helper: extract email address
      const extractEmail = () => {
        const match = userMessage.match(/[\w.+-]+@[\w.-]+\.\w+/);
        return match ? match[0] : undefined;
      };

      // ─── CREATE FORMS (return [] to signal processUserMessage to render form) ───
      if (has('create', 'add', 'new') && has('contact')) {
        return [];
      }
      if (has('create', 'add', 'new') && has('opportunit', 'deal')) {
        return [];
      }

      // ─── CLIENT TOOLS ───
      if (has('time') && has('what', 'current', 'tell', 'get')) {
        return [{ tool: "client.getTime", params: { format: "12h" } }];
      }
      if (has('timezone', 'locale') || (has('where') && has('am i'))) {
        return [{ tool: "client.getLocation", params: {} }];
      }
      if (has('device', 'browser') && has('info', 'what')) {
        return [{ tool: "client.getDevice", params: {} }];
      }

      // ─── CONTACT: DELETE ───
      if (has('delete', 'remove') && has('contact')) {
        return [{ tool: "server.deleteContact", params: {} }];
      }

      // ─── CONTACT: UPDATE ───
      if (has('update', 'edit', 'change', 'modify') && has('contact')) {
        return [{ tool: "server.updateContact", params: {} }];
      }

      // ─── CONTACT: SEARCH (before list — "find contact X" is more specific) ───
      if ((has('find', 'search', 'look up', 'lookup') && has('contact')) ||
          /search\s+(for\s+)?contact/i.test(msg)) {
        const query = after('contact').replace(/^s?\s+/, '') || after('find ').replace(/contact\s*/i, '').trim();
        return [{ tool: "server.searchContacts", params: { query: query || undefined } }];
      }

      // ─── CONTACT: LIST ───
      if (has('list', 'show', 'view', 'all', 'my') && has('contact')) {
        return [{ tool: "server.listContacts", params: { limit: 10 } }];
      }

      // ─── OPPORTUNITY: DELETE ───
      if (has('delete', 'remove') && has('opportunit', 'deal')) {
        return [{ tool: "server.deleteOpportunity", params: {} }];
      }

      // ─── OPPORTUNITY: UPDATE STAGE ───
      if ((has('move', 'advance', 'progress') && has('deal', 'opportunit', 'stage')) ||
          (has('update', 'change') && has('stage'))) {
        return [{ tool: "server.updateOpportunityStage", params: {} }];
      }

      // ─── OPPORTUNITY: UPDATE ───
      if (has('update', 'edit', 'change', 'modify') && has('opportunit', 'deal')) {
        return [{ tool: "server.updateOpportunity", params: {} }];
      }

      // ─── OPPORTUNITY: LIST ───
      if (has('list', 'show', 'view', 'all', 'my', 'pipeline') && has('opportunit', 'deal')) {
        return [{ tool: "server.listOpportunities", params: { limit: 10 } }];
      }

      // ─── GMAIL: SEND ───
      if (has('send', 'compose', 'draft') && has('email', 'mail')) {
        const email = extractEmail();
        const subjectMatch = userMessage.match(/(?:about|subject|re:?)\s+(.+?)(?:\s+(?:saying|with|body)|$)/i);
        return [{ tool: "server.sendGmailEmail", params: {
          to: email || '',
          subject: subjectMatch?.[1]?.trim() || '',
          body: '',
        }}];
      }

      // ─── GMAIL: ARCHIVE ───
      if (has('archive') && has('email', 'mail')) {
        return [{ tool: "server.archiveGmailEmail", params: {} }];
      }

      // ─── GMAIL: READ SPECIFIC EMAIL / THREAD ───
      if (has('read', 'open', 'view') && has('email', 'mail')) {
        return [{ tool: "server.readGmailEmail", params: {} }];
      }
      if (has('thread') && has('email', 'mail', 'gmail')) {
        return [{ tool: "server.getGmailThread", params: {} }];
      }

      // ─── GMAIL: LIST / CHECK INBOX ───
      if (has('email', 'mail', 'inbox', 'gmail')) {
        let query: string | undefined;
        const fromMatch = userMessage.match(/(?:from|by)\s+(\S+)/i);
        if (fromMatch) query = `from:${fromMatch[1]}`;
        else if (has('unread')) query = 'is:unread';
        else if (has('sent')) query = 'in:sent';
        return [{ tool: "server.listGmailEmails", params: { query, maxResults: 10 } }];
      }

      // ─── WHATSAPP: SEND MESSAGE ───
      if (has('send', 'reply', 'respond') && has('whatsapp')) {
        return [{ tool: "server.sendWhatsAppMessage", params: {} }];
      }
      if (has('template') && has('whatsapp')) {
        return [{ tool: "server.sendWhatsAppTemplate", params: {} }];
      }

      // ─── SOCIAL CONVERSATIONS ───
      if (has('whatsapp') && has('conversation', 'message', 'chat')) {
        return [{ tool: "server.getWhatsAppConversations", params: { limit: 10 } }];
      }
      if (has('facebook', 'fb') && has('conversation', 'message', 'chat')) {
        return [{ tool: "server.getFacebookConversations", params: { limit: 10 } }];
      }
      if (has('tiktok') && has('lead', 'conversion')) {
        return [{ tool: "server.getTikTokLeads", params: { limit: 10 } }];
      }
      if (has('all') && has('conversation', 'message')) {
        return [{ tool: "server.getAllConversations", params: { limit: 10 } }];
      }

      // ─── CONTACT 360 VIEW ───
      if (has('timeline', 'activity') && has('contact', 'for')) {
        return [{ tool: "server.getContactTimeline", params: {} }];
      }
      if (has('messages', 'history') && has('contact', 'from', 'for')) {
        return [{ tool: "server.getContactMessages", params: {} }];
      }

      // ─── LEAD TOOLS ───
      if (has('qualify', 'qualification') && has('lead')) {
        return [{ tool: "server.qualifyLead", params: {} }];
      }
      if (has('auto') && has('link') && has('lead')) {
        return [{ tool: "server.autoLinkLeadToContact", params: {} }];
      }
      if (has('link') && has('lead') && has('contact')) {
        return [{ tool: "server.linkLeadToContact", params: {} }];
      }
      if (has('contact') && has('lead') && has('reach', 'call', 'message')) {
        return [{ tool: "server.contactLead", params: {} }];
      }

      // ─── LLM FALLBACK (for ambiguous queries) ───
      console.log("[ChatAgent] 🤖 No pattern match — using LLM fallback...");
      return await this.detectToolIntentWithLLM(userMessage);
    } catch (error) {
      console.error("[ChatAgent] Intent detection error:", error);
      return [];
    }
  }

  /**
   * LLM-based tool detection fallback.
   * Only used when pattern matching doesn't find a match.
   */
  async detectToolIntentWithLLM(userMessage: string): Promise<Array<{ tool: string; params: any }>> {
    try {
      const toolsDescription = this.agent.toolRegistry.getToolsForSystemPrompt();

      const intentPrompt = `You are a tool selection assistant for a CRM. Given a user query, determine which tools (if any) should be used.

Available Tools:
${toolsDescription}

Rules:
1. Return ONLY a JSON array of tool calls
2. Each tool call must have: {"tool": "tool.id", "params": {...}}
3. If NO tools are needed (general chat, greetings, questions), return: []
4. For "create contact" or "create opportunity" requests, return []

User Query: "${userMessage.replace(/"/g, '\\"')}"

Response (JSON only):`;

      const modelId = this.agent.env.AI_MODEL || "@cf/zai-org/glm-4.7-flash";
      const response = await this.agent.env.AI.run(modelId, {
        messages: [
          { role: "system", content: intentPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
      });

      const responseText = response.response || "";
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return [];

      const toolCalls = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(toolCalls)) return [];

      // Validate: only accept tool IDs that exist in the registry
      const validatedCalls = toolCalls.filter((tc: any) => {
        if (!tc.tool || typeof tc.tool !== 'string') return false;
        const exists = this.agent.toolRegistry.getTool(tc.tool);
        if (!exists) {
          console.warn(`[ChatAgent] LLM suggested non-existent tool: ${tc.tool}`);
          return false;
        }
        return true;
      });

      return validatedCalls;
    } catch (error) {
      console.error("[ChatAgent] LLM intent detection error:", error);
      return [];
    }
  }
}
