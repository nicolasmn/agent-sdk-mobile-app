/**
 * In-memory state store. Single-user for MVP — one push token, one app state,
 * a set of conversation sessions, and pending approval resolvers.
 *
 * No persistence. On relay restart, the mobile app re-registers via POST /register.
 */

import type { AppState, PendingApproval, SessionEntry } from "./types.js";

class Store {
  /** Expo push token for the registered device. */
  pushToken: string | null = null;

  /** Current app state — relay only sends push when "background". */
  appState: AppState = "unknown";

  /** Active SDK sessions keyed by conversation ID. */
  sessions = new Map<string, SessionEntry>();

  /** Pending approval resolvers keyed by request ID. */
  pendingApprovals = new Map<string, PendingApproval>();

  /** Conversation IDs the user has registered. */
  conversationIds: Set<string> = new Set();

  isBackgrounded(): boolean {
    return this.appState === "background";
  }

  reset() {
    this.pushToken = null;
    this.appState = "unknown";
    this.sessions.clear();
    this.pendingApprovals.clear();
    this.conversationIds.clear();
  }
}

export const store = new Store();
