import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DateField } from '@/components/DateField';
import { PhotoCapture, type CapturedPhoto } from '@/components/PhotoCapture';
import { PlotCounter, type Counts } from '@/components/PlotCounter';
import { Select, type SelectOption } from '@/components/Select';
import { enqueue, type PestCountInput } from '@/lib/outbox';
import {
  getPest,
  getTrial,
  listPests,
  listPlotsForTrial,
  type PestRow,
  type PestDetail,
  type PlotWithTreatment,
} from '@/lib/queries';
import type { Trial } from '@/types/database';

const DEFAULT_SAMPLE_UNIT = 'planta';

export default function NewEvaluationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trial, setTrial] = useState<Trial | null>(null);
  const [plots, setPlots] = useState<PlotWithTreatment[]>([]);
  const [pests, setPests] = useState<PestRow[]>([]);
  const [pestId, setPestId] = useState<string | null>(null);
  const [pestDetail, setPestDetail] = useState<PestDetail | null>(null);

  const [evaluatedAt, setEvaluatedAt] = useState<Date>(() => new Date());
  const [dda, setDda] = useState('');
  const [protocolRef, setProtocolRef] = useState('');
  const [notes, setNotes] = useState('');
  const [sampleUnit, setSampleUnit] = useState(DEFAULT_SAMPLE_UNIT);
  const [nSamples, setNSamples] = useState('3');

  const [counts, setCounts] = useState<Counts>({});
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [t, ps, allPests] = await Promise.all([
          getTrial(id),
          listPlotsForTrial(id),
          listPests(),
        ]);
        setTrial(t);
        setPlots(ps);
        setPests(allPests);
        const initialPestId = t?.pest_id ?? null;
        setPestId(initialPestId);
        if (initialPestId) {
          const detail = await getPest(initialPestId);
          setPestDetail(detail);
        }
      } catch (err) {
        Alert.alert('Error cargando ensayo', err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Recargar detalle de plaga cuando cambia
  useEffect(() => {
    if (!pestId) {
      setPestDetail(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const d = await getPest(pestId);
        if (alive) setPestDetail(d);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [pestId]);

  const pestOptions = useMemo<SelectOption<string>[]>(
    () =>
      pests.map((p) => ({
        value: p.id,
        label: p.common_name,
        hint: `${p.scientific_name} · ${p.default_unit}`,
      })),
    [pests]
  );

  const stages = useMemo(() => pestDetail?.stages ?? ['adult'], [pestDetail]);

  const colorByTrt = useMemo(() => {
    const trts = [
      ...new Map(plots.map((p) => [p.treatment.number, p.treatment])).values(),
    ].sort((a, b) => a.number - b.number);
    const m = new Map<number, string>();
    trts.forEach((t, i) =>
      m.set(t.number, `hsl(${Math.round((360 * i) / trts.length)}, 55%, 75%)`)
    );
    return m;
  }, [plots]);

  const updateCount = useCallback(
    (plotId: string, sampleIdx: number, stage: string, value: number) => {
      setCounts((prev) => {
        const next = { ...prev };
        const forPlot = { ...(next[plotId] ?? {}) };
        const forSample = { ...(forPlot[sampleIdx] ?? {}) };
        forSample[stage] = value;
        forPlot[sampleIdx] = forSample;
        next[plotId] = forPlot;
        return next;
      });
    },
    []
  );

  const capturedSummary = useMemo(() => {
    const nS = Math.max(1, parseInt(nSamples, 10) || 1);
    let plotsWithData = 0;
    let totalSamples = 0;
    for (const plot of plots) {
      const pd = counts[plot.id];
      if (!pd) continue;
      let hasAny = false;
      for (let i = 1; i <= nS; i++) {
        if (pd[i] && Object.values(pd[i]).some((v) => (v ?? 0) > 0)) {
          totalSamples += 1;
          hasAny = true;
        }
      }
      if (hasAny) plotsWithData += 1;
    }
    return { plotsWithData, totalSamples };
  }, [counts, plots, nSamples]);

  async function save() {
    if (!id || !trial) return;
    const nS = Math.max(1, parseInt(nSamples, 10) || 1);
    const ddaNum = dda.trim() ? parseInt(dda, 10) : null;

    // Aplanar counts → PestCountInput[]
    const flat: PestCountInput[] = [];
    for (const plot of plots) {
      const pd = counts[plot.id];
      if (!pd) continue;
      for (let i = 1; i <= nS; i++) {
        const sample = pd[i];
        if (!sample) continue;
        for (const [stage, alive] of Object.entries(sample)) {
          if (!Number.isFinite(alive) || alive < 0) continue;
          flat.push({
            plot_id: plot.id,
            sample_unit: sampleUnit,
            sample_index: i,
            life_stage: stage,
            alive,
            dead: 0,
          });
        }
      }
    }

    if (flat.length === 0 && photos.length === 0) {
      return Alert.alert(
        'Sin datos',
        'Capturá al menos una muestra o agregá una foto antes de guardar.'
      );
    }

    setSaving(true);
    try {
      await enqueue({
        type: 'submit_evaluation',
        payload: {
          evaluation: {
            trial_id: id,
            evaluated_at: evaluatedAt.toISOString(),
            pest_id: pestId,
            days_after_application: ddaNum,
            protocol_ref: protocolRef.trim() || null,
            notes: notes.trim() || null,
          },
          counts: flat,
          photos: photos.map((p) => ({ localUri: p.uri, plot_id: null, caption: p.caption })),
        },
      });
      Alert.alert(
        'Evaluación encolada',
        'Se subirá automáticamente cuando haya conexión.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!trial) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Ensayo no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos de la evaluación</Text>
        <DateField
          label="Fecha y hora"
          value={evaluatedAt}
          onChange={setEvaluatedAt}
          mode="datetime"
        />
        <Select
          label="Plaga / enfermedad evaluada"
          value={pestId}
          options={pestOptions}
          onChange={setPestId}
          placeholder="Elegir…"
          searchable
        />
        {pestDetail && (
          <Text style={styles.helper}>
            Estadios: {stages.length ? stages.join(', ') : '—'} · Unidad sugerida:{' '}
            {pestDetail.default_unit}
          </Text>
        )}
        <View style={styles.row2}>
          <Field label="DDA" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={dda}
              onChangeText={setDda}
              placeholder="días post aplicación"
            />
          </Field>
          <Field label="Protocolo" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={protocolRef}
              onChangeText={setProtocolRef}
              placeholder="EPPO PP 1/..."
            />
          </Field>
        </View>
        <View style={styles.row2}>
          <Field label="Unidad de muestreo" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={sampleUnit}
              onChangeText={setSampleUnit}
              placeholder="planta, hoja, trampa"
            />
          </Field>
          <Field label="# muestras por parcela" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={nSamples}
              onChangeText={setNSamples}
            />
          </Field>
        </View>
        <Field label="Notas">
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Condiciones, observaciones..."
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Conteos por parcela
        </Text>
        <Text style={styles.helper}>
          {capturedSummary.plotsWithData} de {plots.length} parcelas con datos ·{' '}
          {capturedSummary.totalSamples} muestras capturadas
        </Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {plots.map((plot) => (
            <PlotCounter
              key={plot.id}
              plot={plot}
              nSamples={Math.max(1, parseInt(nSamples, 10) || 1)}
              stages={stages}
              counts={counts}
              onChange={updateCount}
              colorByTrt={colorByTrt}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fotos</Text>
        <PhotoCapture photos={photos} onChange={setPhotos} />
      </View>

      <Pressable
        style={[styles.submit, saving && styles.submitBusy]}
        disabled={saving}
        onPress={save}
      >
        <Text style={styles.submitText}>
          {saving ? 'Guardando…' : 'Guardar evaluación'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  style,
  children,
}: {
  label: string;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#a30000' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  row2: { flexDirection: 'row', gap: 12 },
  helper: { fontSize: 12, color: '#666' },
  submit: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBusy: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
