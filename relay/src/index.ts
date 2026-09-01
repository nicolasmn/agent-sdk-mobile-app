/**
 * Bloop Relay — always-on bridge between Letta Cloud and the mobile app.
 *
 * Maintains Agent SDK sessions for user conversations, streams events,
 * and sends Expo push notifications when the mobile app is backgrounded.
 * Handles tool call approvals relayed from notification actions.
 *
 * Env:
 *   LETTA_API_KEY — Letta Cloud API key (required)
 *   PORT          — HTTP server port (default 3000)
 */

import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

if (!process.env.LETTA_API_KEY) {
  console.error("FATAL: LETTA_API_KEY is not set. Set it in your environment or Railway variables.");
  process.exit(1);
}

const server = createServer(PORT);

server.listen(PORT, () => {
  console.log(`bloop-relay listening on :${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    console.log("server closed");
    process.exit(0);
  });

  // Force exit after 5s if server.close hangs
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
