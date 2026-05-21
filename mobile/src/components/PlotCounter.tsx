import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PlotWithTreatment } from '@/lib/queries';

export type Counts = Record<string, Record<number, Record<string, number>>>;
// plot_id -> sampleIdx -> life_stage -> alive

interface Props {
  plot: PlotWithTreatment;
  nSamples: number;
  stages: string[];
  counts: Counts;
  onChange: (plotId: string, sampleIdx: number, stage: string, value: number) => void;
  colorByTrt: Map<number, string>;
}

export function PlotCounter({ plot, nSamples, stages, counts, onChange, colorByTrt }: Props) {
  const [open, setOpen] = useState(false);
  const plotData = counts[plot.id] ?? {};

  const summary = useMemo(() => {
    let totalAlive = 0;
    let samplesWithData = 0;
    for (let i = 1; i <= nSamples; i++) {
      const sample = plotData[i];
      if (!sample) continue;
      const hasAny = Object.values(sample).some((n) => typeof n === 'number' && n > 0);
      if (hasAny) samplesWithData += 1;
      for (const v of Object.values(sample)) totalAlive += v ?? 0;
    }
    return { totalAlive, samplesWithData };
  }, [plotData, nSamples]);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <View style={[styles.swatch, { backgroundColor: colorByTrt.get(plot.treatment.number) ?? '#ccc' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Bloque {plot.block} · Col {plot.position_col ?? '?'} · T{plot.treatment.number}
            {plot.treatment.is_control ? ' (testigo)' : ''}
          </Text>
          <Text style={styles.subtitle}>
            {summary.samplesWithData}/{nSamples} muestras · Σ vivos = {summary.totalAlive}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.row}>
                <Cell head>Muestra</Cell>
                {stages.map((s) => (
                  <Cell key={s} head>
                    {stageLabel(s)}
                  </Cell>
                ))}
              </View>
              {Array.from({ length: nSamples }, (_, i) => i + 1).map((idx) => (
                <View key={idx} style={styles.row}>
                  <Cell>#{idx}</Cell>
                  {stages.map((s) => {
                    const v = plotData[idx]?.[s];
                    return (
                      <View key={s} style={styles.cell}>
                        <TextInput
                          style={styles.input}
                          keyboardType="number-pad"
                          value={typeof v === 'number' ? String(v) : ''}
                          onChangeText={(text) => {
                            const n = parseInt(text, 10);
                            onChange(plot.id, idx, s, Number.isFinite(n) ? n : 0);
                          }}
                          placeholder="0"
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Cell({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <View style={[styles.cell, head && styles.cellHead]}>
      <Text style={head ? styles.cellHeadText : styles.cellText}>{children}</Text>
    </View>
  );
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    egg: 'huevo',
    larva_n1: 'L1',
    larva_n2: 'L2',
    larva_n3: 'L3',
    larva_n4: 'L4',
    nymph: 'ninfa',
    pupa: 'pupa',
    adult: 'adulto',
    mobile_form: 'móvil',
  };
  return map[stage] ?? stage;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  swatch: { width: 16, height: 16, borderRadius: 3 },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  chevron: { fontSize: 18, color: '#666' },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee', padding: 8 },
  row: { flexDirection: 'row' },
  cell: {
    minWidth: 60,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHead: { backgroundColor: '#f3f3f3' },
  cellHeadText: { fontWeight: '700', fontSize: 12 },
  cellText: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
});
