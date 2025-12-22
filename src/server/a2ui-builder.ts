/**
 * A2UI Builder - Server-side component tree generation
 * =====================================================
 *
 * Converts AI responses or structured data into A2UI component trees.
 * Simple demo implementation focusing on common patterns.
 */

import type {
  A2UIComponent,
  A2UIMessage,
  MetricProps,
  ListProps,
  CardProps,
} from "@/types/a2ui-schema";

export class A2UIBuilder {
  /**
   * Build A2UI components from simple text response
   * Detects patterns like:
   * - Headings: "# Title" or "## Subtitle"
   * - Metrics: "**Label:** Value"
   * - Lists: "- Item" or "* Item"
   */
  static fromTextResponse(
    text: string,
    options?: { intent?: string; progressive?: boolean }
  ): A2UIMessage {
    const components: A2UIComponent[] = [];
    const lines = text.split("\n");

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Headings
      if (line.startsWith("# ")) {
        components.push({
          type: "heading",
          props: { level: 1, text: line.slice(2).trim() },
        });
        i++;
      } else if (line.startsWith("## ")) {
        components.push({
          type: "heading",
          props: { level: 2, text: line.slice(3).trim() },
        });
        i++;
      } else if (line.startsWith("### ")) {
        components.push({
          type: "heading",
          props: { level: 3, text: line.slice(4).trim() },
        });
        i++;
      }
      // Lists
      else if (line.startsWith("- ") || line.startsWith("* ")) {
        const listItems: string[] = [];
        while (i < lines.length) {
          const currentLine = lines[i].trim();
          if (currentLine.startsWith("- ") || currentLine.startsWith("* ")) {
            listItems.push(
              currentLine
                .replace(/^[-*]\s+/, "")
                .replace(/\*\*/g, "")
                .trim()
            );
            i++;
          } else {
            break;
          }
        }
        components.push({
          type: "list",
          props: { items: listItems, style: "bullet" } as ListProps,
        });
      }
      // Metrics (bold pattern)
      else if (line.includes("**") && line.includes(":")) {
        const metric = this.parseMetricLine(line);
        if (metric) {
          components.push({
            type: "metric",
            props: metric,
          });
        }
        i++;
      }
      // Empty lines
      else if (!line) {
        i++;
      }
      // Regular text
      else {
        components.push({
          type: "text",
          props: { content: line },
        });
        i++;
      }
    }

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      components,
      timestamp: Date.now(),
      metadata: {
        intent: options?.intent,
        progressive: options?.progressive ?? true,
      },
    };
  }

  /**
   * Parse metric lines like "**Revenue:** $50k"
   */
  private static parseMetricLine(line: string): MetricProps | null {
    try {
      // Match **Label:** Value patterns
      const match = line.match(/\*\*([^*]+)\*\*:\s*(.+)/);
      if (!match) return null;

      const label = match[1].trim();
      const value = match[2].trim();

      return {
        label,
        value,
      };
    } catch {
      return null;
    }
  }

  /**
   * Build a metrics card component
   */
  static metricsCard(title: string, metrics: MetricProps[]): A2UIComponent {
    return {
      type: "card",
      props: { title, style: "default" } as CardProps,
      children: metrics.map((metric) => ({
        type: "metric",
        props: metric,
      })),
    };
  }

  /**
   * Build a section with heading and content
   */
  static section(title: string, ...children: A2UIComponent[]): A2UIComponent {
    return {
      type: "section",
      props: { title },
      children: [
        {
          type: "heading",
          props: { level: 2, text: title },
        },
        ...children,
      ],
    };
  }

  /**
   * Build list component
   */
  static list(items: string[], ordered?: boolean): A2UIComponent {
    return {
      type: "list",
      props: {
        items,
        ordered: ordered ?? false,
        style: ordered ? "number" : "bullet",
      } as ListProps,
    };
  }

  /**
   * Serialize A2UI components to JSONL format for streaming
   * Each line is one component or component tree
   */
  static toJSONL(components: A2UIComponent[]): string {
    return components.map((comp) => JSON.stringify(comp)).join("\n");
  }

  /**
   * Parse JSONL A2UI format (for client)
   */
  static fromJSONL(jsonlString: string): A2UIComponent[] {
    return jsonlString
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }
}
