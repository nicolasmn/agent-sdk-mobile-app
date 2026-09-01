# Bloop Relay

Always-on Node.js service that bridges Letta Cloud events to the Bloop mobile app when it's backgrounded.

## What it does

- Maintains Agent SDK sessions for user conversations on Letta Cloud
- Streams events continuously (reasoning, tool calls, assistant messages, approvals)
- Sends Expo push notifications when the mobile app reports it's backgrounded
- Handles tool call approvals relayed from notification actions
- Relays user context input from notification text actions

## Architecture

```
Letta Cloud  ←──Agent SDK WebSocket──→  Relay  ──Expo Push──→  Mobile App
                                         ↑                          │
                                         └───HTTP (state + actions)─┘
```

The mobile app reports its foreground/background state via HTTP. When backgrounded, the relay sends push notifications for events the app would otherwise miss. When foregrounded, the relay stays quiet — the app's own WebSocket handles everything.

## Development

```bash
cd relay
bun install
bun run dev
```

## Environment

- `LETTA_API_KEY` — Letta Cloud API key
- `EXPO_ACCESS_TOKEN` — Expo push notification access token
- `PORT` — HTTP server port (default 3000)
