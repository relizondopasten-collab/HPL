import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  getTrial,
  listPlotsForTrial,
  type PlotWithTreatment,
} from '@/lib/queries';
import type { Trial } from '@/types/database';

const CELL_W = 84;
const CELL_H = 56;

export default function TrialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trial, setTrial] = useState<Trial | null>(null);
  const [plots, setPlots] = useState<PlotWithTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [t, p] = await Promise.all([getTrial(id), listPlotsForTrial(id)]);
        setTrial(t);
        setPlots(p);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error cargando ensayo');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const grid = useMemo(() => buildGrid(plots), [plots]);
  const treatments = useMemo(() => uniqueTreatments(plots), [plots]);
  const colors = useMemo(() => paletteFor(treatments.length), [treatments.length]);
  const colorByTrt = useMemo(() => {
    const m = new Map<number, string>();
    treatments.forEach((t, i) => m.set(t.number, colors[i]));
    return m;
  }, [treatments, colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !trial) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Ensayo no encontrado'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.code}>{trial.code}</Text>
        <Text style={styles.name}>{trial.name}</Text>
        <Text style={styles.meta}>
          {trial.trial_type} · {trial.design.toUpperCase()} · T={trial.n_treatments} R=
          {trial.n_replicates}
        </Text>
        {trial.location && <Text style={styles.meta}>📍 {trial.location}</Text>}
        {trial.start_date && <Text style={styles.meta}>Inicio: {trial.start_date}</Text>}
        <Text style={[styles.status, { color: '#2e7d32' }]}>
          {trial.status.toUpperCase()}
        </Text>

        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: '/trials/[id]/evaluations',
              params: { id: trial.id },
            })
          }
        >
          <Text style={styles.ctaText}>Ver / capturar evaluaciones →</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Mapa de campo (DBCA)</Text>
        <Text style={styles.helper}>
          Cada fila es un bloque. Cada celda es una parcela con su tratamiento.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {grid.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                <View style={styles.blockLabel}>
                  <Text style={styles.blockLabelText}>B{ri + 1}</Text>
                </View>
                {row.map((plot, ci) => (
                  <View
                    key={ci}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: plot
                          ? colorByTrt.get(plot.treatment.number) ?? '#eee'
                          : '#f0f0f0',
                      },
                    ]}
                  >
                    {plot && (
                      <>
                        <Text style={styles.cellTrt}>T{plot.treatment.number}</Text>
                        {plot.treatment.is_control && (
                          <Text style={styles.cellTag}>testigo</Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tratamientos</Text>
        {treatments.map((t) => (
          <View key={t.id} style={styles.trtItem}>
            <View
              style={[styles.swatch, { backgroundColor: colorByTrt.get(t.number) ?? '#ccc' }]}
            />
            <Text style={styles.trtLabel}>
              T{t.number} — {t.label}
              {t.is_control ? '  (testigo)' : ''}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// -------------------- helpers --------------------

function buildGrid(plots: PlotWithTreatment[]): (PlotWithTreatment | null)[][] {
  if (plots.length === 0) return [];
  const maxBlock = Math.max(...plots.map((p) => p.block));
  const maxCol = Math.max(...plots.map((p) => p.position_col ?? 1));
  const grid: (PlotWithTreatment | null)[][] = Array.from({ length: maxBlock }, () =>
    Array.from({ length: maxCol }, () => null)
  );
  for (const p of plots) {
    const r = p.block - 1;
    const c = (p.position_col ?? 1) - 1;
    if (grid[r]) grid[r][c] = p;
  }
  return grid;
}

function uniqueTreatments(plots: PlotWithTreatment[]) {
  const seen = new Map<string, PlotWithTreatment['treatment']>();
  for (const p of plots) seen.set(p.treatment.id, p.treatment);
  return [...seen.values()].sort((a, b) => a.number - b.number);
}

function paletteFor(n: number): string[] {
  if (n <= 0) return [];
  return Array.from(
    { length: n },
    (_, i) => `hsl(${Math.round((360 * i) / n)}, 55%, 75%)`
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#a30000' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  code: { color: '#666', fontSize: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13, color: '#555' },
  status: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  cta: {
    marginTop: 12,
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700' },

  sectionTitle: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 12, color: '#666', marginBottom: 4 },

  gridRow: { flexDirection: 'row', alignItems: 'center' },
  blockLabel: {
    width: 36,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockLabelText: { fontWeight: '700', color: '#444' },
  cell: {
    width: CELL_W,
    height: CELL_H,
    margin: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cellTrt: { fontWeight: '700', fontSize: 16, color: '#1a1a1a' },
  cellTag: { fontSize: 10, color: '#333', marginTop: 2 },

  trtItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  swatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  trtLabel: { fontSize: 14 },
});
