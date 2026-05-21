import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { listEvaluations, type EvaluationRow } from '@/lib/queries';

export default function EvaluationsListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [evals, setEvals] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const list = await listEvaluations(id);
      setEvals(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        data={evals}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Sin evaluaciones todavía</Text>
            <Text style={styles.emptyText}>
              Tocá “+ Nueva evaluación” para registrar la primera lectura del ensayo.
            </Text>
          </View>
        }
        contentContainerStyle={evals.length === 0 ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/trials/[id]/evaluations/[evalId]',
                params: { id: id!, evalId: item.id },
              })
            }
          >
            <Text style={styles.date}>
              {new Date(item.evaluated_at).toLocaleString()}
            </Text>
            <Text style={styles.meta}>
              {item.days_after_application !== null
                ? `DDA ${item.days_after_application}`
                : 'Sin DDA'}
            </Text>
            {item.notes && (
              <Text style={styles.notes} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </Pressable>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: '/trials/[id]/evaluations/new',
            params: { id: id! },
          })
        }
      >
        <Text style={styles.fabText}>+ Nueva evaluación</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  date: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  notes: { fontSize: 13, color: '#444', marginTop: 6 },
  empty: { padding: 32, alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  errorBox: { padding: 12, backgroundColor: '#fde7e7' },
  errorText: { color: '#a30000' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
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
});
