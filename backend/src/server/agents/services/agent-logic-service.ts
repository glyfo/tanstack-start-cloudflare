import { Connection } from "agents";
import { logger } from "../../utils/logger";
import { IChatAgent } from "../interfaces/chat-agent.interface";

export class AgentLogicService {
  /**
   * Executes the main agent loop: Observe -> Think -> Act -> Learn
   */
  async executeAgentLoop(
    agent: IChatAgent,
    connection: Connection,
    goal: string,
    maxIterations: number = 10
  ) {
    try {
      await agent.stateMachine.initialize(goal, maxIterations);
      let continueLoop = true;
      let iteration = 0;

      while (continueLoop) {
        iteration++;
        
        // 1. Observe
        await agent.stateMachine.transition("observing", {
          currentAction: "Gathering context",
        });
        const observation = await agent.observe();
        await agent.stateMachine.updateProgress((iteration / maxIterations) * 25);

        // 2. Think
        await agent.stateMachine.transition("thinking", {
          currentAction: "Planning action",
        });
        const plan = await agent.think(goal, observation);
        await agent.stateMachine.updateProgress(
          (iteration / maxIterations) * 50,
          "Action planned",
          plan.reasoning
        );

        // 3. Act
        await agent.stateMachine.transition("acting", {
          currentAction: plan.action,
          reasoning: plan.reasoning,
        });
        const result = await agent.act(connection, plan);
        await agent.stateMachine.updateProgress((iteration / maxIterations) * 75);

        // 4. Learn
        await agent.stateMachine.transition("learning", {
          currentAction: "Storing results",
        });
        await agent.learn(plan, result);
        await agent.stateMachine.updateProgress(
          (iteration / maxIterations) * 100
        );

        // Check completion conditions
        const goalAchieved = result.success === true;
        const canContinue = await agent.stateMachine.nextIteration();
        continueLoop = !goalAchieved && canContinue;

        // Small delay to prevent tight loops
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await agent.stateMachine.complete(true, { goal, iterations: iteration });
    } catch (error) {
      logger.agent.error("Loop Error", { error });
      await agent.stateMachine.complete(false, { error: String(error) });
    }
  }
}
