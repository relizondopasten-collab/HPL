import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from './supabase';

// =====================================================================
// Outbox: cola de mutaciones que se reintenta hasta lograr persistirlas.
// Diseñada para captura en campo sin garantía de red.
// =====================================================================

const QUEUE_KEY = 'outbox:queue';
const PHOTO_BUCKET = 'evaluations';

export interface PestCountInput {
  plot_id: string;
  sample_unit: string | null;
  sample_index: number;
  life_stage: string | null;
  alive: number;
  dead: number;
  notes?: string | null;
}

export interface PhotoInput {
  localUri: string;          // file:// URI en el dispositivo
  plot_id: string | null;
  caption: string | null;
}

export interface SubmitEvaluationPayload {
  evaluation: {
    trial_id: string;
    evaluated_at: string;
    pest_id: string | null;
    days_after_application: number | null;
    protocol_ref: string | null;
    notes: string | null;
  };
  counts: PestCountInput[];
  photos: PhotoInput[];
}

export type OutboxOp = {
  type: 'submit_evaluation';
  payload: SubmitEvaluationPayload;
};

export interface OutboxItem {
  id: string;
  op: OutboxOp;
  attempts: number;
  createdAt: number;
  lastError?: string;
}

// =================== Storage helpers ===================

async function readQueue(): Promise<OutboxItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutboxItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: OutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  notify();
}

// =================== Public API ===================

export async function enqueue(op: OutboxOp): Promise<string> {
  const item: OutboxItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    op,
    attempts: 0,
    createdAt: Date.now(),
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  // No esperamos: dispara procesamiento en background
  void processQueue().catch(() => undefined);
  return item.id;
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function listPending(): Promise<OutboxItem[]> {
  return readQueue();
}

let processing = false;

export async function processQueue(): Promise<{ ok: number; failed: number }> {
  if (processing) return { ok: 0, failed: 0 };
  processing = true;
  let ok = 0;
  let failed = 0;
  try {
    const queue = await readQueue();
    const remaining: OutboxItem[] = [];
    for (const item of queue) {
      try {
        await runOp(item.op);
        ok += 1;
      } catch (err) {
        failed += 1;
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
    return { ok, failed };
  } finally {
    processing = false;
  }
}

// =================== Listeners ===================

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

// =================== Ejecutores ===================

async function runOp(op: OutboxOp): Promise<void> {
  switch (op.type) {
    case 'submit_evaluation':
      await submitEvaluation(op.payload);
      return;
  }
}

async function submitEvaluation(p: SubmitEvaluationPayload): Promise<void> {
  // 1. Crear evaluation
  const { data: evalRow, error: e1 } = await supabase
    .from('evaluations')
    .insert(p.evaluation)
    .select('id')
    .single();
  if (e1 || !evalRow) throw e1 ?? new Error('No se pudo crear la evaluación');

  const evaluationId = evalRow.id as string;

  // 2. Conteos
  if (p.counts.length > 0) {
    const rows = p.counts.map((c) => ({
      evaluation_id: evaluationId,
      plot_id: c.plot_id,
      sample_unit: c.sample_unit,
      sample_index: c.sample_index,
      life_stage: c.life_stage,
      alive: c.alive,
      dead: c.dead,
      notes: c.notes ?? null,
    }));
    const { error: e2 } = await supabase.from('pest_counts').insert(rows);
    if (e2) throw e2;
  }

  // 3. Fotos
  for (const photo of p.photos) {
    const ext = photo.localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${p.evaluation.trial_id}/${evaluationId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const contentType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const arrayBuffer = await fetch(photo.localUri).then((r) => r.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert: false });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from('evaluation_photos').insert({
      evaluation_id: evaluationId,
      plot_id: photo.plot_id,
      storage_path: path,
      caption: photo.caption,
    });
    if (insErr) throw insErr;

    // Limpiar archivo local solo si todo lo anterior fue OK
    try {
      await FileSystem.deleteAsync(photo.localUri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
}
