-- Sollar: tablas para sincronizar tu lista entre dispositivos.
-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run. Se puede correr
-- más de una vez sin dañar nada.

-- Cada título de tu lista: el registro completo en JSON. Al borrar un título queda la
-- fila marcada como borrada para que el borrado llegue a tus otros dispositivos.
create table if not exists public.library (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,                        -- "movie:603" o "tv:1399"
  data jsonb,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,   -- cuándo cambió en el dispositivo
  updated_at timestamptz not null default now(),  -- cuándo llegó al servidor
  primary key (user_id, key)
);
create index if not exists library_user_updated on public.library (user_id, updated_at);

-- Preferencias que viajan con la cuenta (por ahora, tus plataformas).
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Si dos dispositivos cambian lo mismo, se queda el cambio más reciente.
create or replace function public.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists library_keep_newest on public.library;
create trigger library_keep_newest before insert or update on public.library
  for each row execute function public.keep_newest();
drop trigger if exists settings_keep_newest on public.user_settings;
create trigger settings_keep_newest before insert or update on public.user_settings
  for each row execute function public.keep_newest();

-- Seguridad: cada cuenta solo ve y cambia lo suyo.
alter table public.library enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "library: solo lo propio" on public.library;
create policy "library: solo lo propio" on public.library
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "settings: solo lo propio" on public.user_settings;
create policy "settings: solo lo propio" on public.user_settings
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.library to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

-- Aviso en tiempo real a tus otros dispositivos cuando algo cambia.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'library') then
    alter publication supabase_realtime add table public.library;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'user_settings') then
    alter publication supabase_realtime add table public.user_settings;
  end if;
end $$;
