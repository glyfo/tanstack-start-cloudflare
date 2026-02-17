/**
 * ChatAgent - Extended AIChatAgent with CRM-specific capabilities
 *
 * Features:
 * - Resumable streaming (via AIChatAgent base)
 * - SQLite message persistence (via AIChatAgent base)
 * - Intent detection and tool execution
 * - Conversational flows
 * - MCP Apps pattern support
 */
import { AIChatAgent } from "@cloudflare/ai-chat";
import type { StreamTextOnFinishCallback, ToolSet } from "ai";
import { Connection, callable } from "agents";
import { ChatAgentState } from "./types";
import type { CardType, ToolResult, ExtendedUIMessage } from "./chat-agent-types";
import { Message, SmartContext, FlowContextState, FlowContextUpdate } from "./chat-agent-types";
import { StorageError } from "./chat-agent-storage";
import { AgentLogicService } from "./services/agent-logic-service";
import { IChatAgent } from "./interfaces/chat-agent.interface";
import { AgentStateMachine } from "./agent-state-machine";
import { getIntelligenceRouter } from "../tools/intelligence-router";
import { ToolExecutor } from "../tools/tool-executor";
import { getToolRegistry } from "../tools/tool-registry";
import { logger } from "../utils/logger";
import {
  detectFlowTrigger,
  getFlow,
  createFlowContext,
  advanceFlowStage,
  getStageFormData,
  FlowContext,
} from "../workflows/conversational-flows";

// New Services
import { ChatConnectionManager } from "./services/chat-connection-manager";
import { ChatPersistence } from "./services/chat-persistence";
import { AIService } from "../services/ai-service";
import { Env } from "../types/env";

// Extracted Services
import { MessageProcessor } from "./services/message-processor";
import { IntentDetector } from "./services/intent-detector";
import { StreamHandler } from "./services/stream-handler";

export class ChatAgent extends AIChatAgent<any, ChatAgentState> implements IChatAgent {

  // Configuration constants
  // private static readonly MAX_CONNECTIONS = 5; // Managed by ChatConnectionManager

  initialState: ChatAgentState = {
    agentLoop: {
      phase: "idle",
      iteration: 0,
      maxIterations: 10,
      progress: 0,
      lastUpdate: Date.now(),
    },
    ui: {
      activeCard: null,
      formState: {},
      notifications: [],
      conversationalFlow: null,
    },
    tools: {
      lastExecution: null,
      pendingTools: [],
    },
  };

  stateMachine: AgentStateMachine;
  // Legacy storage removed — migration complete
  public intelligenceRouter = getIntelligenceRouter();
  public toolRegistry = getToolRegistry();

  // Service Composition
  private connectionManager: ChatConnectionManager;
  private persistence: ChatPersistence;
  private aiService: AIService;
  private agentLogic: AgentLogicService;

  // Extracted Services
  private messageProcessor: MessageProcessor;
  private intentDetector: IntentDetector;
  private streamHandler: StreamHandler;

  public smartContext: SmartContext = {};
  public connectionMessageTimestamps: Map<Connection, number[]> = new Map();
  public toolExecutor: ToolExecutor;
  public env: Env; // Strict Env
  public callCount: number = 0;
  public llmPrompt?: string;

  // Track current connection for handleChat context
  public currentConnection: Connection | null = null;

  /**
   * Type-safe accessor for messages with extended properties.
   * Delegating to base class but typed correctly.
   */
  private get extendedMessages(): ExtendedUIMessage[] {
    return (this.messages || []) as unknown as ExtendedUIMessage[];
  }

  /**
   * Safe accessor for state with fallback to initial values.
   */
  private get safeState(): ChatAgentState {
    return this.state || this.initialState;
  }

  /**
   * Safe accessor for UI state with fallback to initial values.
   */
  private get safeUIState() {
    return this.safeState.ui;
  }

  /**
   * Safe accessor for tools state with fallback to initial values.
   */
  private get safeToolsState() {
    return this.safeState.tools;
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Explicitly assign env to ensure AI binding is available
    this.env = env;

    // Initialize Services
    this.connectionManager = new ChatConnectionManager();
    this.persistence = new ChatPersistence(this.ctx.storage);
    this.aiService = new AIService(env);
    this.agentLogic = new AgentLogicService();

    // Initialize Extracted Services
    this.messageProcessor = new MessageProcessor(this);
    this.intentDetector = new IntentDetector(this);
    this.streamHandler = new StreamHandler(this);

    // CRITICAL: Ensure messages is initialized as an array
    if (!this.messages || !Array.isArray(this.messages)) {
      console.log("[ChatAgent] Constructor: Initializing messages array");
      this.messages = [];
    }

    this.stateMachine = new AgentStateMachine(this);
    this.toolExecutor = new ToolExecutor();
    this.smartContext = {};
    this.connectionMessageTimestamps = new Map();

    // Initialize custom SQLite tables via Persistence service
    this.persistence.initializeTables();

    // Schedule periodic cleanup on initialization
    this.persistence.performCleanup().catch(err => {
        console.error('[ChatAgent] Cleanup failed:', err);
    });

    // Migrate existing KV data to SQLite (one-time)
    this.persistence.migrateFromKV(this.ctx.storage).then(messages => {
      if (messages) {
        this.saveMessages(messages as any).catch(console.error);
      }
    });
  }

  // Legacy methods removed in favor of ChatPersistence service

  /**
   * Handle incoming WebSocket messages
   * Custom message types are handled here; chat messages go through onChatMessage
   */
  async onMessage(connection: Connection, data: any) {
    // Validate message size using ConnectionManager
    if (!this.connectionManager.validateMessageSize(data)) {
      connection.send(
        JSON.stringify({ type: "error", message: "Message too large" })
      );
      return;
    }

    let message: any;
    try {
      message = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      connection.send(
        JSON.stringify({ type: "error", message: "Invalid message format" })
      );
      return;
    }

    // Handle custom message types
    switch (message.type) {
      case "user-message":
        // Handle user messages through StreamHandler service
        // This preserves intent detection, tool execution, and flow handling
        await this.streamHandler.handleChat(connection, message.content, message.id);
        break;

      case "agent-goal":
        this.safeBroadcast({ type: "wizard_open", goal: message.content });
        await this.agentLogic.executeAgentLoop(
          this,
          connection,
          message.content,
          message.maxIterations
        );
        break;

      case "get-messages":
        // Return messages in legacy format for backward compatibility
        const legacyMessages = this.extendedMessages.map(m => this.toInternalMessage(m));
        connection.send(JSON.stringify({ type: "history", messages: legacyMessages }));
        break;

      case "clear-messages":
        this.messages = [];
        try {
          await this.saveMessages([]);
        } catch (e) {
          console.error('[ChatAgent] clear-messages saveMessages error:', e);
        }
        connection.send(JSON.stringify({ type: "history_cleared" }));
        this.safeBroadcast({ type: "history", messages: [] });
        break;

      case "field_question":
        connection.send(
          JSON.stringify({
            type: "field_question",
            field: message.field,
            prompt: message.prompt,
          })
        );
        break;

      case "field_valid":
        connection.send(
          JSON.stringify({
            type: "field_valid",
            field: message.field,
            value: message.value,
          })
        );
        break;

      case "field_error":
        connection.send(
          JSON.stringify({
            type: "field_error",
            field: message.field,
            error: message.error,
          })
        );
        break;

      case "tool-result":
        // Handle tool result from client-side tool execution
        console.log("═══════════════════════════════════════");
        console.log("[ChatAgent] 📥 RECEIVED tool-result");
        console.log("[ChatAgent] executionId:", message.executionId);
        console.log("[ChatAgent] result success:", message.result?.success);
        console.log("[ChatAgent] result data:", JSON.stringify(message.result?.data || {}).substring(0, 200));
        console.log("═══════════════════════════════════════");
        this.toolExecutor.handleClientToolResult(message.executionId, message.result);
        break;

      case "tool-invoke":
        // Direct tool invocation from UI (MCP Apps pattern)
        await this.handleDirectToolInvoke(connection, message.tool, message.params, message.requestId);
        break;

      case "context-update":
        // Handle context updates from UI (form state, user interactions)
        await this.handleContextUpdate(connection, message.context);
        break;

      default:
        // Pass to parent class for AI SDK protocol handling
        super.onMessage(connection, data);
    }
  }

  /**
   * AIChatAgent lifecycle method - called when using useAgentChat hook
   * We override this to add our custom processing while still supporting
   * the AI SDK protocol for clients using useAgentChat
   */
  async onChatMessage(
    _onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal; clientTools?: any[] }
  ): Promise<Response | undefined> {
    try {
    // Get the latest user message
    const userMessage = this.extendedMessages[this.extendedMessages.length - 1];
    if (!userMessage || userMessage.role !== 'user') {
      return undefined;
    }

    const content = typeof userMessage.content === 'string'
      ? userMessage.content
      : '';
    const sanitized = this.sanitizeInput(content);

    // Use current connection if available, otherwise get first available connection from manager
    const connection = this.currentConnection || this.connectionManager.getFirstConnection() || [...this.getConnections()][0];

    // Run our custom processing (intent detection, tool execution, flows)
    const { systemPrompt, shouldReturnDirectResponse, directResponse } =
      await this.processUserMessage(sanitized, connection);

    // If we have a direct response (like a form or list), return it
    if (shouldReturnDirectResponse && directResponse) {
      // Add assistant message to conversation
      const assistantMessage: ExtendedUIMessage = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: directResponse,
        createdAt: new Date(),
      };

      // Ensure messages is an array before pushing
      if (!this.messages || !Array.isArray(this.messages)) {
        this.messages = [];
      }
      (this.messages as unknown as ExtendedUIMessage[]).push(assistantMessage);

      try {
        await this.saveMessages(this.messages);
      } catch (e) {
        console.error('[ChatAgent] onChatMessage saveMessages error:', e);
      }

      // Broadcast to all clients
      this.safeBroadcast({
        type: "message",
        message: this.toInternalMessage(assistantMessage),
      });

      return undefined;
    }

    // Build messages for AI
    const aiMessages = this.extendedMessages.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: typeof m.content === 'string' ? m.content : '',
    }));

    // Use AIService for streaming response
    const aiResponse = await this.aiService.generateStream(
      aiMessages,
      systemPrompt
    );

      return aiResponse;
    } catch (error) {
      console.error('[ChatAgent] onChatMessage error:', error);
      return undefined;
    }
  }

  async onConnect(connection: Connection, state?: any) {
    // Delegate to ConnectionManager
    if (!this.connectionManager.accept(connection)) {
      return;
    }
    
    // Call super to ensure base class state is maintained
    await super.onConnect(connection, state);

    console.log(`[ChatAgent] Connection added. ID: ${connection.id}`);

    try {
      // Convert UIMessages to internal format for backward compatibility
      const messages = this.extendedMessages.map(m => this.toInternalMessage(m));
      const messageCount = messages.length;

      connection.send(JSON.stringify({ type: "connected" }));
      connection.send(JSON.stringify({
        type: "history",
        messages: messages.slice(-50), // Last 50 messages
        hasMore: messageCount > 50,
        total: messageCount
      }));
    } catch (error) {
      console.error('[ChatAgent] Failed to send history on connect:', error);
      connection.send(JSON.stringify({
        type: "error",
        message: "Failed to load message history",
        code: "HISTORY_LOAD_ERROR"
      }));
    }
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    // Call super first
    await super.onClose(connection, code, reason, wasClean);

    // Remove from manager
    this.connectionManager.remove(connection);

    // Clean up rate limit tracking
    this.connectionMessageTimestamps.delete(connection);

    // Clean up any pending client tool executions for this connection
    this.toolExecutor.cleanupConnection(connection);

    // Clear current connection if it matches
    if (this.currentConnection === connection) {
      this.currentConnection = null;
    }

    console.log(`[ChatAgent] Connection closed. ID: ${connection.id}`, {
      code,
      reason,
      wasClean
    });
  }

  // ============================================================================
  // STATE VALIDATION
  // ============================================================================

  /**
   * Validate state changes before persistence
   * Throws to reject invalid state updates
   */
  validateStateChange(nextState: ChatAgentState, source: Connection | "server"): void {
    // Validate card type if present
    if (nextState.ui?.activeCard) {
      const validCardTypes: CardType[] = [
        'contact', 'contact-list', 'create-contact-form',
        'opportunity', 'opportunity-list', 'create-opportunity-form',
        'opportunity-form-with-contact', 'contact-selector',
        'tiktok-lead', 'facebook-lead', 'instagram-lead',
        'whatsapp-conversation', 'action', 'success', 'notification',
        'lead-summary', 'analytics', 'qualification-status',
      ];
      if (!validCardTypes.includes(nextState.ui.activeCard.type)) {
        throw new Error(`Invalid card type: ${nextState.ui.activeCard.type}`);
      }
    }

    // Validate agentLoop
    if (nextState.agentLoop?.iteration < 0) {
      throw new Error("Iteration cannot be negative");
    }

    // Prevent client from modifying server-only fields
    if (source !== "server") {
      if (nextState.tools?.lastExecution) {
        throw new Error("Client cannot modify tool execution state directly");
      }
    }
  }

  /**
   * Called after state is persisted and broadcast
   */
  onStateUpdate(state: ChatAgentState, source: Connection | "server"): void {
    const sourceDesc = source === "server" ? "server" : `client:${source.id}`;
    console.log(`[ChatAgent] State updated by ${sourceDesc}`, {
      hasActiveCard: !!state.ui?.activeCard,
      cardType: state.ui?.activeCard?.type,
      phase: state.agentLoop?.phase,
    });
  }

  // ============================================================================
  // @CALLABLE RPC METHODS
  // ============================================================================

  /**
   * Create a new contact via RPC
   */
  @callable()
  async createContact(params: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    tags?: string[];
  }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.createContact", params },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'created',
              entityType: 'contact',
              entity: result.data,
              message: `Contact "${params.name}" created successfully`,
            },
            timestamp: Date.now(),
          },
        },
        tools: {
          ...this.safeToolsState,
          lastExecution: {
            toolId: 'server.createContact',
            status: 'success',
            startedAt: Date.now(),
            completedAt: Date.now(),
            result: result.data,
          },
        },
      });
    } else {
      // Clear form and show error via state
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: null,
        },
      });
    }

    return result;
  }

  /**
   * Create a new opportunity via RPC
   * Handles creating a new contact first if contactId starts with 'new-'
   */
  @callable()
  async createOpportunity(params: {
    title: string;
    contactId?: string;
    contactName?: string;
    contactEmail?: string;
    company?: string;
    dealValue?: number;
    stage?: string;
    expectedCloseDate?: string;
    notes?: string;
    description?: string;
    source?: string;
  }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    // Handle new contact creation if contactId is temporary
    let finalContactId = params.contactId;
    if (params.contactId && params.contactId.startsWith('new-')) {
      console.log('[ChatAgent] Creating new contact before opportunity...');
      try {
        // Generate email if not provided
        const email = params.contactEmail ||
          `${(params.contactName || 'contact').toLowerCase().replace(/\s+/g, '.')}@placeholder.com`;

        const contactResult = await this.toolExecutor.execute(
          {
            tool: "server.createContact",
            params: {
              name: params.contactName || 'New Contact',
              email,
              company: params.company || '',
            }
          },
          connection,
          { agent: this, sessionId: this.name }
        );

        if (contactResult.success && contactResult.data?.id) {
          finalContactId = contactResult.data.id;
          console.log('[ChatAgent] New contact created with ID:', finalContactId);
        } else {
          console.warn('[ChatAgent] Contact creation failed or no ID returned:', contactResult);
          // Continue without contactId rather than failing
          finalContactId = undefined;
        }
      } catch (error) {
        console.error('[ChatAgent] Failed to create contact:', error);
        finalContactId = undefined;
      }
    }

    const result = await this.toolExecutor.execute(
      {
        tool: "server.createOpportunity",
        params: {
          title: params.title,
          contactId: finalContactId,
          dealValue: params.dealValue,
          stage: params.stage,
          expectedCloseDate: params.expectedCloseDate,
          description: params.description,
          source: params.source,
        }
      },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'created',
              entityType: 'opportunity',
              entity: result.data,
              message: `Opportunity "${params.title}" created successfully`,
            },
            timestamp: Date.now(),
          },
        },
        tools: {
          ...this.safeToolsState,
          lastExecution: {
            toolId: 'server.createOpportunity',
            status: 'success',
            startedAt: Date.now(),
            completedAt: Date.now(),
            result: result.data,
          },
        },
      });
    } else {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: null,
        },
      });
    }

    return result;
  }

  /**
   * List contacts via RPC
   */
  @callable()
  async listContacts(params: { limit?: number; offset?: number } = {}): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.listContacts", params: { limit: params.limit || 20, offset: params.offset || 0 } },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success && result.data) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'contact-list',
            data: { contacts: (result.data as any).contacts || [] },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * List opportunities via RPC
   */
  @callable()
  async listOpportunities(params: { limit?: number; stage?: string } = {}): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.listOpportunities", params: { limit: params.limit || 20, stage: params.stage } },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success && result.data) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'opportunity-list',
            data: { opportunities: (result.data as any).opportunities || [] },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * Update contact via RPC
   */
  @callable()
  async updateContact(params: {
    contactId: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    notes?: string;
    leadScore?: number;
    status?: string;
    tags?: string[];
  }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.updateContact", params },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'updated',
              entityType: 'contact',
              entity: result.data,
              message: `Contact updated successfully`,
            },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * Delete contact via RPC
   */
  @callable()
  async deleteContact(params: { contactId: string }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.deleteContact", params },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'deleted',
              entityType: 'contact',
              message: `Contact deleted successfully`,
            },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * Update opportunity via RPC
   */
  @callable()
  async updateOpportunity(params: {
    opportunityId: string;
    title?: string;
    contactId?: string;
    dealValue?: number;
    expectedCloseDate?: number;
    qualificationScore?: number;
  }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.updateOpportunity", params },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'updated',
              entityType: 'opportunity',
              entity: result.data,
              message: `Opportunity updated successfully`,
            },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * Delete opportunity via RPC
   */
  @callable()
  async deleteOpportunity(params: { opportunityId: string }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.deleteOpportunity", params },
      connection,
      { agent: this, sessionId: this.name }
    );

    if (result.success) {
      this.setState({
        ...this.safeState,
        ui: {
          ...this.safeUIState,
          activeCard: {
            type: 'success',
            data: {
              action: 'deleted',
              entityType: 'opportunity',
              message: `Opportunity deleted successfully`,
            },
            timestamp: Date.now(),
          },
        },
      });
    }

    return result;
  }

  /**
   * Show create contact form via RPC
   */
  @callable()
  async showCreateContactForm(initialData?: Record<string, unknown>): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        activeCard: {
          type: 'create-contact-form',
          data: initialData || {},
          timestamp: Date.now(),
        },
      },
    });
  }

  /**
   * Show create opportunity form via RPC
   */
  @callable()
  async showCreateOpportunityForm(initialData?: Record<string, unknown>): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        activeCard: {
          type: 'create-opportunity-form',
          data: initialData || {},
          timestamp: Date.now(),
        },
      },
    });
  }

  /**
   * Show opportunity form with contact pre-selection via RPC
   */
  @callable()
  async showOpportunityFormWithContact(initialData?: Record<string, unknown>): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        activeCard: {
          type: 'opportunity-form-with-contact',
          data: initialData || {},
          timestamp: Date.now(),
        },
      },
    });
  }

  /**
   * Show contact selector via RPC
   */
  @callable()
  async showContactSelector(params?: { onSelect?: string }): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        activeCard: {
          type: 'contact-selector',
          data: params || {},
          timestamp: Date.now(),
        },
      },
    });
  }

  /**
   * Update form state via RPC
   */
  @callable()
  async updateFormState(formId: string, formState: Record<string, unknown>): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        formState: {
          ...this.safeUIState.formState,
          [formId]: formState,
        },
      },
    });
  }

  /**
   * Dismiss active card via RPC
   */
  @callable()
  async dismissCard(): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        activeCard: null,
      },
    });
  }

  /**
   * Add notification via RPC
   */
  @callable()
  async addNotification(params: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    autoClose?: boolean;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const notification = {
      id,
      type: params.type,
      message: params.message,
      timestamp: Date.now(),
      autoClose: params.autoClose ?? true,
    };

    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        notifications: [...(this.safeUIState.notifications || []), notification],
      },
    });

    return id;
  }

  /**
   * Dismiss notification via RPC
   */
  @callable()
  async dismissNotification(notificationId: string): Promise<void> {
    this.setState({
      ...this.safeState,
      ui: {
        ...this.safeUIState,
        notifications: (this.safeUIState.notifications || []).filter(n => n.id !== notificationId),
      },
    });
  }

  /**
   * Search contacts via RPC
   */
  @callable()
  async searchContacts(params: { query: string; limit?: number }): Promise<ToolResult> {
    const connection = this.currentConnection || [...this.getConnections()][0];

    const result = await this.toolExecutor.execute(
      { tool: "server.searchContacts", params: { query: params.query, limit: params.limit || 10 } },
      connection,
      { agent: this, sessionId: this.name }
    );

    return result;
  }

  /**
   * Get connection status for social platforms via RPC
   */
  @callable()
  async getConnectionStatus(): Promise<{ connections: Array<{ platform: string; status: string; expiresAt?: number }> }> {
    // This will be implemented to use SocialHubDO in Phase 2
    // For now, return empty array
    return { connections: [] };
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Convert ExtendedUIMessage to internal Message format for backward compatibility
   */
  private toInternalMessage(uiMessage: ExtendedUIMessage): Message {
    const content = typeof uiMessage.content === 'string'
      ? uiMessage.content
      : JSON.stringify(uiMessage.content);

    return {
      id: uiMessage.id,
      role: uiMessage.role as "user" | "assistant",
      content,
      parts: [{ type: "text", text: content }],
      timestamp: uiMessage.createdAt?.getTime() || Date.now(),
    };
  }

  /**
   * Convert internal Message to ExtendedUIMessage format
   */
  private toUIMessage(message: Message): ExtendedUIMessage {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.timestamp),
    };
  }

  sanitizeInput(input: string): string {
    if (!input) return "";
    let sanitized = input.replace(/<script.*?>.*?<\/script>/gi, "");
    sanitized = sanitized.replace(/\s{10,}/g, " ");
    sanitized = sanitized.trim();
    if (sanitized.length > 10000) sanitized = sanitized.slice(0, 10000);
    return sanitized;
  }

  checkRateLimit(connection: Connection): boolean {
    // 10 messages per minute per connection
    const now = Date.now();
    let timestamps = this.connectionMessageTimestamps.get(connection) || [];
    timestamps = timestamps.filter((t) => now - t < 60000);
    if (timestamps.length >= 10) {
      this.connectionMessageTimestamps.set(connection, timestamps);
      return true;
    }
    timestamps.push(now);
    this.connectionMessageTimestamps.set(connection, timestamps);
    return false;
  }

  safeBroadcast(message: any) {
    const msgType = typeof message === 'object' ? message.type : 'string';
    
    try {
      this.connectionManager.broadcast(message);
      console.log(`[ChatAgent] 📡 broadcast: type=${msgType}`);
    } catch (err) {
      console.error("[ChatAgent] ❌ Broadcast failed:", err);
    }
  }

  // Legacy methods for backward compatibility
  async saveMessage(message: Message): Promise<void> {
    try {
      console.log("[ChatAgent] saveMessage called, message id:", message.id);
      const uiMessage = this.toUIMessage(message);
      console.log("[ChatAgent] Converted to UI message");
      console.log("[ChatAgent] Current this.messages type:", typeof this.messages, "isArray:", Array.isArray(this.messages));

      // Ensure messages is an array
      if (!this.messages || !Array.isArray(this.messages)) {
        console.log("[ChatAgent] Initializing messages array");
        this.messages = [];
      }

      (this.messages as unknown as ExtendedUIMessage[]).push(uiMessage);
      console.log("[ChatAgent] Message pushed, total messages:", this.messages.length);

      // Wrap saveMessages call with extra error handling
      try {
        // Ensure the array we're passing is valid
        const messagesToSave = Array.isArray(this.messages) ? this.messages : [];
        console.log("[ChatAgent] Calling saveMessages with", messagesToSave.length, "messages");
        await this.saveMessages(messagesToSave);
        console.log("[ChatAgent] Messages saved to storage");
      } catch (saveError) {
        console.error("[ChatAgent] saveMessages ERROR:", saveError);
        // Don't rethrow - the message is still in memory
        console.log("[ChatAgent] Message stored in memory but not persisted");
      }
    } catch (error) {
      console.error("[ChatAgent] saveMessage ERROR:", error);
      throw error;
    }
  }

  async getMessages(options?: { limit?: number; offset?: number }): Promise<Message[]> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      console.log("[ChatAgent] getMessages called, this.messages type:", typeof this.messages, "isArray:", Array.isArray(this.messages));
      const rawMessages = this.messages;
      console.log("[ChatAgent] Raw messages:", rawMessages?.length || 0);
      const extended = this.extendedMessages;
      console.log("[ChatAgent] Extended messages:", extended?.length || 0);
      const messages = extended.slice(offset, offset + limit);
      console.log("[ChatAgent] Sliced messages:", messages?.length || 0);
      const result = messages.map(m => this.toInternalMessage(m));
      console.log("[ChatAgent] Mapped messages:", result?.length || 0);
      return result;
    } catch (error) {
      console.error("[ChatAgent] getMessages ERROR:", error);
      return [];
    }
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
    try {
      await this.saveMessages([]);
    } catch (e) {
      console.error('[ChatAgent] clearMessages saveMessages error:', e);
    }
  }

  /**
   * Override saveMessages to add safety checks before calling base class
   * This protects against base class filter issues
   */
  async saveMessages(messages: any[]): Promise<void> {
    try {
      // Ensure we're passing a valid array
      if (!messages) {
        console.log("[ChatAgent] saveMessages: messages is falsy, using empty array");
        messages = [];
      }
      if (!Array.isArray(messages)) {
        console.error("[ChatAgent] saveMessages: messages is not an array:", typeof messages);
        messages = [];
      }

      // Filter out any null/undefined entries
      const cleanMessages = messages.filter(m => m != null);
      console.log("[ChatAgent] saveMessages: Saving", cleanMessages.length, "messages");

      // Call base class implementation
      await super.saveMessages(cleanMessages);
      console.log("[ChatAgent] saveMessages: Base class save completed");
    } catch (error) {
      console.error("[ChatAgent] saveMessages ERROR:", error);
      // Don't rethrow - store in memory as fallback
      this.messages = messages;
    }
  }

  async getLearnings(): Promise<any[]> {
    try {
      const result = this.ctx.storage.sql.exec(`SELECT * FROM learnings ORDER BY timestamp DESC`);
      return [...result];
    } catch (error) {
      console.error('[ChatAgent] Failed to get learnings:', error);
      return [];
    }
  }

  /**
   * Process user message - intent detection, tool execution, flow handling
   * Returns system prompt and any tool results
   * Delegates to MessageProcessor service.
   */
  async processUserMessage(
    sanitized: string,
    connection?: Connection
  ): Promise<{
    systemPrompt: string;
    toolCalls: any[];
    shouldReturnDirectResponse: boolean;
    directResponse?: string;
  }> {
    return this.messageProcessor.processUserMessage(sanitized, connection);
  }


  /**
   * Save message with retry logic for transient failures
   */
  public async saveMessageWithRetry(
    message: Message,
    maxRetries = 3
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.saveMessage(message);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }


  // Stubs for agent loop phases
  async observe() {
    return { context: "observed" };
  }
  async think(_goal: string, _observation: any) {
    return { action: "respond", reasoning: "basic reasoning" };
  }
  async act(_connection: Connection, _plan: any) {
    return { success: true, result: "acted" };
  }
  async learn(_plan: any, _result: any) {
    return { learned: true };
  }

  /**
   * Handle direct tool invocation from UI (MCP Apps pattern)
   */
  async handleDirectToolInvoke(
    connection: Connection,
    toolId: string,
    params: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    const startTime = Date.now();
    logger.tool.info("[ChatAgent] Direct tool invoke:", { toolId, params, requestId });

    this.safeBroadcast({
      type: "status",
      phase: "calling-tool",
      tool: toolId,
    });

    try {
      const result = await this.toolExecutor.execute(
        { tool: toolId, params },
        connection,
        { agent: this, sessionId: this.name }
      );

      const processingTime = Date.now() - startTime;

      connection.send(JSON.stringify({
        type: "tool-invoke-result",
        requestId,
        tool: toolId,
        result: {
          success: result.success,
          data: result.data,
          error: result.error,
        },
        metadata: {
          processingTime,
          source: result.metadata?.source || "server",
        },
      }));

      if (result.success) {
        const actionDescription = this.getToolActionDescription(toolId, params, result.data);

        const actionMessage: Message = {
          id: requestId || Math.random().toString(36).slice(2),
          role: "assistant",
          content: actionDescription,
          parts: [{ type: "text", text: actionDescription }],
          timestamp: Date.now(),
          metadata: {
            toolCalls: [{
              id: requestId || toolId,
              name: toolId,
              status: "success",
              startTime,
              endTime: Date.now(),
              duration: processingTime,
              input: params,
              output: result.data,
            }],
            processingTime,
          },
        };

        await this.saveMessageWithRetry(actionMessage);
        this.safeBroadcast({ type: "message", message: actionMessage });
      }

      this.safeBroadcast({ type: "status", phase: null, tool: null });

    } catch (error) {
      logger.tool.error("[ChatAgent] Direct tool invoke error:", { error });

      connection.send(JSON.stringify({
        type: "tool-invoke-result",
        requestId,
        tool: toolId,
        result: {
          success: false,
          error: error instanceof Error ? error.message : "Tool execution failed",
        },
        metadata: {
          processingTime: Date.now() - startTime,
          source: "server",
        },
      }));

      this.safeBroadcast({ type: "status", phase: null, tool: null });
    }
  }

  /**
   * Generate a human-readable description of a tool action
   */
  private getToolActionDescription(
    toolId: string,
    params: Record<string, any>,
    result: any
  ): string {
    switch (toolId) {
      case "server.createContact":
        return `✅ **Contact Created**\n\nI've created a new contact:\n- **Name:** ${result?.name || params.name}\n- **Email:** ${result?.email || params.email}${result?.company || params.company ? `\n- **Company:** ${result?.company || params.company}` : ''}`;

      case "server.createOpportunity":
        return `✅ **Opportunity Created**\n\nI've created a new opportunity:\n- **Title:** ${result?.title || params.title}${result?.dealValue || params.dealValue ? `\n- **Value:** $${(result?.dealValue || params.dealValue).toLocaleString()}` : ''}\n- **Stage:** ${result?.stage || params.stage || 'lead'}`;

      case "server.updateOpportunityStage":
        return `✅ **Stage Updated**\n\nOpportunity "${result?.title || 'Unknown'}" has been moved to **${params.stage}**.`;

      case "server.listContacts":
        return `📋 Found ${result?.count || 0} contacts.`;

      case "server.listOpportunities":
        return `📋 Found ${result?.count || 0} opportunities.`;

      default:
        return `✅ Tool \`${toolId}\` executed successfully.`;
    }
  }

  /**
   * Handle context updates from UI
   */
  async handleContextUpdate(
    connection: Connection,
    context: {
      type: string;
      formId?: string;
      formState?: Record<string, any>;
      action?: string;
      metadata?: Record<string, any>;
    } | FlowContextUpdate
  ): Promise<void> {
    logger.agent.info("[ChatAgent] Context update received:", { context });

    if (context.type === 'flow-update') {
      const flowUpdate = context as FlowContextUpdate;
      await this.handleFlowUpdate(connection, flowUpdate);
      return;
    }

    const regularContext = context as {
      type: string;
      formId?: string;
      formState?: Record<string, any>;
      action?: string;
      metadata?: Record<string, any>;
    };

    this.smartContext = {
      ...this.smartContext,
      lastUpdate: Date.now(),
      activeForm: regularContext.formId,
      formState: regularContext.formState,
      lastAction: regularContext.action,
      ...regularContext.metadata,
    };

    connection.send(JSON.stringify({
      type: "context-update-ack",
      received: true,
      timestamp: Date.now(),
    }));
  }

  /**
   * Handle flow-specific updates
   */
  async handleFlowUpdate(
    connection: Connection,
    update: FlowContextUpdate
  ): Promise<void> {
    logger.agent.info("[ChatAgent] Flow update received:", { update });

    const currentFlow = this.smartContext.conversationalFlow;

    if (update.action === 'started') {
      const flowContext = createFlowContext(update.flowId, update.collectedData || {});
      this.smartContext.conversationalFlow = {
        flowId: flowContext.flowId,
        stage: flowContext.stage,
        status: flowContext.status,
        startedAt: flowContext.startedAt,
        updatedAt: flowContext.updatedAt,
        collectedData: flowContext.collectedData,
      };
    } else if (update.action === 'contact-selected' && currentFlow) {
      const fullContext: FlowContext = { ...currentFlow, history: [] };
      const advanced = advanceFlowStage(fullContext, update.collectedData || {});
      this.smartContext.conversationalFlow = {
        flowId: advanced.flowId,
        stage: advanced.stage,
        status: advanced.status,
        startedAt: advanced.startedAt,
        updatedAt: advanced.updatedAt,
        collectedData: advanced.collectedData,
        error: advanced.error,
      };
    } else if (update.action === 'advanced' && currentFlow) {
      const fullContext: FlowContext = { ...currentFlow, history: [] };
      const advanced = advanceFlowStage(fullContext, update.collectedData || {});
      this.smartContext.conversationalFlow = {
        flowId: advanced.flowId,
        stage: advanced.stage,
        status: advanced.status,
        startedAt: advanced.startedAt,
        updatedAt: advanced.updatedAt,
        collectedData: advanced.collectedData,
        error: advanced.error,
      };
    } else if (update.action === 'completed' || update.action === 'cancelled') {
      this.smartContext.conversationalFlow = undefined;
    }

    connection.send(JSON.stringify({
      type: "flow-update-ack",
      received: true,
      timestamp: Date.now(),
      flowState: this.smartContext.conversationalFlow,
    }));
  }

  /**
   * Start a new conversational flow
   */
  startFlow(flowId: string, initialData: Record<string, any> = {}): FlowContextState | null {
    const flow = getFlow(flowId);
    if (!flow) {
      logger.agent.error("[ChatAgent] Flow not found:", { flowId });
      return null;
    }

    const flowContext = createFlowContext(flowId, initialData);
    const flowState: FlowContextState = {
      flowId: flowContext.flowId,
      stage: flowContext.stage,
      status: flowContext.status,
      startedAt: flowContext.startedAt,
      updatedAt: flowContext.updatedAt,
      collectedData: flowContext.collectedData,
    };

    this.smartContext.conversationalFlow = flowState;
    logger.agent.info("[ChatAgent] Flow started:", { flowId, initialData });

    return flowState;
  }

  /**
   * Get the current flow's stage information for the system prompt
   */
  getFlowPromptContext(): string | null {
    const flow = this.smartContext.conversationalFlow;
    if (!flow || flow.status !== 'active') return null;

    const flowDef = getFlow(flow.flowId);
    if (!flowDef) return null;

    const stage = flowDef.stages[flow.stage];
    if (!stage) return null;

    const formData = getStageFormData({ ...flow, history: [] });

    let context = `\n## ⚠️ ACTIVE CONVERSATIONAL FLOW ⚠️\n`;
    context += `Flow: ${flowDef.name}\n`;
    context += `Current Stage: ${stage.name} (${flow.stage + 1}/${flowDef.stages.length})\n`;
    context += `Stage Question: "${stage.question || 'Complete this step'}"\n`;

    if (stage.formComponent) {
      context += `\n🔴 YOU MUST SHOW THIS FORM: ${stage.formComponent}\n`;
      context += `Output EXACTLY:\n`;
      context += `\`\`\`json:${stage.formComponent}\n`;
      if (stage.formComponent === 'contact-selector') {
        context += `{"placeholder": "Search contacts or create new...", "allowCreate": true}\n`;
      } else {
        context += `${JSON.stringify(formData)}\n`;
      }
      context += `\`\`\`\n`;
    }

    context += `\n⛔ DO NOT show any other form type.\n`;

    return context;
  }

  // =========================================================================
  // Multi-Channel Message Envelope Support
  // =========================================================================

  /**
   * Override fetch to add /message endpoint for ChannelGateway routing
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle envelope message from ChannelGateway
    if (url.pathname === '/message' && request.method === 'POST') {
      return await this.handleEnvelopeMessageRequest(request);
    }

    // Delegate to parent class for normal handling (WebSocket upgrade, etc)
    return await super.fetch(request);
  }

  /**
   * Handle envelope message request from ChannelGateway
   */
  private async handleEnvelopeMessageRequest(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as any;
      const { envelope, message, sessionKey } = payload;

      // Process the envelope message
      await this.handleEnvelopeMessage(envelope, message, sessionKey);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      logger.agent.error('[ChatAgent] Envelope message handling error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle MessageEnvelope from ChannelGateway
   * Processes the message and sends response back via Gateway
   */
  async handleEnvelopeMessage(
    envelope: any,  // MessageEnvelope type
    message: Message,
    sessionKey: string
  ): Promise<void> {
    logger.agent.info('[ChatAgent] Processing envelope message:', {
      channelType: envelope.channelType,
      scope: envelope.scope,
      sender: envelope.sender.id,
      customerId: envelope.channelMetadata?.customerId,
      text: envelope.text.substring(0, 100),
    });

    // LOAD CROSS-CHANNEL CONTEXT (360° Customer View)
    let crossChannelContext: string | null = null;
    const customerId = envelope.channelMetadata?.customerId;

    if (customerId) {
      try {
        // Import dynamically to avoid circular dependency
        const { CrossChannelContextService } = await import('../services/cross-channel-context');
        const contextService = new CrossChannelContextService(this.env);

        // Load unified customer context from all channels
        const customerContext = await contextService.getCustomerContext(customerId);

        if (customerContext) {
          // Format context for AI system prompt
          crossChannelContext = contextService.formatContextForAI(customerContext);

          logger.agent.info('[ChatAgent] Loaded cross-channel context:', {
            customerId,
            channels: customerContext.channels.length,
            totalMessages: customerContext.totalMessages,
            recentMessages: customerContext.recentMessages.length,
          });

          // Store in smart context for AI access
          this.smartContext.crossChannelContext = customerContext;
          this.smartContext.customerId = customerId;
        }
      } catch (error) {
        logger.agent.error('[ChatAgent] Error loading cross-channel context:', error);
        // Continue without context - non-critical
      }
    }

    // Add message to conversation history
    const userMsg = this.toExtendedMessage({
      role: 'user',
      content: message.content,
      timestamp: envelope.timestamp,
      metadata: {
        ...message.metadata,
        customerId,
        crossChannelContext: !!crossChannelContext,
      },
    });
    this.messages = [...this.messages, userMsg];

    // Inject cross-channel context into system prompt if available
    if (crossChannelContext) {
      // Add context as system message at the beginning
      const contextMessage = this.toExtendedMessage({
        role: 'system',
        content: crossChannelContext,
        timestamp: Date.now(),
        metadata: { type: 'cross_channel_context' },
      });

      // Insert context before recent messages
      this.messages = [contextMessage, ...this.messages.slice(-20)];
    }

    // Save messages
    try {
      await this.saveMessages(this.messages);
    } catch (error) {
      logger.agent.error('[ChatAgent] Failed to save messages:', error);
    }

    // Process the message (intent detection, AI response, etc)
    // For now, create a synthetic connection to maintain compatibility
    const syntheticConnection = {
      send: (data: string) => {
        // Envelope messages don't use WebSocket, responses go via Gateway
        logger.agent.debug('[ChatAgent] Synthetic connection send:', data);
      },
      close: () => {},
    } as Connection;

    // Set current connection for context
    this.currentConnection = syntheticConnection;

    try {
      // Process message through normal flow
      await this.messageProcessor.processMessage(this, syntheticConnection, message.content, message.metadata || {});
    } finally {
      this.currentConnection = null;
    }

    // Update customer activity timestamp
    if (customerId) {
      try {
        const { CrossChannelContextService } = await import('../services/cross-channel-context');
        const contextService = new CrossChannelContextService(this.env);
        await contextService.updateCustomerActivity(customerId, envelope.channelType);
      } catch (error) {
        logger.agent.error('[ChatAgent] Error updating customer activity:', error);
      }
    }

    // TODO: Send response back via ChannelGateway
    // This will be implemented when we add outbound routing
  }

  /**
   * Send message via ChannelGateway (for multi-channel support)
   */
  async sendViaGateway(
    recipientPeer: any,  // Peer type
    text: string,
    sessionKey: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get ChannelGateway stub
      const env = this.env as any;
      if (!env.CHANNEL_GATEWAY) {
        logger.agent.warn('[ChatAgent] CHANNEL_GATEWAY not available, skipping');
        return;
      }

      const gatewayId = env.CHANNEL_GATEWAY.idFromName(sessionKey.split(':')[1] || 'default-org');
      const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

      // Extract channel type from session key
      const parts = sessionKey.split(':');
      const channelType = parts.length >= 3 ? parts[2] : 'websocket';

      // Build outbound message
      const outboundMessage = {
        channelType,
        recipient: recipientPeer,
        text,
        orgId: parts[1] || 'default-org',
        sessionKey,
        metadata,
      };

      // Send via Gateway
      await gateway.fetch('http://internal/route-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outboundMessage),
      });

      logger.agent.info('[ChatAgent] Message sent via ChannelGateway:', {
        channelType,
        recipient: recipientPeer.id,
        textLength: text.length,
      });
    } catch (error: any) {
      logger.agent.error('[ChatAgent] Failed to send via Gateway:', error);
      throw error;
    }
  }
}
