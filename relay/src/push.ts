/**
 * Expo push notification sender.
 *
 * Uses Expo's HTTP push API directly — no SDK dependency needed.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
}

export async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const payload: PushPayload = {
    to: token,
    title,
    body,
    sound: "default",
    ...(data ? { data } : {}),
  };

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`push: Expo returned ${res.status}: ${text}`);
      return;
    }

    const json = await res.json();
    if (json.data?.status === "error") {
      console.error(`push: Expo error: ${json.data.message ?? JSON.stringify(json.data)}`);
    }
  } catch (e) {
    console.error(`push: failed to send: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Truncate text for notification body — iOS shows ~150 chars, Android ~200. */
export function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}
