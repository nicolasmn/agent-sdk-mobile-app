/** Shared types for the relay service. */

export type AppState = "foreground" | "background" | "unknown";

export interface DeviceRegistration {
  pushToken: string;
  conversationIds: string[];
}

export interface StateUpdate {
  state: "foreground" | "background";
}

export interface ApprovalResponse {
  requestId: string;
  decision: "allow" | "deny";
  reason?: string;
}

export interface PendingApproval {
  requestId: string;
  conversationId: string;
  toolName: string;
  resolve: (response: { behavior: "allow" } | { behavior: "deny"; message: string }) => void;
}

export interface SessionEntry {
  session: import("@letta-ai/letta-agent-sdk").LettaCodeSession | null;
  dead: boolean;
  conversationId: string;
}

export interface HealthResponse {
  ok: true;
  sessions: number;
  appState: AppState;
}
