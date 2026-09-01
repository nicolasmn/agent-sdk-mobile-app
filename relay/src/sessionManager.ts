/**
 * Session manager — opens and maintains Agent SDK sessions for registered
 * conversations, consumes their streams, and sends push notifications when
 * the mobile app is backgrounded.
 *
 * The stream consumer runs in a loop: when one stream ends (turn complete)
 * or errors, it opens the next. This mirrors the mobile app's ChatSession.ts
 * consume() pattern.
 */

import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";

import { sendPush, truncate } from "./push.js";
import { store } from "./store.js";
import type { PendingApproval, SessionEntry } from "./types.js";

let client: LettaAgentClient | null = null;

function getClient(): LettaAgentClient {
  if (!client) {
    const apiKey = process.env.LETTA_API_KEY;
    if (!apiKey) throw new Error("LETTA_API_KEY is not set");
    client = new LettaAgentClient({ backend: "cloud", apiKey });
  }
  return client;
}

/** Open a session for a conversation and start consuming its stream. */
export async function openSession(conversationId: string): Promise<void> {
  if (store.sessions.has(conversationId)) {
    console.log(`session: ${conversationId} already open, skipping`);
    return;
  }

  const entry: SessionEntry = {
    session: null,
    dead: false,
    conversationId,
  };
  store.sessions.set(conversationId, entry);

  // Defer the actual session creation so it doesn't block registration.
  void consumeLoop(entry);
}

/** Close and remove a session. */
export function closeSession(conversationId: string): void {
  const entry = store.sessions.get(conversationId);
  if (!entry) return;
  entry.dead = true;
  entry.session?.close();
  store.sessions.delete(conversationId);
}

/** The consume loop — opens stream(), processes messages, reopens on end/error. */
async function consumeLoop(entry: SessionEntry): Promise<void> {
  const { conversationId } = entry;

  while (!entry.dead && store.sessions.has(conversationId)) {
    try {
      const session = getClient().resumeSession(conversationId, {
        canUseTool: async (toolName, _toolInput, context) => {
          return handleApproval(conversationId, toolName, context?.requestId ?? `approval-${Date.now()}`);
        },
      });
      entry.session = session;
      entry.dead = false;

      // Recover any approvals pending from before the (re)connect.
      try {
        await session.recoverPendingApprovals();
      } catch {
        // Best-effort — older runtimes may not support it.
      }

      let received = false;
      for await (const message of session.stream()) {
        if (entry.dead) break;
        received = true;
        handleMessage(conversationId, message);
      }

      // A stream with no messages means the session itself closed.
      if (!received) throw new Error("Session stream closed.");
    } catch (e) {
      if (entry.dead) break;
      const detail = e instanceof Error ? e.message : "Stream ended unexpectedly.";
      console.error(`session ${conversationId}: ${detail}`);
      entry.dead = true;
      // Brief pause before reconnecting to avoid hammering the server.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Handle a single SDK stream message. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleMessage(conversationId: string, message: any): void {
  const type: string = message.type;

  switch (type) {
    case "result": {
      // Turn complete — send push if app is backgrounded.
      if (!store.isBackgrounded() || !store.pushToken) return;
      const success: boolean = message.success;
      const resultText: string = message.result ?? "";
      const title = success ? "Agent replied" : "Agent error";
      sendPush(
        store.pushToken,
        title,
        success ? truncate(resultText) : truncate(message.errorDetail ?? "The run failed."),
        { conversationId, type: "turn_complete" },
      );
      break;
    }

    case "error": {
      console.error(`session ${conversationId}: error event: ${JSON.stringify(message)}`);
      break;
    }

    // MVP: ignore intermediate events (reasoning, tool_call, tool_result, loop_status).
    // Extended scope will use these for Live Activities.
    default:
      break;
  }
}

/** canUseTool callback — sends a push notification and waits for the user's decision. */
async function handleApproval(
  conversationId: string,
  toolName: string,
  requestId: string,
): Promise<{ behavior: "allow" } | { behavior: "deny"; message: string }> {
  // If the app is in the foreground, let it handle the approval directly.
  // The mobile app has its own session and canUseTool — the relay's approval
  // only fires when the app is backgrounded (or when recovering pending approvals).
  // For MVP, we always send a push and wait.

  if (store.pushToken && store.isBackgrounded()) {
    sendPush(
      store.pushToken,
      "Approval needed",
      `Run ${toolName}?`,
      { requestId, conversationId, toolName, type: "approval" },
    );
  }

  return new Promise((resolve) => {
    const pending: PendingApproval = {
      requestId,
      conversationId,
      toolName,
      resolve,
    };
    store.pendingApprovals.set(requestId, pending);
  });
}

/** Resolve a pending approval from POST /approval. */
export function resolveApproval(
  requestId: string,
  decision: "allow" | "deny",
  reason?: string,
): boolean {
  const pending = store.pendingApprovals.get(requestId);
  if (!pending) return false;

  store.pendingApprovals.delete(requestId);
  pending.resolve(
    decision === "allow"
      ? { behavior: "allow" }
      : { behavior: "deny", message: reason?.trim() || "Denied from notification" },
  );
  return true;
}
