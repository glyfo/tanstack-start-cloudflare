import { Connection } from "agents";
import { AgentStateMachine } from "../agent-state-machine";

export interface IChatAgent {
  stateMachine: AgentStateMachine;
  
  env: any; // Using any to avoid circular dependency with Env for now, or we can move Env to a shared type
  name: string;
  sql: <Result = Record<string, string | number | boolean | null>>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ) => Result[];

  observe(): Promise<any>;
  think(goal: string, observation: any): Promise<any>;
  act(connection: Connection, plan: any): Promise<any>;
  learn(plan: any, result: any): Promise<any>;
}
