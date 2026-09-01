/**
 * Root layout: gesture root → theme → navigation stack.
 * Router chrome is disabled; screens render their own headers (Screen/Header)
 * so the design system owns every pixel.
 *
 * Also initializes push notifications, app state sync, and notification tap
 * deep linking.
 */
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";

import { ProfilesProvider } from "../lib/profiles/ProfilesContext";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { registerForPushNotifications, setupNotificationResponseHandler } from "../lib/notifications/push";
import { setupAppStateSync } from "../lib/notifications/appStateSync";

function ThemedStack() {
  const { name, colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Register for push notifications on launch.
    registerForPushNotifications([]).catch(() => {});

    // Report foreground/background state to the relay.
    const cleanupAppState = setupAppStateSync();

    // Handle notification taps → deep link to conversation.
    const cleanupNotifications = setupNotificationResponseHandler((conversationId) => {
      router.push(`/chat?conversationId=${conversationId}`);
    });

    return () => {
      cleanupAppState();
      cleanupNotifications();
    };
  }, [router]);

  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ProfilesProvider>
          <BottomSheetModalProvider>
            <ThemedStack />
          </BottomSheetModalProvider>
        </ProfilesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
