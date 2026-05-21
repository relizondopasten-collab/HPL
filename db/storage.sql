-- =============================================================
-- Supabase Storage: bucket "evaluations" para fotos de evaluación.
-- Ejecutar UNA VEZ tras el schema principal.
-- =============================================================

-- Bucket privado (no exponer URL pública sin firmar)
insert into storage.buckets (id, name, public)
values ('evaluations', 'evaluations', false)
on conflict (id) do nothing;

-- Políticas: cualquier usuario autenticado puede leer y escribir en este bucket.
-- Refinar cuando entren clientes externos.

drop policy if exists "evaluations read auth" on storage.objects;
drop policy if exists "evaluations write auth" on storage.objects;
drop policy if exists "evaluations update auth" on storage.objects;
drop policy if exists "evaluations delete auth" on storage.objects;

create policy "evaluations read auth"
  on storage.objects for select
  using (bucket_id = 'evaluations' and auth.role() = 'authenticated');

create policy "evaluations write auth"
  on storage.objects for insert
  with check (bucket_id = 'evaluations' and auth.role() = 'authenticated');

create policy "evaluations update auth"
  on storage.objects for update
  using (bucket_id = 'evaluations' and auth.role() = 'authenticated');

create policy "evaluations delete auth"
  on storage.objects for delete
  using (bucket_id = 'evaluations' and auth.role() = 'authenticated');
