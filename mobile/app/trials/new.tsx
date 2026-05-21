import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Select, type SelectOption } from '@/components/Select';
import { api } from '@/lib/api';
import {
  createTrialFull,
  listClients,
  listCrops,
  listPests,
  type ClientRow,
  type CropRow,
  type PestRow,
  type TreatmentInput,
} from '@/lib/queries';
import type { TrialType } from '@/types/database';

const TRIAL_TYPES: SelectOption<TrialType>[] = [
  { value: 'insecticide', label: 'Insecticida' },
  { value: 'fungicide', label: 'Fungicida' },
  { value: 'nematicide', label: 'Nematicida' },
  { value: 'biostimulant', label: 'Bioestimulante' },
  { value: 'other', label: 'Otro' },
];

const PEST_CATEGORIES_FOR: Record<TrialType, string[] | null> = {
  insecticide: ['lepidoptera', 'hemiptera', 'thysanoptera', 'acari'],
  fungicide: ['disease_aerial', 'disease_soil'],
  nematicide: ['nematode'],
  biostimulant: null, // sin filtro
  other: null,
};

function defaultTreatments(n: number): TreatmentInput[] {
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    label: i === 0 ? 'Testigo absoluto' : `Tratamiento ${i + 1}`,
    is_control: i === 0,
  }));
}

export default function NewTrialScreen() {
  // ---- Datos generales ----
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [trialType, setTrialType] = useState<TrialType | null>('insecticide');
  const [clientId, setClientId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [pestId, setPestId] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');

  // ---- Diseño ----
  const [nTreatments, setNTreatments] = useState('4');
  const [nBlocks, setNBlocks] = useState('4');
  const [seed, setSeed] = useState('');

  // ---- Tratamientos editables ----
  const [treatments, setTreatments] = useState<TreatmentInput[]>(defaultTreatments(4));

  // ---- Catálogos ----
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [crops, setCrops] = useState<CropRow[]>([]);
  const [pests, setPests] = useState<PestRow[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, cr, p] = await Promise.all([listClients(), listCrops(), listPests()]);
        setClients(c);
        setCrops(cr);
        setPests(p);
      } catch (err: unknown) {
        Alert.alert('Error cargando catálogos', errMsg(err));
      } finally {
        setLoadingCatalogs(false);
      }
    })();
  }, []);

  // Resync de la lista de tratamientos cuando cambia n_treatments
  useEffect(() => {
    const n = Math.max(2, parseInt(nTreatments, 10) || 0);
    setTreatments((prev) => {
      if (prev.length === n) return prev;
      if (prev.length < n) {
        const extra = Array.from({ length: n - prev.length }, (_, i) => ({
          number: prev.length + i + 1,
          label: `Tratamiento ${prev.length + i + 1}`,
          is_control: false,
        }));
        return [...prev, ...extra];
      }
      return prev.slice(0, n);
    });
  }, [nTreatments]);

  const pestOptions = useMemo<SelectOption<string>[]>(() => {
    const cats = trialType ? PEST_CATEGORIES_FOR[trialType] : null;
    const list = cats ? pests.filter((p) => cats.includes(p.category)) : pests;
    return list.map((p) => ({
      value: p.id,
      label: p.common_name,
      hint: `${p.scientific_name} · ${p.default_unit}`,
    }));
  }, [pests, trialType]);

  const cropOptions = useMemo<SelectOption<string>[]>(
    () =>
      crops.map((c) => ({
        value: c.id,
        label: c.variety ? `${c.common_name} (${c.variety})` : c.common_name,
        hint: c.scientific_name,
      })),
    [crops]
  );

  const clientOptions = useMemo<SelectOption<string>[]>(
    () => clients.map((c) => ({ value: c.id, label: c.name })),
    [clients]
  );

  function updateTreatment(idx: number, patch: Partial<TreatmentInput>) {
    setTreatments((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function toggleControl(idx: number, val: boolean) {
    setTreatments((prev) =>
      prev.map((t, i) => ({
        ...t,
        is_control: i === idx ? val : val ? false : t.is_control,
      }))
    );
  }

  async function submit() {
    const nT = parseInt(nTreatments, 10);
    const nB = parseInt(nBlocks, 10);
    const seedNum = seed.trim() ? parseInt(seed, 10) : undefined;

    if (!code.trim()) return Alert.alert('Falta dato', 'El código del ensayo es obligatorio.');
    if (!name.trim()) return Alert.alert('Falta dato', 'El nombre del ensayo es obligatorio.');
    if (!trialType) return Alert.alert('Falta dato', 'Elegí el tipo de ensayo.');
    if (!cropId) return Alert.alert('Falta dato', 'Elegí el cultivo.');
    if (!Number.isFinite(nT) || nT < 2)
      return Alert.alert('Diseño', 'Debe haber al menos 2 tratamientos.');
    if (!Number.isFinite(nB) || nB < 2)
      return Alert.alert('Diseño', 'Debe haber al menos 2 bloques/repeticiones.');
    if (treatments.some((t) => !t.label.trim()))
      return Alert.alert('Tratamientos', 'Todos los tratamientos necesitan un nombre.');

    setBusy(true);
    try {
      const { plots: layout } = await api.rcbd(nT, nB, seedNum);
      const trial = await createTrialFull({
        code: code.trim(),
        name: name.trim(),
        client_id: clientId,
        crop_id: cropId,
        pest_id: pestId,
        trial_type: trialType,
        n_treatments: nT,
        n_replicates: nB,
        location: location.trim() || null,
        start_date: startDate.trim() || null,
        treatments,
        layout,
      });
      router.replace({ pathname: '/trials/[id]', params: { id: trial.id } });
    } catch (err: unknown) {
      Alert.alert('No se pudo crear el ensayo', errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Section title="Información general">
        <Field label="Código *">
          <TextInput
            style={styles.input}
            placeholder="T2026-001"
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
        </Field>
        <Field label="Nombre *">
          <TextInput
            style={styles.input}
            placeholder="Evaluación de insecticida en polilla del tomate"
            value={name}
            onChangeText={setName}
          />
        </Field>
        <Select
          label="Tipo de ensayo *"
          value={trialType}
          options={TRIAL_TYPES}
          onChange={(v) => {
            setTrialType(v);
            setPestId(null);
          }}
        />
        <Select
          label="Cliente"
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          placeholder={loadingCatalogs ? 'Cargando…' : 'Sin cliente'}
          searchable
        />
        <Select
          label="Cultivo *"
          value={cropId}
          options={cropOptions}
          onChange={setCropId}
          placeholder={loadingCatalogs ? 'Cargando…' : 'Elegir cultivo'}
          searchable
        />
        <Select
          label="Plaga / enfermedad objetivo"
          value={pestId}
          options={pestOptions}
          onChange={setPestId}
          placeholder={
            loadingCatalogs
              ? 'Cargando…'
              : pestOptions.length === 0
                ? 'Sin opciones para este tipo'
                : 'Elegir…'
          }
          searchable
          disabled={pestOptions.length === 0}
        />
        <Field label="Ubicación">
          <TextInput
            style={styles.input}
            placeholder="Invernadero 3, sector B"
            value={location}
            onChangeText={setLocation}
          />
        </Field>
        <Field label="Fecha de inicio (YYYY-MM-DD)">
          <TextInput
            style={styles.input}
            placeholder="2026-05-20"
            value={startDate}
            onChangeText={setStartDate}
          />
        </Field>
      </Section>

      <Section title="Diseño experimental (DBCA)">
        <View style={styles.row2}>
          <Field label="# Tratamientos" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={nTreatments}
              onChangeText={setNTreatments}
            />
          </Field>
          <Field label="# Repeticiones (bloques)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={nBlocks}
              onChangeText={setNBlocks}
            />
          </Field>
        </View>
        <Field label="Semilla (opcional, para reproducibilidad)">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={seed}
            onChangeText={setSeed}
            placeholder="ej. 42"
          />
        </Field>
        <Text style={styles.helper}>
          Se generarán {parseInt(nTreatments, 10) * parseInt(nBlocks, 10) || 0} parcelas
          aleatorizadas en {nBlocks} bloques.
        </Text>
      </Section>

      <Section title="Tratamientos">
        {treatments.map((t, i) => (
          <View key={i} style={styles.trtRow}>
            <Text style={styles.trtNum}>T{t.number}</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={t.label}
              onChangeText={(label) => updateTreatment(i, { label })}
              placeholder={`Tratamiento ${t.number}`}
            />
            <View style={styles.controlSwitch}>
              <Text style={styles.controlLabel}>Testigo</Text>
              <Switch
                value={t.is_control}
                onValueChange={(v) => toggleControl(i, v)}
              />
            </View>
          </View>
        ))}
      </Section>

      <Pressable style={[styles.submit, busy && styles.submitBusy]} disabled={busy} onPress={submit}>
        <Text style={styles.submitText}>{busy ? 'Creando…' : 'Generar y guardar ensayo'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
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

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Error desconocido';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
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
  trtRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  trtNum: { width: 36, fontWeight: '700', color: '#2e7d32' },
  controlSwitch: { alignItems: 'center' },
  controlLabel: { fontSize: 11, color: '#666' },
  submit: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBusy: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
