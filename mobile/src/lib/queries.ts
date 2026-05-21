import { supabase } from './supabase';
import { cacheRead } from './cache';
import type { Trial, TrialType } from '@/types/database';

// -------------------- Catálogos --------------------

export interface ClientRow {
  id: string;
  name: string;
}

export interface CropRow {
  id: string;
  scientific_name: string;
  common_name: string;
  variety: string | null;
}

export interface PestRow {
  id: string;
  scientific_name: string;
  common_name: string;
  category: string;
  default_unit: string;
}

export async function listClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listCrops(): Promise<CropRow[]> {
  const { data, error } = await supabase
    .from('crops')
    .select('id, scientific_name, common_name, variety')
    .order('common_name');
  if (error) throw error;
  return data ?? [];
}

export async function listPests(): Promise<PestRow[]> {
  const { data, error } = await supabase
    .from('pests')
    .select('id, scientific_name, common_name, category, default_unit')
    .order('common_name');
  if (error) throw error;
  return data ?? [];
}

// -------------------- Ensayos --------------------

export interface TreatmentInput {
  number: number;
  label: string;
  is_control: boolean;
}

export interface LayoutPlot {
  block: number;
  col: number;
  treatment: number; // treatment number (no id todavía)
}

export interface CreateTrialInput {
  code: string;
  name: string;
  client_id: string | null;
  crop_id: string | null;
  pest_id: string | null;
  trial_type: TrialType;
  n_treatments: number;
  n_replicates: number;
  location: string | null;
  start_date: string | null;
  treatments: TreatmentInput[];
  layout: LayoutPlot[];
}

export async function createTrialFull(input: CreateTrialInput): Promise<Trial> {
  const { data: trial, error: e1 } = await supabase
    .from('trials')
    .insert({
      code: input.code,
      name: input.name,
      client_id: input.client_id,
      crop_id: input.crop_id,
      pest_id: input.pest_id,
      trial_type: input.trial_type,
      design: 'rcbd',
      n_treatments: input.n_treatments,
      n_replicates: input.n_replicates,
      location: input.location,
      start_date: input.start_date,
      status: 'draft',
    })
    .select()
    .single();
  if (e1 || !trial) throw e1 ?? new Error('No se pudo crear el ensayo');

  const { data: trts, error: e2 } = await supabase
    .from('treatments')
    .insert(
      input.treatments.map((t) => ({
        trial_id: trial.id,
        number: t.number,
        label: t.label,
        is_control: t.is_control,
      }))
    )
    .select('id, number');
  if (e2 || !trts) {
    await supabase.from('trials').delete().eq('id', trial.id);
    throw e2 ?? new Error('No se pudieron crear los tratamientos');
  }

  const idByNumber = new Map<number, string>(trts.map((t) => [t.number, t.id]));

  const plots = input.layout.map((p) => ({
    trial_id: trial.id,
    block: p.block,
    treatment_id: idByNumber.get(p.treatment)!,
    position_row: p.block,
    position_col: p.col,
  }));

  const { error: e3 } = await supabase.from('plots').insert(plots);
  if (e3) {
    await supabase.from('trials').delete().eq('id', trial.id);
    throw e3;
  }

  return trial as Trial;
}

export async function getTrial(id: string): Promise<Trial | null> {
  const r = await cacheRead(`trial:${id}`, async () => {
    const { data, error } = await supabase
      .from('trials')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Trial;
  });
  return r.value;
}

export interface PlotWithTreatment {
  id: string;
  block: number;
  position_row: number | null;
  position_col: number | null;
  treatment: {
    id: string;
    number: number;
    label: string;
    is_control: boolean;
  };
}

export async function listPlotsForTrial(trialId: string): Promise<PlotWithTreatment[]> {
  const r = await cacheRead(`plots:${trialId}`, async () => {
    const { data, error } = await supabase
      .from('plots')
      .select(
        'id, block, position_row, position_col, treatment:treatments(id, number, label, is_control)'
      )
      .eq('trial_id', trialId)
      .order('block')
      .order('position_col');
    if (error) throw error;
    return (data ?? []) as unknown as PlotWithTreatment[];
  });
  return r.value;
}

// =============================================================
//                     Evaluaciones
// =============================================================

export interface PestDetail {
  id: string;
  scientific_name: string;
  common_name: string;
  category: string;
  default_unit: string;
  stages: string[];
}

export async function getPest(id: string): Promise<PestDetail | null> {
  const r = await cacheRead(`pest:${id}`, async () => {
    const { data, error } = await supabase
      .from('pests')
      .select('id, scientific_name, common_name, category, default_unit, stages')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as PestDetail;
  });
  return r.value;
}

export interface EvaluationRow {
  id: string;
  trial_id: string;
  evaluated_at: string;
  pest_id: string | null;
  days_after_application: number | null;
  notes: string | null;
  created_at: string;
}

export async function listEvaluations(trialId: string): Promise<EvaluationRow[]> {
  // No cacheable: queremos ver pendientes recién subidos al instante.
  const { data, error } = await supabase
    .from('evaluations')
    .select('id, trial_id, evaluated_at, pest_id, days_after_application, notes, created_at')
    .eq('trial_id', trialId)
    .order('evaluated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EvaluationRow[];
}

export async function getEvaluation(id: string): Promise<EvaluationRow | null> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as EvaluationRow;
}

export interface PestCountRow {
  id: string;
  evaluation_id: string;
  plot_id: string;
  sample_unit: string | null;
  sample_index: number;
  life_stage: string | null;
  alive: number;
  dead: number;
}

export async function listPestCountsForEvaluation(
  evaluationId: string
): Promise<PestCountRow[]> {
  const { data, error } = await supabase
    .from('pest_counts')
    .select('*')
    .eq('evaluation_id', evaluationId);
  if (error) throw error;
  return (data ?? []) as PestCountRow[];
}
