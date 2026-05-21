// Tipos espejo del schema de Supabase (subset usado por la app).
// Se actualizará manualmente mientras el schema evoluciona; cuando se estabilice
// se puede regenerar con `supabase gen types typescript`.

export type UserRole = 'admin' | 'researcher' | 'evaluator' | 'client';

export type TrialType = 'insecticide' | 'fungicide' | 'nematicide' | 'biostimulant' | 'other';
export type DesignType = 'rcbd' | 'crd' | 'split_plot' | 'latin_square';
export type TrialStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface Trial {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  crop_id: string | null;
  pest_id: string | null;
  trial_type: TrialType;
  design: DesignType;
  n_treatments: number;
  n_replicates: number;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  status: TrialStatus;
  created_at: string;
}

export interface Pest {
  id: string;
  scientific_name: string;
  common_name: string;
  category: string;
  default_unit: string;
}
