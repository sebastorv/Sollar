-- Sollar: parte social (perfiles públicos y seguir amigos).
-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run.
-- Se puede correr más de una vez sin dañar nada.

-- Perfil público: nombre de usuario para que te encuentren.
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null default '',
  -- Si es falso, nadie más ve tu actividad (aunque te sigan).
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- Quién sigue a quién.
create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references auth.users on delete cascade,
  following_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;

-- Cualquiera con cuenta puede buscar perfiles; cada quien edita el suyo.
drop policy if exists "perfiles: ver" on public.profiles;
create policy "perfiles: ver" on public.profiles for select to authenticated using (true);
drop policy if exists "perfiles: editar el propio" on public.profiles;
create policy "perfiles: editar el propio" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Seguimientos: los ves si eres parte; solo creas o borras los tuyos.
drop policy if exists "seguir: ver" on public.follows;
create policy "seguir: ver" on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, following_id));
drop policy if exists "seguir: lo propio" on public.follows;
create policy "seguir: lo propio" on public.follows for all to authenticated
  using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);

-- Tu lista la pueden leer quienes te siguen, si tu perfil es público.
drop policy if exists "library: la ven tus seguidores" on public.library;
create policy "library: la ven tus seguidores" on public.library for select to authenticated using (
  exists (
    select 1 from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = (select auth.uid()) and f.following_id = library.user_id and p.is_public
  )
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.follows to authenticated;
