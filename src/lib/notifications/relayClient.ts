/**
 * Relay client — talks to the Bloop relay service.
 *
 * The relay is an always-on Node.js service that maintains Agent SDK sessions
 * and sends Expo push notifications when the app is backgrounded. This module
 * handles all HTTP communication with the relay.
 */

import * as SecureStore from "expo-secure-store";

const RELAY_URL_KEY = "letta.relay.url";
const DEFAULT_RELAY_URL = "https://agent-sdk-mobile-app-production.up.railway.app";

/** Get the relay URL from secure storage or fall back to default. */
export async function getRelayUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(RELAY_URL_KEY);
  return stored || DEFAULT_RELAY_URL;
}

/** Set the relay URL (settings screen). */
export async function setRelayUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(RELAY_URL_KEY, url);
}

interface RegisterBody {
  pushToken: string;
  conversationIds: string[];
}

interface StateBody {
  state: "foreground" | "background";
}

interface ApprovalBody {
  requestId: string;
  decision: "allow" | "deny";
  reason?: string;
}

async function post(path: string, body: unknown): Promise<void> {
  const base = await getRelayUrl();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`relay: POST ${path} failed (${res.status}): ${text}`);
  }
}

/** Register this device for push notifications. */
export async function registerWithRelay(pushToken: string, conversationIds: string[]): Promise<void> {
  await post("/register", { pushToken, conversationIds } satisfies RegisterBody);
}

/** Report app foreground/background state to the relay. */
export async function reportAppState(state: "foreground" | "background"): Promise<void> {
  await post("/state", { state } satisfies StateBody);
}

/** Respond to a pending tool call approval. */
export async function sendApproval(requestId: string, decision: "allow" | "deny", reason?: string): Promise<void> {
  await post("/approval", { requestId, decision, reason } satisfies ApprovalBody);
}
