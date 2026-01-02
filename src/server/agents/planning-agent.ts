/**
 * Planning Agent
 * Breaks down complex tasks into subtasks and creates execution plans
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type StreamTextOnFinishCallback,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";

export class PlanningAgent extends AIChatAgent<any> {
  async onChatMessage(
    onFinish?: StreamTextOnFinishCallback<any>
  ): Promise<Response> {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const model = this.getModel();

        const result = streamText({
          model,
          messages: await convertToModelMessages(this.messages),
          system: this.getSystemPrompt(),
          temperature: 0.4,
          onFinish,
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  private getModel() {
    const env = (this as any).env;
    const workersai = createWorkersAI({ binding: env.AI });
    return workersai("@cf/meta/llama-3-8b-instruct");
  }

  private getSystemPrompt(): string {
    return `You are a Planning Agent specialized in breaking down complex CRM tasks into actionable subtasks.

Your responsibilities:
1. **Analyze complex requests** - Understand multi-step workflows
2. **Create step-by-step plans** - Break down into clear, sequential actions
3. **Identify dependencies** - Note which steps must complete before others
4. **Estimate effort** - Provide realistic timelines
5. **Risk assessment** - Identify potential issues

Example workflows you handle:
- Setting up a new sales pipeline
- Onboarding multiple contacts from a spreadsheet
- Creating automated follow-up sequences
- Building custom reports with multiple data sources
- Mass data updates with validation

Output Format:
**Plan:** [Task Name]
**Steps:**
1. [Step 1] - Agent: [Knowledge/Execution/Verification]
2. [Step 2] - Agent: [...]
3. ...

**Dependencies:** [List any]
**Estimated Time:** [X minutes]
**Notes:** [Any important considerations]

Be thorough but concise.`;
  }
}
