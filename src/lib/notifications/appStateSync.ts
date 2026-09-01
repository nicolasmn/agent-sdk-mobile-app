/**
 * App state sync — reports foreground/background transitions to the relay
 * so it knows when to send push notifications vs stay quiet.
 */

import { AppState, type AppStateStatus } from "react-native";

import { reportAppState } from "./relayClient";

let initialized = false;

/** Start listening for AppState changes and reporting them to the relay. */
export function setupAppStateSync(): () => void {
  if (initialized) return () => {};
  initialized = true;

  // Report current state on startup.
  reportAppState(AppState.currentState === "active" ? "foreground" : "background").catch(() => {});

  const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
    const state = nextState === "active" ? "foreground" : "background";
    reportAppState(state).catch(() => {});
  });

  return () => {
    subscription.remove();
    initialized = false;
  };
}
