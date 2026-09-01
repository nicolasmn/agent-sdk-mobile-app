/**
 * Push notification registration — requests permission, gets the Expo push
 * token, and registers with the relay service.
 *
 * Also handles notification response (tap) → deep link to conversation.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { registerWithRelay } from "./relayClient";

// Configure how notifications appear when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions and return the Expo push token. */
export async function getPushToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("push: permission not granted");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })).data;

  return token;
}

/** Register for push notifications and send the token + conversations to the relay. */
export async function registerForPushNotifications(conversationIds: string[]): Promise<void> {
  const token = await getPushToken();
  if (!token) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await registerWithRelay(token, conversationIds);
}

/** Listen for notification taps and navigate to the conversation. */
export function setupNotificationResponseHandler(
  navigate: (conversationId: string) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (data?.conversationId && typeof data.conversationId === "string") {
      navigate(data.conversationId);
    }
  });

  return () => subscription.remove();
}
