// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { colors } from '@/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 1 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor={colors.bgDeep} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgMid },
            headerTintColor: colors.text1,
            headerTitleStyle: { fontFamily: 'Syne_600SemiBold', fontSize: 16 },
            contentStyle: { backgroundColor: colors.bgDeep },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="cotizador/[sesionId]" options={{ title: 'Cotización' }} />
          <Stack.Screen name="proyecto/[id]" options={{ title: 'Proyecto' }} />
          <Stack.Screen name="cliente/[id]" options={{ title: 'Cliente' }} />
          <Stack.Screen name="ot/[id]" options={{ title: 'Orden de Trabajo' }} />
        </Stack>
        <Toast />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
