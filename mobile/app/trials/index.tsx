import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import type { Trial } from '@/types/database';

export default function TrialsScreen() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('trials')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setTrials((data ?? []) as Trial[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Recargar cada vez que volvamos a la pantalla (después de crear un ensayo)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Carga inicial (por si no entra al focus)
  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trials}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Sin ensayos todavía</Text>
            <Text style={styles.emptyText}>
              Tocá el botón “+ Nuevo ensayo” para crear el primero.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/trials/[id]', params: { id: item.id } })
            }
          >
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.trial_type} · {item.design.toUpperCase()} · T={item.n_treatments} R=
              {item.n_replicates}
            </Text>
            <Text style={styles.status}>{item.status}</Text>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={trials.length === 0 ? { flexGrow: 1 } : undefined}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/trials/new')}>
        <Text style={styles.fabText}>+ Nuevo ensayo</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  code: { fontSize: 12, color: '#666' },
  name: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  status: { fontSize: 12, color: '#2e7d32', marginTop: 4, textTransform: 'uppercase' },
  empty: { padding: 32, alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  errorBox: { padding: 12, backgroundColor: '#fde7e7' },
  errorText: { color: '#a30000' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 56,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700' },
  signOut: { padding: 14, alignItems: 'center' },
  signOutText: { color: '#a00' },
});
