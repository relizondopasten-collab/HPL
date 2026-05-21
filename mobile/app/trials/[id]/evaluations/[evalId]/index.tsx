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

import { stageLabel } from '@/components/PlotCounter';
import {
  getEvaluation,
  getPest,
  listPestCountsForEvaluation,
  listPlotsForTrial,
  type EvaluationRow,
  type PestCountRow,
  type PestDetail,
  type PlotWithTreatment,
} from '@/lib/queries';

interface PlotSummary {
  plot: PlotWithTreatment;
  totals: Record<string, number>;
  samples: number;
}

export default function EvaluationDetailScreen() {
  const { id, evalId } = useLocalSearchParams<{ id: string; evalId: string }>();

  const [evaluation, setEvaluation] = useState<EvaluationRow | null>(null);
  const [pest, setPest] = useState<PestDetail | null>(null);
  const [plots, setPlots] = useState<PlotWithTreatment[]>([]);
  const [rows, setRows] = useState<PestCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !evalId) return;
    (async () => {
      try {
        const [ev, ps, cs] = await Promise.all([
          getEvaluation(evalId),
          listPlotsForTrial(id),
          listPestCountsForEvaluation(evalId),
        ]);
        setEvaluation(ev);
        setPlots(ps);
        setRows(cs);
        if (ev?.pest_id) setPest(await getPest(ev.pest_id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, evalId]);

  const stages = useMemo(() => {
    const fromRows = new Set<string>();
    for (const r of rows) if (r.life_stage) fromRows.add(r.life_stage);
    return [...fromRows];
  }, [rows]);

  const byPlot = useMemo<PlotSummary[]>(() => {
    const byId = new Map<string, PlotSummary>();
    for (const plot of plots) {
      byId.set(plot.id, { plot, totals: {}, samples: 0 });
    }
    const seenSamples = new Map<string, Set<number>>();
    for (const r of rows) {
      const item = byId.get(r.plot_id);
      if (!item) continue;
      if (r.life_stage) item.totals[r.life_stage] = (item.totals[r.life_stage] ?? 0) + r.alive;
      if (!seenSamples.has(r.plot_id)) seenSamples.set(r.plot_id, new Set());
      seenSamples.get(r.plot_id)!.add(r.sample_index);
    }
    for (const [plotId, set] of seenSamples) {
      const s = byId.get(plotId);
      if (s) s.samples = set.size;
    }
    return [...byId.values()].sort((a, b) => {
      if (a.plot.block !== b.plot.block) return a.plot.block - b.plot.block;
      return (a.plot.position_col ?? 0) - (b.plot.position_col ?? 0);
    });
  }, [plots, rows]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !evaluation) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'No encontrada'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.date}>{new Date(evaluation.evaluated_at).toLocaleString()}</Text>
        {pest && (
          <Text style={styles.meta}>
            🐛 {pest.common_name} — {pest.scientific_name}
          </Text>
        )}
        {evaluation.days_after_application !== null && (
          <Text style={styles.meta}>DDA: {evaluation.days_after_application}</Text>
        )}
        {evaluation.notes && <Text style={styles.notes}>{evaluation.notes}</Text>}

        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: '/trials/[id]/evaluations/[evalId]/analysis',
              params: { id: id!, evalId: evalId! },
            })
          }
        >
          <Text style={styles.ctaText}>📊 Analizar (ANOVA + Tukey + eficacia) →</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Conteos por parcela</Text>
        {stages.length === 0 ? (
          <Text style={styles.helper}>Esta evaluación no tiene conteos.</Text>
        ) : (
          <ScrollView horizontal>
            <View>
              <View style={styles.row}>
                <HCell head>Parcela</HCell>
                <HCell head>Trat</HCell>
                <HCell head># Muestras</HCell>
                {stages.map((s) => (
                  <HCell key={s} head>
                    {stageLabel(s)}
                  </HCell>
                ))}
              </View>
              {byPlot.map(({ plot, totals, samples }) => (
                <View key={plot.id} style={styles.row}>
                  <HCell>
                    B{plot.block}·C{plot.position_col ?? '?'}
                  </HCell>
                  <HCell>T{plot.treatment.number}</HCell>
                  <HCell>{samples}</HCell>
                  {stages.map((s) => (
                    <HCell key={s}>{totals[s] ?? 0}</HCell>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

function HCell({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <View style={[styles.cell, head && styles.cellHead]}>
      <Text style={head ? styles.cellHeadText : styles.cellText}>{children}</Text>
    </View>
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
  date: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, color: '#555' },
  notes: { fontSize: 13, color: '#333', marginTop: 6 },
  cta: {
    marginTop: 12,
    backgroundColor: '#1565c0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 12, color: '#666' },
  row: { flexDirection: 'row' },
  cell: {
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  cellHead: { backgroundColor: '#f3f3f3' },
  cellHeadText: { fontWeight: '700', fontSize: 12 },
  cellText: { fontSize: 13 },
});
