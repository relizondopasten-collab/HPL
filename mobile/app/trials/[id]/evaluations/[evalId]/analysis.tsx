import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { stageLabel } from '@/components/PlotCounter';
import { Select, type SelectOption } from '@/components/Select';
import { api, apiUrl, type AnalyzeResponse } from '@/lib/api';
import { downloadAndShare } from '@/lib/downloads';
import {
  getEvaluation,
  listPestCountsForEvaluation,
  listPlotsForTrial,
  type PestCountRow,
  type PlotWithTreatment,
} from '@/lib/queries';

const TOTAL = '__total__';

export default function AnalysisScreen() {
  const { id, evalId } = useLocalSearchParams<{ id: string; evalId: string }>();
  const [plots, setPlots] = useState<PlotWithTreatment[]>([]);
  const [rows, setRows] = useState<PestCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [variable, setVariable] = useState<string>(TOTAL);
  const [controlLabel, setControlLabel] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    if (!id || !evalId) return;
    (async () => {
      try {
        const [ps, cs] = await Promise.all([
          listPlotsForTrial(id),
          listPestCountsForEvaluation(evalId),
        ]);
        setPlots(ps);
        setRows(cs);
        // preselect control
        const ctl = ps.find((p) => p.treatment.is_control);
        if (ctl) setControlLabel(`T${ctl.treatment.number}`);
        // confirm evaluation exists
        await getEvaluation(evalId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, evalId]);

  const stages = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.life_stage) s.add(r.life_stage);
    return [...s];
  }, [rows]);

  const variableOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: TOTAL, label: 'Total de vivos (suma de estadios)' },
      ...stages.map((s) => ({ value: s, label: stageLabel(s) })),
    ],
    [stages]
  );

  const treatments = useMemo(() => {
    const seen = new Map<string, { number: number; label: string; is_control: boolean }>();
    for (const p of plots) seen.set(`T${p.treatment.number}`, p.treatment);
    return [...seen.entries()]
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => a.number - b.number);
  }, [plots]);

  const treatmentOptions = useMemo<SelectOption<string>[]>(
    () =>
      treatments.map((t) => ({
        value: t.key,
        label: `${t.key} — ${t.label}${t.is_control ? ' (testigo)' : ''}`,
      })),
    [treatments]
  );

  const dataset = useMemo(() => buildDataset(rows, plots, variable), [rows, plots, variable]);

  async function downloadReport(format: 'pdf' | 'xlsx') {
    if (!evalId || downloading) return;
    setDownloading(format);
    try {
      const url = apiUrl(
        `/reports/evaluation/${evalId}.${format}?variable=${encodeURIComponent(variable)}`
      );
      const filename = `evaluacion-${evalId.slice(0, 8)}.${format}`;
      const mime =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      await downloadAndShare(url, filename, mime);
    } catch (err) {
      Alert.alert('Error de descarga', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  }

  async function runAnalysis() {
    if (dataset.length < 4) {
      setError('Faltan datos: se necesitan al menos 4 observaciones (≥2 tratamientos × ≥2 bloques).');
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const r = await api.analyze(dataset, {
        control_treatment: controlLabel,
        use_block: true,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Variable a analizar</Text>
        <Select
          label="Estadio o agregado"
          value={variable}
          options={variableOptions}
          onChange={setVariable}
        />
        <Select
          label="Tratamiento testigo (para % eficacia)"
          value={controlLabel}
          options={treatmentOptions}
          onChange={setControlLabel}
          placeholder="Sin testigo"
        />
        <Text style={styles.helper}>
          Dataset: {dataset.length} observaciones (1 valor por parcela, promedio de muestras).
        </Text>
        <Pressable
          style={[styles.btn, analyzing && styles.btnBusy]}
          disabled={analyzing}
          onPress={runAnalysis}
        >
          <Text style={styles.btnText}>{analyzing ? 'Calculando…' : 'Analizar'}</Text>
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {result && (
        <>
          <ResultsTable result={result} />
          <Chart means={result.means} />
          <AnovaCard result={result} />
          <TukeyCard result={result} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reportes</Text>
            <Text style={styles.helper}>
              Generan un archivo descargable con el análisis actual de la variable “{
                variableOptions.find((o) => o.value === variable)?.label ?? variable
              }”.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.btn, { flex: 1 }, downloading === 'pdf' && styles.btnBusy]}
                disabled={!!downloading}
                onPress={() => downloadReport('pdf')}
              >
                <Text style={styles.btnText}>
                  {downloading === 'pdf' ? 'Descargando…' : '📄 PDF'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  { flex: 1, backgroundColor: '#2e7d32' },
                  downloading === 'xlsx' && styles.btnBusy,
                ]}
                disabled={!!downloading}
                onPress={() => downloadReport('xlsx')}
              >
                <Text style={styles.btnText}>
                  {downloading === 'xlsx' ? 'Descargando…' : '📊 Excel'}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// =================== helpers ===================

function buildDataset(
  rows: PestCountRow[],
  plots: PlotWithTreatment[],
  variable: string
): { treatment: string; block: string | null; value: number }[] {
  const byPlot = new Map<string, Map<number, number>>();
  for (const p of plots) byPlot.set(p.id, new Map());

  for (const r of rows) {
    const map = byPlot.get(r.plot_id);
    if (!map) continue;
    const stage = r.life_stage ?? '';
    if (variable === TOTAL) {
      map.set(r.sample_index, (map.get(r.sample_index) ?? 0) + r.alive);
    } else if (stage === variable) {
      map.set(r.sample_index, r.alive);
    }
  }

  const out: { treatment: string; block: string | null; value: number }[] = [];
  for (const p of plots) {
    const samples = byPlot.get(p.id);
    if (!samples || samples.size === 0) continue;
    const values = [...samples.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    out.push({
      treatment: `T${p.treatment.number}`,
      block: `B${p.block}`,
      value: mean,
    });
  }
  return out;
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function fmtP(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n < 0.001 ? '<0.001' : n.toFixed(4);
}

// =================== Subcomponents ===================

function ResultsTable({ result }: { result: AnalyzeResponse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Medias por tratamiento</Text>
      <Text style={styles.helper}>
        Letras: tratamientos con la misma letra no difieren (Tukey, α=0.05).
      </Text>
      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            <HCell head>Trat</HCell>
            <HCell head>n</HCell>
            <HCell head>Media</HCell>
            <HCell head>EE</HCell>
            <HCell head>Letra</HCell>
            <HCell head>Efic. %</HCell>
          </View>
          {result.means.map((m) => (
            <View key={m.treatment} style={styles.row}>
              <HCell>{m.treatment}</HCell>
              <HCell>{m.n}</HCell>
              <HCell>{fmt(m.mean)}</HCell>
              <HCell>{fmt(m.se)}</HCell>
              <HCell><Text style={styles.letter}>{m.letter || '—'}</Text></HCell>
              <HCell>
                {result.control_treatment && m.treatment === result.control_treatment
                  ? 'testigo'
                  : m.efficacy_pct === null
                    ? '—'
                    : fmt(m.efficacy_pct, 1) + '%'}
              </HCell>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Chart({ means }: { means: AnalyzeResponse['means'] }) {
  const max = Math.max(1, ...means.map((m) => m.mean + (m.se || 0)));
  const barH = 160;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Gráfico de medias</Text>
      <ScrollView horizontal>
        <View style={styles.chart}>
          {means.map((m) => {
            const h = (m.mean / max) * barH;
            const eeH = (m.se / max) * barH;
            return (
              <View key={m.treatment} style={styles.barCol}>
                <View style={{ height: barH + 20, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Text style={styles.barLetter}>{m.letter}</Text>
                  <View style={{ height: 4 }} />
                  {/* Whisker EE */}
                  {m.se > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: h - eeH,
                        height: eeH * 2,
                        width: 2,
                        backgroundColor: '#444',
                      }}
                    />
                  )}
                  <View style={[styles.bar, { height: h }]} />
                </View>
                <Text style={styles.barLabel}>{m.treatment}</Text>
                <Text style={styles.barMean}>{fmt(m.mean)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function AnovaCard({ result }: { result: AnalyzeResponse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Tabla ANOVA</Text>
      <Text style={styles.helper}>
        CV% = {fmt(result.cv_pct, 2)} · MSE = {fmt(result.mse, 3)} · n = {result.n_obs}
      </Text>
      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            <HCell head>Fuente</HCell>
            <HCell head>gl</HCell>
            <HCell head>SC</HCell>
            <HCell head>F</HCell>
            <HCell head>p</HCell>
          </View>
          {result.anova.map((a) => (
            <View key={a.source} style={styles.row}>
              <HCell>{a.source.replace('C(', '').replace(')', '')}</HCell>
              <HCell>{a.df === null ? '—' : a.df}</HCell>
              <HCell>{fmt(a.sum_sq, 3)}</HCell>
              <HCell>{fmt(a.F)}</HCell>
              <HCell>{fmtP(a['PR(>F)'])}</HCell>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function TukeyCard({ result }: { result: AnalyzeResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text style={styles.sectionTitle}>Tukey HSD ({result.tukey.length} pares) {open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <ScrollView horizontal>
          <View>
            <View style={styles.row}>
              <HCell head>A</HCell>
              <HCell head>B</HCell>
              <HCell head>Δ</HCell>
              <HCell head>p_adj</HCell>
              <HCell head>≠?</HCell>
            </View>
            {result.tukey.map((t, i) => (
              <View key={i} style={styles.row}>
                <HCell>{t.group1}</HCell>
                <HCell>{t.group2}</HCell>
                <HCell>{fmt(t.meandiff, 2)}</HCell>
                <HCell>{fmtP(t.p_adj)}</HCell>
                <HCell>
                  <Text style={{ color: t.reject ? '#c62828' : '#666' }}>
                    {t.reject ? 'sí' : 'no'}
                  </Text>
                </HCell>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function HCell({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <View style={[styles.cell, head && styles.cellHead]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={head ? styles.cellHeadText : styles.cellText}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 12, color: '#666' },
  btn: {
    backgroundColor: '#1565c0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnBusy: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#a30000', fontSize: 13 },

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
  letter: { fontWeight: '700', color: '#2e7d32' },

  chart: { flexDirection: 'row', paddingTop: 8, gap: 12, paddingHorizontal: 8 },
  barCol: { alignItems: 'center', minWidth: 56 },
  bar: { width: 32, backgroundColor: '#43a047', borderRadius: 4 },
  barLetter: { fontWeight: '700', color: '#2e7d32', fontSize: 13 },
  barLabel: { marginTop: 6, fontWeight: '600' },
  barMean: { fontSize: 11, color: '#666' },
});
