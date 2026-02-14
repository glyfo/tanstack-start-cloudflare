import toolRegistryData from "./tool-registry.json";

export interface ToolParameter {
  type: string;
  required?: boolean;
  optional?: boolean;
  default?: any;
  description?: string;
  enum?: string[];
}

export interface ToolUIField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "currency" | "percentage" | "date" | "select" | "textarea" | "tags";
  required: boolean;
  placeholder?: string;
  default?: any;
}

export interface ToolUI {
  formComponent: string;
  cardType: string;
  triggerPhrases: string[];
  requiresForm: boolean;
  fields: ToolUIField[];
  successMessage: string;
  icon: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  execution: "client" | "server" | "mcp-server";
  category: string;
  parameters: Record<string, ToolParameter>;
  returns: Record<string, string>;
  mcpServer?: string;
  ui?: ToolUI | null;
}

export interface ToolCall {
  tool: string;
  params: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  metadata?: {
    executionTime?: number;
    source: "client" | "server" | "mcp";
  };
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.loadTools();
  }

  private loadTools(): void {
    for (const tool of toolRegistryData.tools) {
      this.tools.set(tool.id, tool as unknown as Tool);
    }
  }

  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): Tool[] {
    return this.getAll().filter((tool) => tool.category === category);
  }

  getByExecution(execution: "client" | "server" | "mcp-server"): Tool[] {
    return this.getAll().filter((tool) => tool.execution === execution);
  }

  getToolsForSystemPrompt(): string {
    return this.getAll()
      .map((tool) => {
        const params = Object.entries(tool.parameters)
          .map(([key, param]) => {
            const required = param.required ? " (required)" : "";
            return `    - ${key}: ${param.type}${required} - ${
              param.description || ""
            }`;
          })
          .join("\n");

        return `
[${tool.id}]
Name: ${tool.name}
Description: ${tool.description}
Execution: ${tool.execution}
Parameters:
${params || "    (none)"}
`;
      })
      .join("\n");
  }

  /**
   * Get tools that have UI forms (MCP Apps pattern)
   */
  getToolsWithForms(): Tool[] {
    return this.getAll().filter((tool) => tool.ui?.requiresForm);
  }

  /**
   * Check if a user query matches any tool's trigger phrases
   * Returns the matching tool or undefined
   */
  matchToolByTriggerPhrase(query: string): Tool | undefined {
    const normalizedQuery = query.toLowerCase().trim();

    for (const tool of this.getToolsWithForms()) {
      if (tool.ui?.triggerPhrases) {
        for (const phrase of tool.ui.triggerPhrases) {
          if (normalizedQuery.includes(phrase.toLowerCase())) {
            return tool;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Get UI-aware system prompt that instructs the model about form rendering
   */
  getUIAwareSystemPrompt(): string {
    const formTools = this.getToolsWithForms();

    if (formTools.length === 0) {
      return "";
    }

    const formInstructions = formTools.map((tool) => {
      const formComponent = tool.ui?.formComponent || "unknown-form";
      const triggerPhrases = tool.ui?.triggerPhrases?.join(", ") || "unknown";
      const fields = tool.ui?.fields || [];
      const requiredFields = fields
        .filter((f) => f.required)
        .map((f) => f.name)
        .join(", ") || "none";

      const fieldDefaults = fields
        .map((f) => `"${f.name}": ${f.default !== undefined ? JSON.stringify(f.default) : '""'}`)
        .join(", ");

      return `
## ${tool.name}
- Trigger phrases: ${triggerPhrases}
- Form component: ${formComponent}
- Required fields: ${requiredFields}
- When triggered, respond with:
\`\`\`json:${formComponent}
{${fieldDefaults}}
\`\`\`
`;
    }).join("\n");

    return `
# UI Forms (MCP Apps Pattern)

When the user wants to create or edit records, render an inline form using the following JSON format.
Pre-fill any values the user mentioned in their request.

${formInstructions}

IMPORTANT: Only show the form when the user explicitly wants to CREATE something. For queries/searches, don't show a form.
`;
  }

  validateToolCall(toolCall: ToolCall): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const tool = this.getTool(toolCall.tool);

    if (!tool) {
      errors.push(`Tool '${toolCall.tool}' not found in registry`);
      return { valid: false, errors };
    }

    // Validate required parameters
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required && !(paramName in toolCall.params)) {
        errors.push(
          `Missing required parameter '${paramName}' for tool '${tool.id}'`
        );
      }
    }

    // Validate parameter types (basic validation)
    for (const [paramName, paramValue] of Object.entries(toolCall.params)) {
      const paramDef = tool.parameters[paramName];
      if (paramDef) {
        const actualType = typeof paramValue;
        if (paramDef.type === "number" && actualType !== "number") {
          errors.push(
            `Parameter '${paramName}' should be number, got ${actualType}`
          );
        } else if (paramDef.type === "string" && actualType !== "string") {
          errors.push(
            `Parameter '${paramName}' should be string, got ${actualType}`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// Singleton instance
let toolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
  }
  return toolRegistry;
}
