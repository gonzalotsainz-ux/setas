-- Setas: diario compartido SIN LOGIN (decisión de la usuaria, 2026-09-30).
-- Cualquiera con la URL y la clave publicable puede leer y editar el diario.
-- `autor` es solo un nombre que se elige en el dispositivo (p. ej. 'Alejandra', 'Gonzalo').

create table public.salidas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  zona_id text not null,
  lat double precision,
  lon double precision,
  especies jsonb not null default '[]'::jsonb,   -- [{ "especie_id": "boletus-edulis", "kg": 1.2 }]
  notas text not null default '',
  meteo jsonb,                                   -- foto fija de la serie del punto más cercano ese día
  indice jsonb,                                  -- resultado de indiceZona ese día
  autor text,
  creado timestamptz not null default now()
);
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  salida_id uuid not null references public.salidas (id) on delete cascade,
  ruta text not null,
  ancho int, alto int,
  creado timestamptz not null default now()
);
create table public.ajustes_umbrales (
  especie_id text primary key,
  parametros jsonb not null,
  autor text,
  actualizado timestamptz not null default now()
);
create table public.aemet_cache (
  clave text primary key,
  datos jsonb not null,
  creado timestamptz not null default now()
);

alter table public.salidas enable row level security;
alter table public.fotos enable row level security;
alter table public.ajustes_umbrales enable row level security;
alter table public.aemet_cache enable row level security;   -- sin políticas: solo la Edge Function (service role)

create policy "abierto salidas" on public.salidas for all to anon, authenticated using (true) with check (true);
create policy "abierto fotos" on public.fotos for all to anon, authenticated using (true) with check (true);
create policy "abierto umbrales" on public.ajustes_umbrales for all to anon, authenticated using (true) with check (true);

-- Bucket público de lectura; solo imágenes JPEG/WebP de hasta 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/webp'];

create policy "fotos: ver" on storage.objects for select to anon, authenticated
  using (bucket_id = 'fotos');
create policy "fotos: subir" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fotos' and lower(name) ~ '\.(jpe?g|webp)$');
create policy "fotos: cambiar" on storage.objects for update to anon, authenticated
  using (bucket_id = 'fotos') with check (bucket_id = 'fotos' and lower(name) ~ '\.(jpe?g|webp)$');
create policy "fotos: borrar" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'fotos');
