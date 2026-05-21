# Estación Experimental Agrícola

Plataforma para gestión, captura de datos y análisis de ensayos agrícolas
(insecticidas, fungicidas, nematicidas, bioestimulantes).

## Estructura

```
estacion-experimental/
├── db/                 SQL para Supabase (schema, RLS, seeds)
├── backend/            Microservicio Python (FastAPI) para estadística y reportes
└── mobile/             App móvil Expo + React Native (iOS / Android)
```

## Stack

| Capa | Tecnología |
|---|---|
| App móvil | Expo + React Native (TypeScript) |
| Base de datos + Auth + Storage | Supabase (PostgreSQL gestionado) |
| Estadística y reportes | FastAPI + scipy / statsmodels / pingouin / WeasyPrint |

## Estado del MVP

- [x] **H1 — Scaffold**: estructura, schema SQL (17 tablas), backend FastAPI, app móvil base
- [x] **H2 — Diseño de ensayos**: crear ensayo desde la app, generar DBCA aleatorizado, mapa de campo
- [x] **H3 — Captura en campo (offline)**: evaluaciones con conteos por estadio, fotos, cache de lecturas y outbox de escrituras
- [x] **H4 — Análisis estadístico end-to-end**: ANOVA RCBD + Tukey HSD con letras compactas, eficacia Abbott vs. testigo, gráfico de medias
- [x] **H5 — Reportes PDF / Excel**: descarga desde la app, PDF con WeasyPrint y Excel con openpyxl (resumen, tratamientos, parcelas, conteos crudos y análisis)

## Arranque rápido

### 1. Base de datos (Supabase)

1. Crear proyecto en https://supabase.com
2. SQL Editor → ejecutar `db/schema.sql`
3. SQL Editor → ejecutar `db/seed.sql`
4. SQL Editor → ejecutar `db/storage.sql` (crea el bucket `evaluations` para fotos)
5. Copiar `Project URL` y `anon key` (Settings → API)

### 2. Backend

WeasyPrint (generación de PDF) requiere dependencias nativas en el sistema operativo:

```bash
# macOS
brew install pango libffi

# Debian / Ubuntu
sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0
```

Luego:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar con tus llaves de Supabase (incluyendo SERVICE_KEY para reportes)
uvicorn app.main:app --reload --port 8000
```

Pruebas rápidas:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/design/rcbd -H "Content-Type: application/json" \
  -d '{"n_treatments": 4, "n_blocks": 4, "seed": 42}'
curl -X POST http://localhost:8000/stats/abbott -H "Content-Type: application/json" \
  -d '{"control_alive": 100, "treated_alive": 12}'
```

### 3. App móvil

```bash
cd mobile
npm install
cp .env.example .env   # editar con tus llaves de Supabase
npx expo start
```

Escanear el QR con la app **Expo Go** (iOS / Android) o pulsar `i` / `a` para
abrir el simulador.
