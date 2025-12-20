/**
 * Content Generator - Generates structured content for different topics
 */

import type {
  StructuredMessage,
  ContentSchema,
  DefinitionListSchema,
  ProcessFlowSchema,
  TableSchema,
} from "@/types/content-schema";

export class ContentGenerator {
  /**
   * Generate structured content for at-risk deals
   */
  static generateAtRiskDealsContent(): ContentSchema[] {
    return [
      // Introduction
      {
        type: "text",
        content: "# At-Risk Deals",
        format: "markdown",
        style: "heading-1",
      } as ContentSchema,

      {
        type: "text",
        content:
          "Business agreements where one or both parties may face financial losses or exposure to risks if conditions aren't met.",
        format: "markdown",
        style: "body",
      } as ContentSchema,

      // Types
      {
        type: "text",
        content: "## Types of At-Risk Deals",
        format: "markdown",
        style: "heading-2",
      } as ContentSchema,

      {
        type: "definition-list",
        title: "Deal Types",
        columns: 2,
        items: [
          {
            term: "Joint Venture Agreements",
            definition:
              "Partners collaborate on a project, sharing resources and risks. If the project fails, both parties may incur losses.",
            icon: "🤝",
            tags: ["collaboration", "high-risk"],
            characteristics: [
              "Shared investment",
              "Equal risk distribution",
              "Mutual success dependency",
            ],
          },
          {
            term: "Equity Investments",
            definition:
              "Investors provide capital in exchange for ownership share. If company fails, investor may lose investment.",
            icon: "📈",
            tags: ["investment", "ownership"],
            characteristics: [
              "Capital at risk",
              "Ownership stake",
              "Long-term commitment",
            ],
          },
          {
            term: "Revenue-Sharing Agreements",
            definition:
              "Parties agree to share revenue from product/service. If unsuccessful, revenue may not cover costs.",
            icon: "📊",
            tags: ["revenue", "conditional"],
            characteristics: [
              "Performance dependent",
              "Scalable returns",
              "Market risk",
            ],
          },
          {
            term: "Performance-Based Contracts",
            definition:
              "Payment tied to specific metrics. If metrics not met, payment may be reduced or withheld.",
            icon: "🎯",
            tags: ["performance", "conditional"],
            characteristics: [
              "Metric-driven",
              "Incentive-aligned",
              "Risk mitigation",
            ],
          },
          {
            term: "Development Agreements",
            definition:
              "Companies collaborate on product development, sharing risks and costs. If unsuccessful, both incur losses.",
            icon: "💻",
            tags: ["development", "collaboration"],
            characteristics: [
              "Innovation risk",
              "Shared investment",
              "Uncertain outcomes",
            ],
          },
        ],
      } as DefinitionListSchema,

      // Characteristics Table
      {
        type: "text",
        content: "## Key Characteristics",
        format: "markdown",
        style: "heading-2",
      } as ContentSchema,

      {
        type: "table",
        title: "At-Risk Deal Characteristics",
        headers: [
          { key: "aspect", label: "Aspect", align: "left", type: "text" },
          {
            key: "description",
            label: "Description",
            align: "left",
            type: "text",
          },
          {
            key: "impact",
            label: "Impact Level",
            align: "center",
            type: "badge",
          },
        ],
        rows: [
          {
            id: "uncertainty",
            cells: {
              aspect: { value: "Uncertainty" },
              description: {
                value: "Uncertain outcomes make risk prediction challenging",
              },
              impact: { value: "High", type: "badge", color: "#ef4444" },
            },
          },
          {
            id: "high-risk",
            cells: {
              aspect: { value: "High-Risk Ventures" },
              description: {
                value: "Often involve innovative or untested models",
              },
              impact: { value: "High", type: "badge", color: "#ef4444" },
            },
          },
          {
            id: "shared-risk",
            cells: {
              aspect: { value: "Shared Risk" },
              description: {
                value: "Risk distributed between parties, creating tension",
              },
              impact: { value: "Medium", type: "badge", color: "#eab308" },
            },
          },
          {
            id: "flexible-terms",
            cells: {
              aspect: { value: "Flexible Terms" },
              description: {
                value: "Adjustable pricing and metrics challenging to manage",
              },
              impact: { value: "Medium", type: "badge", color: "#eab308" },
            },
          },
        ],
      } as TableSchema,

      // Management Strategies
      {
        type: "text",
        content: "## Management Strategies",
        format: "markdown",
        style: "heading-2",
      } as ContentSchema,

      {
        type: "process-flow",
        title: "Risk Management Process",
        description: "Step-by-step approach to managing at-risk deals",
        indicators: "numbered",
        steps: [
          {
            id: "step-1",
            title: "Clearly Define Risk",
            description: "Identify and document all risks involved",
            icon: "🔍",
            details: [
              "Conduct risk assessment",
              "Document risk types",
              "Identify risk owners",
              "Estimate impact levels",
            ],
          },
          {
            id: "step-2",
            title: "Establish Risk-Sharing Mechanisms",
            description: "Develop structures to distribute risk fairly",
            icon: "🔗",
            details: [
              "Design revenue-sharing models",
              "Create performance incentives",
              "Define escalation procedures",
              "Set contingency plans",
            ],
          },
          {
            id: "step-3",
            title: "Set Clear Performance Metrics",
            description: "Establish measurable success criteria",
            icon: "🎯",
            details: [
              "Define KPIs",
              "Set baseline expectations",
              "Create measurement framework",
              "Establish review cycles",
            ],
          },
          {
            id: "step-4",
            title: "Monitor & Adjust",
            description: "Regular review and term adjustments",
            icon: "📊",
            details: [
              "Track progress regularly",
              "Review against metrics",
              "Adjust as needed",
              "Document changes",
            ],
          },
          {
            id: "step-5",
            title: "Communicate Effectively",
            description: "Maintain open dialogue between parties",
            icon: "💬",
            details: [
              "Schedule regular meetings",
              "Share transparent updates",
              "Address concerns promptly",
              "Foster collaboration",
            ],
          },
        ],
      } as ProcessFlowSchema,

      // Risk Mitigation Alert
      {
        type: "alert",
        level: "warning",
        title: "Critical Success Factor",
        message:
          "By understanding at-risk deal characteristics and implementing effective strategies, businesses can minimize risks and maximize growth opportunities.",
        icon: "⚠️",
      } as ContentSchema,
    ];
  }

  /**
   * Generate sales pipeline content
   */
  static generateSalesPipelineContent(): ContentSchema[] {
    return [
      {
        type: "text",
        content: "# Sales Pipeline Overview",
        format: "markdown",
        style: "heading-1",
      } as ContentSchema,

      {
        type: "text",
        content:
          "A visual representation of deals at various stages of your sales process.",
        format: "markdown",
        style: "body",
      } as ContentSchema,

      {
        type: "process-flow",
        title: "Sales Pipeline Stages",
        indicators: "icon",
        steps: [
          {
            id: "prospect",
            title: "Prospect",
            description: "Initial lead identification",
            icon: "📋",
          },
          {
            id: "qualify",
            title: "Qualify",
            description: "Assess fit and potential",
            icon: "✅",
          },
          {
            id: "propose",
            title: "Propose",
            description: "Present solution",
            icon: "📝",
          },
          {
            id: "negotiate",
            title: "Negotiate",
            description: "Discuss terms",
            icon: "🤝",
          },
          {
            id: "close",
            title: "Close",
            description: "Finalize agreement",
            icon: "🏁",
          },
        ],
      } as ProcessFlowSchema,
    ];
  }

  /**
   * Build structured message
   */
  static buildStructuredMessage(
    content: ContentSchema[],
    metadata?: Record<string, any>
  ): StructuredMessage {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      timestamp: Date.now(),
      content,
      metadata: {
        theme: "default",
        layout: "single-column",
        readTime: Math.ceil(content.length * 0.5),
        ...metadata,
      },
    };
  }

  /**
   * Detect if content should be structured
   */
  static shouldStructure(text: string): boolean {
    const keywords = [
      "at-risk deals",
      "sales pipeline",
      "process flow",
      "comparison",
      "timeline",
    ];
    return keywords.some((kw) => text.toLowerCase().includes(kw));
  }

  /**
   * Get structured content based on query
   */
  static getStructuredContent(query: string): ContentSchema[] | null {
    const lower = query.toLowerCase();

    if (lower.includes("at-risk")) {
      return this.generateAtRiskDealsContent();
    }

    if (lower.includes("pipeline") || lower.includes("sales")) {
      return this.generateSalesPipelineContent();
    }

    return null;
  }
}
