import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PlatformProvider } from '@/contexts/PlatformContext';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { requestNotificationPermissions } from '@/services/pushNotifications';

export default function RootLayout() {
  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    // Request push notification permissions on first launch
    requestNotificationPermissions();
  }, []);

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <PlatformProvider config={{ darkMode: true, language: 'ar' }}>
          <AuthProvider>
            <NotificationsProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="index" />
                <Stack.Screen name="register" />
                <Stack.Screen name="driver-register" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="driver/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="trip-waiting" />
                <Stack.Screen name="trip-tracking" />
                <Stack.Screen name="trip-chat" />
                <Stack.Screen name="trip-details" />
                <Stack.Screen name="complaints" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="admin-dashboard" />
                <Stack.Screen name="admin-users" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="driver-search" />
                <Stack.Screen name="coupons" options={{ presentation: 'modal' }} />
                <Stack.Screen name="settings" />
                <Stack.Screen name="driver-registration-docs" />
                <Stack.Screen name="rewards" />
                <Stack.Screen name="payment" />
                <Stack.Screen name="driver-dashboard" />
                <Stack.Screen name="account-type" />
              </Stack>
            </NotificationsProvider>
          </AuthProvider>
        </PlatformProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
