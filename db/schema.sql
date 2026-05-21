-- =============================================================
-- Estación Experimental Agrícola - Schema MVP
-- Para ejecutar en Supabase SQL Editor sobre un proyecto vacío.
-- Asume que `auth.users` ya existe (Supabase Auth).
-- =============================================================

create extension if not exists "uuid-ossp";

-- =============================================================
-- 1. Usuarios y roles
-- =============================================================

do $$ begin
  create type user_role as enum ('admin', 'researcher', 'evaluator', 'client');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'evaluator',
  client_id   uuid,                       -- si role='client', a qué cliente pertenece
  created_at  timestamptz default now()
);

-- =============================================================
-- 2. Catálogos
-- =============================================================

create table if not exists clients (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  contact_email text,
  notes         text,
  created_at    timestamptz default now()
);

alter table profiles
  drop constraint if exists profiles_client_id_fkey,
  add  constraint profiles_client_id_fkey foreign key (client_id) references clients(id) on delete set null;

create table if not exists crops (
  id              uuid primary key default uuid_generate_v4(),
  scientific_name text not null,
  common_name     text not null,
  variety         text,
  unique (scientific_name, variety)
);

do $$ begin
  create type pest_category as enum (
    'lepidoptera',
    'hemiptera',
    'thysanoptera',
    'acari',
    'disease_aerial',
    'disease_soil',
    'nematode'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type life_stage as enum (
    'egg', 'larva_n1', 'larva_n2', 'larva_n3', 'larva_n4',
    'nymph', 'pupa', 'adult', 'mobile_form'
  );
exception when duplicate_object then null; end $$;

create table if not exists pests (
  id              uuid primary key default uuid_generate_v4(),
  scientific_name text not null unique,
  common_name     text not null,
  category        pest_category not null,
  stages          life_stage[] not null default '{}',
  default_unit    text not null,                  -- ej: 'larvas/planta', 'ninfas/cm²'
  protocol_ref    text                            -- ej: 'EPPO PP 1/281'
);

create table if not exists products (
  id                uuid primary key default uuid_generate_v4(),
  trade_name        text not null,
  active_ingredient text not null,
  concentration     text,                         -- '240 g/L'
  formulation       text,                         -- SC, EC, WG...
  product_type      text,                         -- insecticide, fungicide, biostimulant, nematicide
  irac_frac         text,                         -- grupo de resistencia
  manufacturer      text
);

-- =============================================================
-- 3. Ensayos
-- =============================================================

do $$ begin
  create type trial_type as enum (
    'insecticide', 'fungicide', 'nematicide', 'biostimulant', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type design_type as enum (
    'rcbd', 'crd', 'split_plot', 'latin_square'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type trial_status as enum (
    'draft', 'in_progress', 'completed', 'archived'
  );
exception when duplicate_object then null; end $$;

create table if not exists trials (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique,
  name          text not null,
  client_id     uuid references clients(id),
  crop_id       uuid references crops(id),
  pest_id       uuid references pests(id),
  trial_type    trial_type not null,
  design        design_type not null default 'rcbd',
  n_treatments  int not null check (n_treatments > 0),
  n_replicates  int not null check (n_replicates > 0),
  start_date    date,
  end_date      date,
  location      text,
  status        trial_status not null default 'draft',
  created_by    uuid references profiles(id),
  created_at    timestamptz default now()
);

create index if not exists trials_status_idx on trials(status);
create index if not exists trials_client_idx on trials(client_id);

create table if not exists treatments (
  id                 uuid primary key default uuid_generate_v4(),
  trial_id           uuid not null references trials(id) on delete cascade,
  number             int not null,                -- T1, T2, T3...
  label              text not null,               -- 'Control', 'Producto X 50 mL/hL'
  product_id         uuid references products(id),
  dose               numeric,
  dose_unit          text,                        -- 'mL/hL', 'g/ha'
  is_control         boolean default false,
  application_method text,
  notes              text,
  unique (trial_id, number)
);

create table if not exists plots (
  id           uuid primary key default uuid_generate_v4(),
  trial_id     uuid not null references trials(id) on delete cascade,
  block        int not null,
  treatment_id uuid not null references treatments(id),
  position_row int,                               -- coordenada en el mapa
  position_col int,
  n_plants     int,                               -- plantas evaluadas
  notes        text,
  unique (trial_id, block, treatment_id)
);

create index if not exists plots_trial_idx on plots(trial_id);

create table if not exists applications (
  id                    uuid primary key default uuid_generate_v4(),
  trial_id              uuid not null references trials(id) on delete cascade,
  applied_at            timestamptz not null,
  applied_by            uuid references profiles(id),
  spray_volume_l_per_ha numeric,
  temperature_c         numeric,
  humidity_pct          numeric,
  wind_kmh              numeric,
  equipment             text,
  notes                 text
);

create index if not exists applications_trial_idx on applications(trial_id, applied_at);

-- =============================================================
-- 4. Evaluaciones y mediciones
-- =============================================================

create table if not exists evaluations (
  id                     uuid primary key default uuid_generate_v4(),
  trial_id               uuid not null references trials(id) on delete cascade,
  evaluated_at           timestamptz not null,
  evaluator_id           uuid references profiles(id),
  pest_id                uuid references pests(id),
  related_application_id uuid references applications(id),
  days_after_application int,
  protocol_ref           text,
  notes                  text,
  created_at             timestamptz default now()
);

create index if not exists evaluations_trial_idx on evaluations(trial_id, evaluated_at);

create table if not exists pest_counts (
  id            uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  plot_id       uuid not null references plots(id),
  sample_unit   text,                            -- 'planta', 'hoja', 'trampa', 'trifoliada'
  sample_index  int,                             -- 1..n dentro de la parcela
  life_stage    life_stage,
  alive         int not null default 0,
  dead          int not null default 0,
  notes         text
);

create index if not exists pest_counts_eval_idx on pest_counts(evaluation_id);
create index if not exists pest_counts_plot_idx on pest_counts(plot_id);

-- Severidad / incidencia (enfermedades). Pre-cargado aunque el MVP es de plagas,
-- así no duplicamos modelo cuando entren las enfermedades.
create table if not exists disease_assessments (
  id              uuid primary key default uuid_generate_v4(),
  evaluation_id   uuid not null references evaluations(id) on delete cascade,
  plot_id         uuid not null references plots(id),
  sample_unit     text,
  sample_index    int,
  severity_pct    numeric check (severity_pct between 0 and 100),
  incidence_pct   numeric check (incidence_pct between 0 and 100),
  scale_value     int,                           -- valor de escala diagramática (0-10, etc.)
  scale_ref       text,                          -- 'Horsfall-Barratt', 'Bridge & Page'
  notes           text
);

-- Métricas fisiológicas para bioestimulantes.
create table if not exists physiology_readings (
  id            uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  plot_id       uuid not null references plots(id),
  variable      text not null,                   -- 'spad', 'fv_fm', 'gs', 'rwc', 'ce_soil'
  unit          text,
  value         numeric not null,
  notes         text
);

create table if not exists evaluation_photos (
  id            uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  plot_id       uuid references plots(id),
  storage_path  text not null,                   -- ruta en Supabase Storage
  taken_at      timestamptz default now(),
  caption       text
);

-- =============================================================
-- 5. Sensores ambientales (CE, T°, HR, PAR continuos)
-- =============================================================

create table if not exists sensor_devices (
  id        uuid primary key default uuid_generate_v4(),
  trial_id  uuid references trials(id) on delete set null,
  name      text not null,
  location  text,
  variable  text not null,                       -- 'ec', 'temp_c', 'rh_pct', 'par'
  unit      text not null
);

create table if not exists sensor_readings (
  id        bigserial primary key,
  device_id uuid not null references sensor_devices(id) on delete cascade,
  ts        timestamptz not null,
  value     numeric not null
);

create index if not exists sensor_readings_dev_ts_idx on sensor_readings(device_id, ts desc);

-- =============================================================
-- 6. Row Level Security (políticas mínimas)
--    Se refinarán cuando entren clientes externos.
-- =============================================================

alter table profiles            enable row level security;
alter table clients             enable row level security;
alter table crops               enable row level security;
alter table pests               enable row level security;
alter table products            enable row level security;
alter table trials              enable row level security;
alter table treatments          enable row level security;
alter table plots               enable row level security;
alter table applications        enable row level security;
alter table evaluations         enable row level security;
alter table pest_counts         enable row level security;
alter table disease_assessments enable row level security;
alter table physiology_readings enable row level security;
alter table evaluation_photos   enable row level security;
alter table sensor_devices      enable row level security;
alter table sensor_readings     enable row level security;

-- Política provisional: cualquier usuario autenticado lee/escribe.
-- TODO: separar admin/researcher/evaluator/client cuando entre el rol cliente.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','clients','crops','pests','products','trials','treatments','plots',
      'applications','evaluations','pest_counts','disease_assessments',
      'physiology_readings','evaluation_photos','sensor_devices','sensor_readings'
    ])
  loop
    execute format('drop policy if exists "auth read" on %I', t);
    execute format('drop policy if exists "auth write" on %I', t);
    execute format($p$create policy "auth read"  on %I for select using (auth.role() = 'authenticated')$p$, t);
    execute format($p$create policy "auth write" on %I for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$p$, t);
  end loop;
end $$;
