import { Connection } from "agents";
import { getToolRegistry, ToolCall, ToolResult, Tool } from "./tool-registry";
import type { IChatAgent } from "../agents/interfaces/chat-agent.interface";
import { logger } from "../utils/logger";
import { executeGmailTool } from "./gmail-tools";

export class ToolExecutor {
  private registry = getToolRegistry();
  private pendingClientTools = new Map<
    string,
    {
      resolve: (result: ToolResult) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      connection: Connection; // Track which connection this tool execution belongs to
    }
  >();

  constructor() {}

  async execute(
    toolCall: ToolCall,
    connection: Connection,
    ctx?: any
  ): Promise<ToolResult> {
    const startTime = Date.now();
    logger.tool.info(`[ToolExecutor] Executing tool: ${toolCall.tool}`, {
      params: Object.keys(toolCall.params || {}),
    });

    // Validate tool call
    const validation = this.registry.validateToolCall(toolCall);
    if (!validation.valid) {
      logger.tool.error("[ToolExecutor] Validation failed:", {
        errors: validation.errors,
      });
      return {
        success: false,
        error: `Tool validation failed: ${validation.errors.join(", ")}`,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "server" as "client" | "server" | "mcp",
        },
      };
    }

    const tool = this.registry.getTool(toolCall.tool);
    if (!tool) {
      logger.tool.error(`[ToolExecutor] Tool not found: ${toolCall.tool}`);
      return {
        success: false,
        error: `Tool '${toolCall.tool}' not found`,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "server" as "client" | "server" | "mcp",
        },
      };
    }

    try {
      if (tool.execution === "client") {
        logger.tool.info(`[ToolExecutor] Delegating to client: ${tool.id}`);
        return await this.executeOnClient(tool, toolCall, connection);
      } else if (tool.execution === "server") {
        logger.tool.info(`[ToolExecutor] Executing on server: ${tool.id}`);
        return await this.executeOnServer(tool, toolCall, ctx);
      } else if (tool.execution === "mcp-server") {
        logger.tool.info(
          `[ToolExecutor] MCP tool not yet implemented: ${tool.id}`
        );
        return await this.executeOnMCP(tool, toolCall, ctx);
      }

      logger.tool.error(
        `[ToolExecutor] Unknown execution type: ${tool.execution}`
      );
      return {
        success: false,
        error: `Unknown execution type: ${tool.execution}`,
        metadata: {
          executionTime: Date.now() - startTime,
          source: "server" as "client" | "server" | "mcp",
        },
      };
    } catch (error) {
      logger.tool.error(`[ToolExecutor] Error executing tool ${tool.id}:`, {
        error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          executionTime: Date.now() - startTime,
          source: (tool.execution === "mcp-server" ? "mcp" : tool.execution) as
            | "client"
            | "server"
            | "mcp",
        },
      };
    }
  }

  private async executeOnClient(
    tool: Tool,
    toolCall: ToolCall,
    connection: Connection
  ): Promise<ToolResult> {
    const executionId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        const pending = this.pendingClientTools.get(executionId);
        if (pending) {
          this.pendingClientTools.delete(executionId);
          reject(new Error(`Tool execution timeout: ${tool.id}`));
        }
      }, 30000);

      // Store pending request with cleanup wrapper
      const cleanup = () => {
        clearTimeout(timeout);
        this.pendingClientTools.delete(executionId);
      };

      const wrappedResolve = (result: ToolResult) => {
        cleanup();
        resolve(result);
      };

      const wrappedReject = (error: Error) => {
        cleanup();
        reject(error);
      };

      this.pendingClientTools.set(executionId, {
        resolve: wrappedResolve,
        reject: wrappedReject,
        timeout,
        connection, // Store connection reference for cleanup on disconnect
      });

      console.log("[ToolExecutor] 📝 Registered pending client tool:", {
        executionId,
        toolId: tool.id,
        pendingCount: this.pendingClientTools.size,
      });

      // Send to client
      try {
        console.log("[ToolExecutor] 📤 Sending tool-execute to client:", {
          executionId,
          toolId: tool.id,
          connectionReadyState: connection?.readyState,
        });

        connection.send(
          JSON.stringify({
            type: "tool-execute",
            executionId,
            tool: tool.id,
            params: toolCall.params,
          })
        );

        console.log("[ToolExecutor] ✅ tool-execute sent successfully");
      } catch (error) {
        // If send fails, cleanup immediately
        cleanup();
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to send tool execution request")
        );
      }
    });
  }

  handleClientToolResult(executionId: string, result: ToolResult): void {
    console.log("[ToolExecutor] handleClientToolResult called:", {
      executionId,
      pendingCount: this.pendingClientTools.size,
      hasPending: this.pendingClientTools.has(executionId),
    });

    const pending = this.pendingClientTools.get(executionId);
    if (pending) {
      console.log("[ToolExecutor] ✅ Found pending request, resolving...");
      clearTimeout(pending.timeout);
      this.pendingClientTools.delete(executionId);
      pending.resolve(result);
      console.log("[ToolExecutor] ✅ Promise resolved");
    } else {
      console.error("[ToolExecutor] ❌ No pending request found for executionId:", executionId);
      console.log("[ToolExecutor] Available pending IDs:", Array.from(this.pendingClientTools.keys()));
    }
  }

  private async executeOnServer(
    tool: Tool,
    toolCall: ToolCall,
    ctx: any
  ): Promise<ToolResult> {
    const startTime = Date.now();
    logger.tool.info(`[ToolExecutor] Executing server tool: ${tool.id}`, {
      params: toolCall.params,
    });

    // Validate context for server tools that need it
    if (!ctx || !ctx.agent) {
      logger.tool.error(
        "[ToolExecutor] Context or agent not provided for server tool"
      );
      return {
        success: false,
        error: "Server context not available",
        metadata: {
          executionTime: Date.now() - startTime,
          source: "server",
        },
      };
    }

    // Server-side tool implementations
    switch (tool.id) {
      case "server.createContact": {
        logger.tool.info("[ToolExecutor] Creating contact using ContactDO");
        const { name, email, phone, source, description, company, notes } = toolCall.params;

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return {
            success: false,
            error: "Contact name is required",
            code: "VALIDATION_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return {
            success: false,
            error: "Invalid email format",
            code: "VALIDATION_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }

        try {
          const orgId = "default-org";
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;

          if (!env.CONTACT_DO) {
            throw new Error("ContactDO not configured");
          }

          const contactDoId = env.CONTACT_DO.idFromName(orgId);
          const contactStub = env.CONTACT_DO.get(contactDoId);

          const contact = await contactStub.createContact({
            name: name.trim(),
            email: email?.trim(),
            phone,
            source: source || 'chat',
            description,
            company,
            notes,
            createdBy: ctx.sessionId || "system",
          });

          logger.tool.info("[ToolExecutor] Contact created:", { id: contact.id, name: contact.name });

          return {
            success: true,
            data: {
              ...contact,
              message: `Contact ${contact.name} created successfully`,
            },
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] ContactDO creation error:", { error });

          // Handle duplicate email constraint
          const msg = error.message || "Failed to create contact";
          const isDuplicate = msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate');

          return {
            success: false,
            error: isDuplicate ? `A contact with email "${email}" already exists` : msg,
            code: isDuplicate ? "DUPLICATE_EMAIL" : "CREATE_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }
      }

      case "server.listContacts": {
        logger.tool.info("[ToolExecutor] Listing contacts from ContactDO");
        const limit = Math.min(toolCall.params.limit || 10, 100);

        try {
          // Get organization ID from session
          // Use "default-org" consistently for all users until proper auth is implemented
          // This ensures data persists across sessions
          const orgId = "default-org";

          // Get ContactDO stub
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;

          if (!env.CONTACT_DO) {
            console.error("[ToolExecutor] CONTACT_DO binding not found");
            // Return empty list if ContactDO not available
            return {
              success: true,
              data: {
                contacts: [],
                count: 0,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const contactDoId = env.CONTACT_DO.idFromName(orgId);
          const contactStub = env.CONTACT_DO.get(contactDoId);

          // List contacts via RPC
          const result = await contactStub.listContacts({
            limit,
            offset: 0,
            status: "active",
          });

          const contacts = result?.contacts || [];
          logger.tool.info(
            `[ToolExecutor] Found ${contacts.length} contacts`
          );

          return {
            success: true,
            data: {
              contacts,
              count: contacts.length,
              total: result.total,
              hasMore: result.hasMore,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] ContactDO list error:", { error });

          return {
            success: false,
            error: error.message || "Failed to list contacts",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.searchContacts": {
        logger.tool.info("[ToolExecutor] Searching contacts", {
          query: toolCall.params.query,
        });
        const { query } = toolCall.params;
        const sessionId = ctx.sessionId || "unknown";

        try {
          const agent = ctx.agent as IChatAgent;
          const contacts = agent.sql<{
            id: string;
            name: string;
            email: string;
            company: string | null;
            phone: string | null;
            created_at: number;
          }>`
            SELECT id, name, email, company, phone, created_at
            FROM contacts
            WHERE session_id = ${sessionId}
            AND (
              name LIKE ${"%" + query + "%"}
              OR email LIKE ${"%" + query + "%"}
              OR company LIKE ${"%" + query + "%"}
            )
            ORDER BY created_at DESC
            LIMIT 50
          `;

          const safeContacts = contacts || [];
          console.log(
            `[ToolExecutor] Search found ${safeContacts.length} contacts`
          );

          return {
            success: true,
            data: {
              contacts: safeContacts,
              count: safeContacts.length,
              query,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error) {
          console.error("[ToolExecutor] Search contacts error:", error);
          return {
            success: false,
            error: "Failed to search contacts",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      // ===== OPPORTUNITY TOOLS =====
      case "server.createOpportunity": {
        logger.tool.info("[ToolExecutor] Creating opportunity");
        const { title, contactId, dealValue, stage, source, expectedCloseDate } = toolCall.params;

        // Validate required fields
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return {
            success: false,
            error: "Opportunity title is required",
            code: "VALIDATION_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }

        const validStages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
        const normalizedStage = (stage || 'lead').toLowerCase();
        if (!validStages.includes(normalizedStage)) {
          return {
            success: false,
            error: `Invalid stage "${stage}". Valid stages: ${validStages.join(', ')}`,
            code: "VALIDATION_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }

        const numericDealValue = dealValue != null ? Number(dealValue) : undefined;
        if (numericDealValue != null && (isNaN(numericDealValue) || numericDealValue < 0)) {
          return {
            success: false,
            error: "Deal value must be a positive number",
            code: "VALIDATION_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!env.OPPORTUNITY_DO) {
            return {
              success: false,
              error: "OpportunityDO not configured",
              metadata: { executionTime: Date.now() - startTime, source: "server" },
            };
          }

          // Validate contactId if provided
          if (contactId && env.CONTACT_DO) {
            const contactDoId = env.CONTACT_DO.idFromName(orgId);
            const contactStub = env.CONTACT_DO.get(contactDoId);
            const contact = await contactStub.getContact(contactId);
            if (!contact) {
              return {
                success: false,
                error: `Contact with ID ${contactId} not found`,
                code: "NOT_FOUND",
                metadata: { executionTime: Date.now() - startTime, source: "server" },
              };
            }
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

          const opportunity = await opportunityStub.createOpportunity({
            title: title.trim(),
            contactId,
            dealValue: numericDealValue,
            stage: normalizedStage,
            source: source || 'chat',
            expectedCloseDate,
            createdBy: ctx.sessionId || "system",
          });

          return {
            success: true,
            data: {
              ...opportunity,
              message: `Opportunity "${title.trim()}" created successfully`,
            },
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Opportunity creation error:", { error });
          return {
            success: false,
            error: error.message || "Failed to create opportunity",
            code: "CREATE_ERROR",
            metadata: { executionTime: Date.now() - startTime, source: "server" },
          };
        }
      }

      case "server.listOpportunities": {
        logger.tool.info("[ToolExecutor] Listing opportunities");
        const { stage, limit } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          // Use "default-org" consistently for all users until proper auth is implemented
          // This ensures data persists across sessions
          const orgId = "default-org";

          if (!env.OPPORTUNITY_DO) {
            return {
              success: true,
              data: {
                opportunities: [],
                count: 0,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

          // List opportunities via RPC
          const result = await opportunityStub.listOpportunities({
            stage,
            limit: limit || 20,
            excludeClosed: false,
          });

          const opportunities = result?.opportunities || [];
          logger.tool.info(
            `[ToolExecutor] Found ${opportunities.length} opportunities`
          );

          return {
            success: true,
            data: {
              opportunities,
              count: opportunities.length,
              total: result.total,
              hasMore: result.hasMore,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] List opportunities error:", { error });
          return {
            success: false,
            error: error.message || "Failed to list opportunities",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.updateOpportunityStage": {
        logger.tool.info("[ToolExecutor] Updating opportunity stage");
        const { opportunityId, stage: newStage, reason } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          // Use "default-org" consistently for all users until proper auth is implemented
          // This ensures data persists across sessions
          const orgId = "default-org";

          if (!env.OPPORTUNITY_DO) {
            return {
              success: false,
              error: "OpportunityDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

          // Update stage via RPC
          const opportunity = await opportunityStub.updateStage(
            opportunityId,
            newStage,
            reason
          );

          logger.tool.info(
            `[ToolExecutor] Opportunity ${opportunityId} stage updated to ${newStage}`
          );

          return {
            success: true,
            data: {
              ...opportunity,
              message: `Opportunity "${opportunity.title}" moved to ${newStage}`,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Update opportunity stage error:", { error });
          return {
            success: false,
            error: error.message || "Failed to update opportunity stage",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.updateContact": {
        logger.tool.info("[ToolExecutor] Updating contact");
        // Support both 'id' and 'contactId' for backward compatibility
        const { id, contactId: cId, name, email, phone, company, jobTitle, notes, leadScore, status, tags } = toolCall.params;
        const contactId = cId || id;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!env.CONTACT_DO) {
            return {
              success: false,
              error: "ContactDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const contactDoId = env.CONTACT_DO.idFromName(orgId);
          const contactStub = env.CONTACT_DO.get(contactDoId);

          const contact = await contactStub.updateContact(
            contactId,
            { name, email, phone, company, jobTitle, notes, leadScore, status, tags },
            ctx.sessionId || "system"
          );

          return {
            success: true,
            data: {
              ...contact,
              message: `Contact "${contact.name}" updated successfully`,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Update contact error:", { error });
          return {
            success: false,
            error: error.message || "Failed to update contact",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.deleteContact": {
        logger.tool.info("[ToolExecutor] Deleting contact");
        const { contactId } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!env.CONTACT_DO) {
            return {
              success: false,
              error: "ContactDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const contactDoId = env.CONTACT_DO.idFromName(orgId);
          const contactStub = env.CONTACT_DO.get(contactDoId);

          await contactStub.deleteContact(contactId, ctx.sessionId || "system");

          return {
            success: true,
            data: {
              message: `Contact deleted successfully`,
              contactId,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Delete contact error:", { error });
          return {
            success: false,
            error: error.message || "Failed to delete contact",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.updateOpportunity": {
        logger.tool.info("[ToolExecutor] Updating opportunity");
        // Support both 'id' and 'opportunityId' for backward compatibility
        const { id, opportunityId: oId, title, contactId, dealValue, expectedCloseDate, qualificationScore } = toolCall.params;
        const opportunityId = oId || id;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!env.OPPORTUNITY_DO) {
            return {
              success: false,
              error: "OpportunityDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

          const opportunity = await opportunityStub.updateOpportunity(
            opportunityId,
            { title, contactId, dealValue, expectedCloseDate, qualificationScore },
            ctx.sessionId || "system"
          );

          return {
            success: true,
            data: {
              ...opportunity,
              message: `Opportunity "${opportunity.title}" updated successfully`,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Update opportunity error:", { error });
          return {
            success: false,
            error: error.message || "Failed to update opportunity",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.deleteOpportunity": {
        logger.tool.info("[ToolExecutor] Deleting opportunity");
        const { opportunityId } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!env.OPPORTUNITY_DO) {
            return {
              success: false,
              error: "OpportunityDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

          await opportunityStub.deleteOpportunity(opportunityId, ctx.sessionId || "system");

          return {
            success: true,
            data: {
              message: `Opportunity deleted successfully`,
              opportunityId,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Delete opportunity error:", { error });
          return {
            success: false,
            error: error.message || "Failed to delete opportunity",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      // ===== 360-DEGREE VIEW TOOLS =====
      case "server.getContactMessages": {
        logger.tool.info("[ToolExecutor] Getting messages for contact (360-degree view)");
        const { contactId, email, phone, limit: msgLimit = 50 } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          interface Message {
            id: string;
            platform: string;
            direction: 'inbound' | 'outbound';
            content: string;
            timestamp: number;
            metadata?: Record<string, unknown>;
          }

          const messages: Message[] = [];
          let contactEmail = email;
          let contactPhone = phone;

          // Get contact details if contactId provided
          if (contactId && env.CONTACT_DO) {
            const contactDoId = env.CONTACT_DO.idFromName(orgId);
            const contactStub = env.CONTACT_DO.get(contactDoId);
            const contact = await contactStub.getContact(contactId);
            if (contact) {
              contactEmail = contactEmail || contact.email;
              contactPhone = contactPhone || contact.phone;
            }
          }

          // Get social leads linked to this contact
          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);

            // Get leads by contact ID
            if (contactId) {
              const linkedLeads = await socialHubStub.getLeadsByContactId(contactId);
              for (const lead of linkedLeads) {
                messages.push({
                  id: lead.id,
                  platform: lead.platform,
                  direction: 'inbound',
                  content: `Lead from ${lead.platform}: ${lead.contact.name || 'Unknown'}`,
                  timestamp: lead.receivedAt,
                  metadata: {
                    leadId: lead.id,
                    status: lead.status,
                    platformMetadata: lead.platformMetadata,
                  },
                });
              }
            }

            // Also find by email/phone if not already linked
            if (contactEmail || contactPhone) {
              const additionalLeads = await socialHubStub.findLeadsByEmailOrPhone(contactEmail, contactPhone);
              for (const lead of additionalLeads) {
                // Avoid duplicates
                if (!messages.find(m => m.id === lead.id)) {
                  messages.push({
                    id: lead.id,
                    platform: lead.platform,
                    direction: 'inbound',
                    content: `Lead from ${lead.platform}: ${lead.contact.name || 'Unknown'}`,
                    timestamp: lead.receivedAt,
                    metadata: {
                      leadId: lead.id,
                      status: lead.status,
                      platformMetadata: lead.platformMetadata,
                    },
                  });
                }
              }
            }
          }

          // Sort by timestamp descending and limit
          messages.sort((a, b) => b.timestamp - a.timestamp);
          const limitedMessages = messages.slice(0, msgLimit);

          return {
            success: true,
            data: {
              messages: limitedMessages,
              count: limitedMessages.length,
              total: messages.length,
              contactId,
              contactEmail,
              contactPhone,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Get contact messages error:", { error });
          return {
            success: false,
            error: error.message || "Failed to get contact messages",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.getContactTimeline": {
        logger.tool.info("[ToolExecutor] Getting activity timeline for contact (360-degree view)");
        const { contactId, limit: timelineLimit = 50 } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!contactId) {
            return {
              success: false,
              error: "contactId is required",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          interface TimelineEvent {
            id: string;
            type: 'activity' | 'message' | 'opportunity' | 'lead';
            action: string;
            description: string;
            timestamp: number;
            metadata?: Record<string, unknown>;
          }

          const timeline: TimelineEvent[] = [];

          // Get contact activities
          if (env.CONTACT_DO) {
            const contactDoId = env.CONTACT_DO.idFromName(orgId);
            const contactStub = env.CONTACT_DO.get(contactDoId);

            try {
              const activities = await contactStub.getActivities(contactId, 50, 0);
              for (const activity of activities) {
                timeline.push({
                  id: activity.id,
                  type: 'activity',
                  action: activity.type,
                  description: activity.description,
                  timestamp: activity.createdAt,
                  metadata: activity.metadata,
                });
              }
            } catch {
              // Activities method might not exist, continue
            }
          }

          // Get linked opportunities and their activities
          if (env.OPPORTUNITY_DO) {
            const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
            const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);

            try {
              const oppsResult = await opportunityStub.listOpportunities({ contactId, limit: 20 });
              const opportunities = oppsResult?.opportunities || [];

              for (const opp of opportunities) {
                timeline.push({
                  id: opp.id,
                  type: 'opportunity',
                  action: 'opportunity_created',
                  description: `Opportunity: ${opp.title} (${opp.stage})`,
                  timestamp: opp.createdAt,
                  metadata: {
                    opportunityId: opp.id,
                    stage: opp.stage,
                    dealValue: opp.dealValue,
                  },
                });
              }
            } catch {
              // Continue if opportunities fail
            }
          }

          // Get linked social leads
          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);

            try {
              const leads = await socialHubStub.getLeadsByContactId(contactId);
              for (const lead of leads) {
                timeline.push({
                  id: lead.id,
                  type: 'lead',
                  action: 'lead_received',
                  description: `Lead from ${lead.platform}: ${lead.contact.name || 'Unknown'}`,
                  timestamp: lead.receivedAt,
                  metadata: {
                    leadId: lead.id,
                    platform: lead.platform,
                    status: lead.status,
                  },
                });
              }
            } catch {
              // Continue if social hub fails
            }
          }

          // Sort by timestamp descending
          timeline.sort((a, b) => b.timestamp - a.timestamp);
          const limitedTimeline = timeline.slice(0, timelineLimit);

          return {
            success: true,
            data: {
              timeline: limitedTimeline,
              count: limitedTimeline.length,
              total: timeline.length,
              contactId,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Get contact timeline error:", { error });
          return {
            success: false,
            error: error.message || "Failed to get contact timeline",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.autoLinkLeadToContact": {
        logger.tool.info("[ToolExecutor] Auto-linking lead to contact");
        const { leadId, email, phone } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!leadId) {
            return {
              success: false,
              error: "leadId is required",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          if (!email && !phone) {
            return {
              success: false,
              error: "email or phone is required for auto-linking",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          if (!env.CONTACT_DO || !env.SOCIAL_HUB_DO) {
            return {
              success: false,
              error: "ContactDO or SocialHubDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          // Find matching contact
          const contactDoId = env.CONTACT_DO.idFromName(orgId);
          const contactStub = env.CONTACT_DO.get(contactDoId);
          const contact = await contactStub.findContactByEmailOrPhone(email, phone);

          if (!contact) {
            return {
              success: true,
              data: {
                linked: false,
                message: "No matching contact found",
                leadId,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          // Link the lead to the contact
          const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
          const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
          await socialHubStub.linkContact(leadId, contact.id);

          return {
            success: true,
            data: {
              linked: true,
              message: `Lead linked to contact ${contact.name}`,
              leadId,
              contactId: contact.id,
              contactName: contact.name,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Auto-link lead to contact error:", { error });
          return {
            success: false,
            error: error.message || "Failed to auto-link lead to contact",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.linkLeadToContact": {
        logger.tool.info("[ToolExecutor] Linking lead to contact");
        const { leadId, contactId: linkContactId } = toolCall.params;

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (!leadId || !linkContactId) {
            return {
              success: false,
              error: "leadId and contactId are required",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          if (!env.SOCIAL_HUB_DO) {
            return {
              success: false,
              error: "SocialHubDO not configured",
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
          const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);

          await socialHubStub.linkContact(leadId, linkContactId);

          return {
            success: true,
            data: {
              message: `Lead ${leadId} linked to contact ${linkContactId}`,
              leadId,
              contactId: linkContactId,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error("[ToolExecutor] Link lead to contact error:", { error });
          return {
            success: false,
            error: error.message || "Failed to link lead to contact",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      // ===== CONVERSATION TOOLS =====
      case "server.getWhatsAppConversations": {
        logger.tool.info("[ToolExecutor] Getting WhatsApp conversations");
        const limit = Math.min(toolCall.params.limit || 10, 100);

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          // Prefer SocialHubDO when available (channel-native lead store)
          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
            const result = await socialHubStub.listLeads({ platform: "whatsapp", limit, offset: 0 });
            const conversations = (result?.leads || []).map((lead: any) => ({
              id: lead.id,
              platform: lead.platform,
              contactName: lead.contact?.name,
              contactEmail: lead.contact?.email,
              contactPhone: lead.contact?.phone,
              company: lead.contact?.company,
              status: lead.status,
              timestamp: lead.receivedAt || lead.createdAt,
              metadata: lead.platformMetadata || {},
            }));

            return {
              success: true,
              data: {
                conversations,
                count: conversations.length,
                total: result?.total || conversations.length,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          // Fallback: infer from opportunities created from WhatsApp source
          if (!env.OPPORTUNITY_DO) {
            return {
              success: true,
              data: {
                conversations: [],
                count: 0,
                message: "WhatsApp conversations not available (no data source configured)",
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);
          const oppResult = await opportunityStub.listOpportunities({ limit: limit * 5, excludeClosed: false });
          const opportunities = (oppResult?.opportunities || []).filter((opp: any) => opp.source === "whatsapp");
          const conversations = opportunities.slice(0, limit).map((opp: any) => ({
            id: opp.id,
            platform: "whatsapp",
            title: opp.title,
            stage: opp.stage,
            dealValue: opp.dealValue,
            timestamp: opp.createdAt,
            metadata: {},
          }));

          return {
            success: true,
            data: {
              conversations,
              count: conversations.length,
              total: conversations.length,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || "Failed to get WhatsApp conversations",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.getFacebookConversations": {
        logger.tool.info("[ToolExecutor] Getting Facebook conversations");
        const limit = Math.min(toolCall.params.limit || 10, 100);

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
            const result = await socialHubStub.listLeads({ platform: "facebook", limit, offset: 0 });
            const conversations = (result?.leads || []).map((lead: any) => ({
              id: lead.id,
              platform: lead.platform,
              contactName: lead.contact?.name,
              contactEmail: lead.contact?.email,
              contactPhone: lead.contact?.phone,
              company: lead.contact?.company,
              status: lead.status,
              timestamp: lead.receivedAt || lead.createdAt,
              metadata: lead.platformMetadata || {},
            }));

            return {
              success: true,
              data: {
                conversations,
                count: conversations.length,
                total: result?.total || conversations.length,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          if (!env.OPPORTUNITY_DO) {
            return {
              success: true,
              data: {
                conversations: [],
                count: 0,
                message: "Facebook conversations not available (no data source configured)",
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);
          const oppResult = await opportunityStub.listOpportunities({ limit: limit * 5, excludeClosed: false });
          const opportunities = (oppResult?.opportunities || []).filter((opp: any) => opp.source === "facebook");
          const conversations = opportunities.slice(0, limit).map((opp: any) => ({
            id: opp.id,
            platform: "facebook",
            title: opp.title,
            stage: opp.stage,
            dealValue: opp.dealValue,
            timestamp: opp.createdAt,
            metadata: {},
          }));

          return {
            success: true,
            data: {
              conversations,
              count: conversations.length,
              total: conversations.length,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || "Failed to get Facebook conversations",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.getTikTokLeads": {
        logger.tool.info("[ToolExecutor] Getting TikTok leads");
        const limit = Math.min(toolCall.params.limit || 10, 100);

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);
            const result = await socialHubStub.listLeads({ platform: "tiktok", limit, offset: 0 });
            const leads = (result?.leads || []).map((lead: any) => ({
              id: lead.id,
              platformLeadId: lead.platformLeadId,
              name: lead.contact?.name,
              email: lead.contact?.email,
              phone: lead.contact?.phone,
              company: lead.contact?.company,
              status: lead.status,
              receivedAt: lead.receivedAt,
              source: "tiktok",
              metadata: lead.platformMetadata || {},
            }));

            return {
              success: true,
              data: {
                leads,
                count: leads.length,
                total: result?.total || leads.length,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          // Fallback: infer TikTok pipeline entries from opportunities
          if (!env.OPPORTUNITY_DO) {
            return {
              success: true,
              data: {
                leads: [],
                count: 0,
                message: "TikTok leads not available (no data source configured)",
              },
              metadata: {
                executionTime: Date.now() - startTime,
                source: "server",
              },
            };
          }

          const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
          const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);
          const oppResult = await opportunityStub.listOpportunities({ limit: limit * 5, excludeClosed: false });
          const opportunities = (oppResult?.opportunities || []).filter((opp: any) => opp.source === "tiktok");
          const leads = opportunities.slice(0, limit).map((opp: any) => ({
            id: opp.id,
            title: opp.title,
            stage: opp.stage,
            dealValue: opp.dealValue,
            source: "tiktok",
            receivedAt: opp.createdAt,
          }));

          return {
            success: true,
            data: {
              leads,
              count: leads.length,
              total: leads.length,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || "Failed to get TikTok leads",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      case "server.getAllConversations": {
        logger.tool.info("[ToolExecutor] Getting all conversations");
        const limit = Math.min(toolCall.params.limit || 10, 100);

        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          let whatsapp: any[] = [];
          let facebook: any[] = [];
          let tiktok: any[] = [];

          if (env.SOCIAL_HUB_DO) {
            const socialHubId = env.SOCIAL_HUB_DO.idFromName(orgId);
            const socialHubStub = env.SOCIAL_HUB_DO.get(socialHubId);

            const [waResult, fbResult, ttResult] = await Promise.all([
              socialHubStub.listLeads({ platform: "whatsapp", limit, offset: 0 }),
              socialHubStub.listLeads({ platform: "facebook", limit, offset: 0 }),
              socialHubStub.listLeads({ platform: "tiktok", limit, offset: 0 }),
            ]);

            whatsapp = (waResult?.leads || []).map((lead: any) => ({
              id: lead.id,
              name: lead.contact?.name,
              email: lead.contact?.email,
              phone: lead.contact?.phone,
              status: lead.status,
              timestamp: lead.receivedAt || lead.createdAt,
            }));
            facebook = (fbResult?.leads || []).map((lead: any) => ({
              id: lead.id,
              name: lead.contact?.name,
              email: lead.contact?.email,
              phone: lead.contact?.phone,
              status: lead.status,
              timestamp: lead.receivedAt || lead.createdAt,
            }));
            tiktok = (ttResult?.leads || []).map((lead: any) => ({
              id: lead.id,
              name: lead.contact?.name,
              email: lead.contact?.email,
              phone: lead.contact?.phone,
              status: lead.status,
              timestamp: lead.receivedAt || lead.createdAt,
            }));
          } else if (env.OPPORTUNITY_DO) {
            const opportunityDoId = env.OPPORTUNITY_DO.idFromName(orgId);
            const opportunityStub = env.OPPORTUNITY_DO.get(opportunityDoId);
            const oppResult = await opportunityStub.listOpportunities({ limit: limit * 10, excludeClosed: false });
            const opportunities = oppResult?.opportunities || [];

            whatsapp = opportunities
              .filter((opp: any) => opp.source === "whatsapp")
              .slice(0, limit)
              .map((opp: any) => ({ id: opp.id, title: opp.title, stage: opp.stage, timestamp: opp.createdAt }));
            facebook = opportunities
              .filter((opp: any) => opp.source === "facebook")
              .slice(0, limit)
              .map((opp: any) => ({ id: opp.id, title: opp.title, stage: opp.stage, timestamp: opp.createdAt }));
            tiktok = opportunities
              .filter((opp: any) => opp.source === "tiktok")
              .slice(0, limit)
              .map((opp: any) => ({ id: opp.id, title: opp.title, stage: opp.stage, timestamp: opp.createdAt }));
          }

          return {
            success: true,
            data: {
              whatsapp,
              facebook,
              tiktok,
              totalCount: whatsapp.length + facebook.length + tiktok.length,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || "Failed to get all conversations",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      // ===== GMAIL TOOLS =====
      case "server.listGmailEmails":
      case "server.readGmailEmail":
      case "server.getGmailThread":
      case "server.sendGmailEmail":
      case "server.archiveGmailEmail": {
        logger.tool.info(`[ToolExecutor] Executing Gmail tool: ${tool.id}`);
        try {
          const agent = ctx.agent as IChatAgent;
          const env = agent.env;
          const orgId = "default-org";

          // Map tool.id to gmail tool name (strip "server." prefix)
          const gmailToolName = tool.id.replace("server.", "");
          const result = await executeGmailTool(gmailToolName, toolCall.params, env, orgId);

          return {
            success: result.success,
            data: result.data,
            error: result.error,
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        } catch (error: any) {
          logger.tool.error(`[ToolExecutor] Gmail tool error:`, { error });
          return {
            success: false,
            error: error.message || "Failed to execute Gmail tool",
            metadata: {
              executionTime: Date.now() - startTime,
              source: "server",
            },
          };
        }
      }

      default:
        console.error(`[ToolExecutor] Unknown server tool: ${tool.id}`);
        return {
          success: false,
          error: `Server tool '${tool.id}' not implemented`,
          metadata: {
            executionTime: Date.now() - startTime,
            source: "server",
          },
        };
    }
  }

  private async executeOnMCP(
    tool: Tool,
    _toolCall: ToolCall,
    _ctx: any
  ): Promise<ToolResult> {
    // MCP server integration - placeholder for future implementation
    return {
      success: false,
      error: `MCP tool execution not yet implemented for '${tool.id}'`,
      metadata: {
        executionTime: 0,
        source: "mcp",
      },
    };
  }

  /**
   * Clean up pending tool executions for a specific connection.
   * Called when a WebSocket connection closes to prevent orphaned promises.
   */
  cleanupConnection(connection: Connection): void {
    let cleanedCount = 0;
    for (const [id, pending] of this.pendingClientTools.entries()) {
      if (pending.connection === connection) {
        clearTimeout(pending.timeout);
        // Reject with a specific error so the chat handler knows to retry or show error
        pending.reject(new Error("Connection closed during tool execution"));
        this.pendingClientTools.delete(id);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.tool.info(`[ToolExecutor] Cleaned up ${cleanedCount} pending tool(s) for closed connection`);
    }
  }

  cleanup(): void {
    // Clear all pending client tools
    for (const [id, pending] of this.pendingClientTools.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Tool executor cleanup"));
      this.pendingClientTools.delete(id);
    }
  }
}
