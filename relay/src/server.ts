/**
 * HTTP server — minimal API for the mobile app to register, report state,
 * and respond to approvals. Uses Node.js built-in http (zero deps).
 */

import http from "node:http";

import { store } from "./store.js";
import { openSession, closeSession, resolveApproval } from "./sessionManager.js";
import type { DeviceRegistration, StateUpdate, ApprovalResponse, HealthResponse } from "./types.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function createServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS for mobile app
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      // GET /health
      if (req.method === "GET" && url.pathname === "/health") {
        const body: HealthResponse = {
          ok: true,
          sessions: store.sessions.size,
          appState: store.appState,
        };
        sendJson(res, 200, body);
        return;
      }

      // POST /register
      if (req.method === "POST" && url.pathname === "/register") {
        const raw = await readBody(req);
        const data = JSON.parse(raw) as DeviceRegistration;

        if (!data.pushToken || !Array.isArray(data.conversationIds)) {
          sendJson(res, 400, { error: "pushToken and conversationIds are required" });
          return;
        }

        store.pushToken = data.pushToken;
        store.conversationIds = new Set(data.conversationIds);

        // Open sessions for any new conversations; close removed ones.
        for (const convId of data.conversationIds) {
          if (!store.sessions.has(convId)) {
            void openSession(convId);
          }
        }
        for (const existingId of store.sessions.keys()) {
          if (!data.conversationIds.includes(existingId)) {
            closeSession(existingId);
          }
        }

        console.log(`register: ${data.conversationIds.length} conversations, token ${data.pushToken.slice(0, 20)}...`);
        sendJson(res, 200, { ok: true });
        return;
      }

      // POST /state
      if (req.method === "POST" && url.pathname === "/state") {
        const raw = await readBody(req);
        const data = JSON.parse(raw) as StateUpdate;

        if (data.state !== "foreground" && data.state !== "background") {
          sendJson(res, 400, { error: "state must be 'foreground' or 'background'" });
          return;
        }

        store.appState = data.state;
        console.log(`state: ${data.state}`);
        sendJson(res, 200, { ok: true });
        return;
      }

      // POST /approval
      if (req.method === "POST" && url.pathname === "/approval") {
        const raw = await readBody(req);
        const data = JSON.parse(raw) as ApprovalResponse;

        if (!data.requestId || !data.decision) {
          sendJson(res, 400, { error: "requestId and decision are required" });
          return;
        }

        const resolved = resolveApproval(data.requestId, data.decision, data.reason);
        if (!resolved) {
          sendJson(res, 404, { error: "not found" });
          return;
        }

        console.log(`approval: ${data.requestId} → ${data.decision}`);
        sendJson(res, 200, { ok: true });
        return;
      }

      // 404
      sendJson(res, 404, { error: "not found" });
    } catch (e) {
      console.error(`server: ${e instanceof Error ? e.message : String(e)}`);
      sendJson(res, 500, { error: "internal server error" });
    }
  });

  return server;
}
