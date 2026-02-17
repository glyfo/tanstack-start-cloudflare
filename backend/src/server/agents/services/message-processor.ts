/**
 * MessageProcessor - Extracted from ChatAgent.processUserMessage
 *
 * Handles intent detection, tool execution, flow handling,
 * and system prompt construction for user messages.
 */
import type { Connection } from "agents";
import {
  detectFlowTrigger,
  getFlow,
} from "../../workflows/conversational-flows";

export interface ProcessUserMessageResult {
  systemPrompt: string;
  toolCalls: any[];
  shouldReturnDirectResponse: boolean;
  directResponse?: string;
}

export class MessageProcessor {
  constructor(
    private agent: any, // Reference to ChatAgent instance
  ) {}

  /**
   * Process user message - intent detection, tool execution, flow handling
   * Returns system prompt and any tool results
   */
  async processUserMessage(
    sanitized: string,
    connection?: Connection
  ): Promise<ProcessUserMessageResult> {
    const toolCalls: any[] = [];

    // Step 1: Analyze query complexity and detect intent
    console.log("[ChatAgent] 🔍 Analyzing intent...");
    const complexity = await this.agent.intelligenceRouter.analyzeComplexity(sanitized);
    console.log("[ChatAgent] 📊 Complexity:", complexity);

    // Step 2: Check for active conversational flow or trigger a new one
    const activeFlow = this.agent.smartContext.conversationalFlow;
    let flowTriggered = false;

    if (!activeFlow || activeFlow.status !== 'active') {
      const flowTrigger = detectFlowTrigger(sanitized);
      if (flowTrigger) {
        console.log("[ChatAgent] 🔄 Starting conversational flow:", flowTrigger.flowId);
        const newFlow = this.agent.startFlow(flowTrigger.flowId, flowTrigger.initialData);
        if (newFlow) {
          flowTriggered = true;
          this.agent.safeBroadcast({
            type: "flow-started",
            flowId: flowTrigger.flowId,
            stage: 0,
            initialData: flowTrigger.initialData,
          });
        }
      }
    }

    // Step 3: Detect if tools are needed (skip if flow just started)
    let toolsDetected: Array<{ tool: string; params: any }> = [];
    if (!flowTriggered) {
      toolsDetected = await this.agent.intentDetector.detectToolIntent(sanitized);
      console.log("[ChatAgent] 🛠️ Tools detected:", toolsDetected);
    }

    // Step 4: Handle session reset
    const resetTool = toolsDetected.find(t => t.tool === 'session.reset');
    if (resetTool) {
      console.log("[ChatAgent] Session reset requested");
      await this.agent.resetSession();
      return {
        systemPrompt: '',
        toolCalls: [],
        shouldReturnDirectResponse: true,
        directResponse: '', // Empty - reset event already sent
      };
    }

    // Step 5: Handle form requests - show immediately via state (no streaming)
    const isCreateContactRequest = /\b(create|add|new|remember)\b.*\b(contact|someone|person)\b/i.test(sanitized);
    const isCreateOpportunityRequest = /\b(create|add|new)\b.*\b(opportunit|deal)\b/i.test(sanitized);

    if (isCreateContactRequest && toolsDetected.length === 0) {
      console.log("[ChatAgent] 🎯 Create contact detected - showing form immediately");
      // Show form immediately via state (no message streaming)
      await this.agent.showCreateContactForm({});
      return {
        systemPrompt: '',
        toolCalls: [],
        shouldReturnDirectResponse: true,
        directResponse: '', // Empty - form shows via activeCard
      };
    }

    if (isCreateOpportunityRequest && toolsDetected.length === 0) {
      console.log("[ChatAgent] 🎯 Create opportunity detected - showing form immediately");
      // Show form immediately via state (no message streaming)
      await this.agent.showCreateOpportunityForm({});
      return {
        systemPrompt: '',
        toolCalls: [],
        shouldReturnDirectResponse: true,
        directResponse: '', // Empty - form shows via activeCard
      };
    }

    // Step 6: Execute tools if detected
    if (toolsDetected.length > 0 && connection) {
      console.log("[ChatAgent] ⚙️ Executing", toolsDetected.length, "tool(s)...");

      for (const toolIntent of toolsDetected) {
        try {
          this.agent.safeBroadcast({
            type: "thinking",
            message: `Using ${toolIntent.tool}...`,
          });

          const result = await this.agent.toolExecutor.execute(
            { tool: toolIntent.tool, params: toolIntent.params },
            connection,
            { agent: this.agent, sessionId: this.agent.name }
          );

          if (result.success) {
            toolCalls.push({
              tool: toolIntent.tool,
              params: toolIntent.params,
              result: result.data,
            });
          } else {
            toolCalls.push({
              tool: toolIntent.tool,
              params: toolIntent.params,
              error: result.error,
            });
          }
        } catch (err) {
          console.error("[ChatAgent] Tool execution error:", err);
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          this.agent.safeBroadcast({
            type: "message-done",
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `I encountered an error while executing the tool: ${errorMessage}. Please try again.`,
          });
        }
      }
    }

    // Step 7: Handle direct responses for list operations
    const listContactsResult = toolCalls.find(tc => tc.tool === "server.listContacts" && tc.result);
    const listOpportunitiesResult = toolCalls.find(tc => tc.tool === "server.listOpportunities" && tc.result);

    if (listContactsResult?.result) {
      const contacts = listContactsResult.result?.contacts || [];
      const responseText = contacts.length === 0
        ? "You don't have any contacts yet. Would you like to create one?"
        : `\`\`\`json:contact-list\n${JSON.stringify({ contacts })}\n\`\`\``;

      return {
        systemPrompt: '',
        toolCalls,
        shouldReturnDirectResponse: true,
        directResponse: responseText,
      };
    }

    if (listOpportunitiesResult?.result) {
      const opportunities = listOpportunitiesResult.result?.opportunities || [];
      const responseText = opportunities.length === 0
        ? "You don't have any opportunities yet. Would you like to create one?"
        : `\`\`\`json:opportunity-list\n${JSON.stringify({ opportunities })}\n\`\`\``;

      return {
        systemPrompt: '',
        toolCalls,
        shouldReturnDirectResponse: true,
        directResponse: responseText,
      };
    }

    // Build system prompt
    const uiPrompt = this.agent.toolRegistry.getUIAwareSystemPrompt();
    const flowContext = this.agent.getFlowPromptContext();

    const systemPrompt = this.agent.llmPrompt || `You are a helpful CRM assistant. Be concise and friendly.

${uiPrompt}

RESPONSE GUIDELINES:

1. Forms are shown automatically via state - don't include form JSON in responses
2. Keep success messages very short (1-2 sentences max)
3. Be conversational and helpful
4. Only provide information the user asks for
${flowContext ? `\n${flowContext}` : ''}`;

    return {
      systemPrompt,
      toolCalls,
      shouldReturnDirectResponse: false,
    };
  }
}
