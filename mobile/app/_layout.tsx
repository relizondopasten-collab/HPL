import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/SyncBanner';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView edges={['top']} style={{ flex: 0 }}>
        <SyncBanner />
      </SafeAreaView>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: true }}>
          <Stack.Screen name="index" options={{ title: 'Estación Experimental' }} />
          <Stack.Screen name="login" options={{ title: 'Ingreso', headerBackVisible: false }} />
          <Stack.Screen name="trials/index" options={{ title: 'Ensayos' }} />
          <Stack.Screen name="trials/new" options={{ title: 'Nuevo ensayo' }} />
          <Stack.Screen name="trials/[id]/index" options={{ title: 'Detalle del ensayo' }} />
          <Stack.Screen
            name="trials/[id]/evaluations/index"
            options={{ title: 'Evaluaciones' }}
          />
          <Stack.Screen
            name="trials/[id]/evaluations/new"
            options={{ title: 'Nueva evaluación' }}
          />
          <Stack.Screen
            name="trials/[id]/evaluations/[evalId]/index"
            options={{ title: 'Evaluación' }}
          />
          <Stack.Screen
            name="trials/[id]/evaluations/[evalId]/analysis"
            options={{ title: 'Análisis' }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
