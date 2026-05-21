const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const apiUrl = (path: string): string => `${API_URL}${path}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  rcbd: (n_treatments: number, n_blocks: number, seed?: number) =>
    request<{ plots: { block: number; col: number; treatment: number }[] }>(
      '/design/rcbd',
      { method: 'POST', body: JSON.stringify({ n_treatments, n_blocks, seed }) }
    ),

  abbott: (control_alive: number, treated_alive: number) =>
    request<{ efficacy_pct: number | null }>('/stats/abbott', {
      method: 'POST',
      body: JSON.stringify({ control_alive, treated_alive }),
    }),

  hendersonTilton: (
    control_pre: number,
    control_post: number,
    treated_pre: number,
    treated_post: number
  ) =>
    request<{ efficacy_pct: number | null }>('/stats/henderson-tilton', {
      method: 'POST',
      body: JSON.stringify({ control_pre, control_post, treated_pre, treated_post }),
    }),

  analyze: (
    observations: { treatment: string; block: string | null; value: number }[],
    options: { control_treatment?: string | null; use_block?: boolean } = {}
  ) =>
    request<AnalyzeResponse>('/stats/analyze-evaluation', {
      method: 'POST',
      body: JSON.stringify({
        observations,
        control_treatment: options.control_treatment ?? null,
        use_block: options.use_block ?? true,
      }),
    }),
};

export interface AnovaRow {
  source: string;
  sum_sq: number | null;
  df: number | null;
  F: number | null;
  'PR(>F)': number | null;
}

export interface TukeyRow {
  group1: string;
  group2: string;
  meandiff: number;
  p_adj: number;
  lower: number;
  upper: number;
  reject: boolean;
}

export interface MeanRow {
  treatment: string;
  n: number;
  mean: number;
  sd: number;
  se: number;
  letter: string;
  efficacy_pct: number | null;
}

export interface AnalyzeResponse {
  anova: AnovaRow[];
  tukey: TukeyRow[];
  means: MeanRow[];
  grand_mean: number;
  mse: number;
  cv_pct: number;
  n_obs: number;
  control_treatment: string | null;
}
