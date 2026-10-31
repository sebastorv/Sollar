-- Esquema para la fase 2 de Butaca (sincronización y funciones sociales) en Supabase.
-- Se ejecuta en el editor SQL de Supabase. Todavía no está conectado a la app:
-- ver docs/PLAN.md, sección 6.

-- Perfil público de cada usuario (Supabase Auth crea la fila en auth.users).
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- Un título en la biblioteca de un usuario. Mismos campos que LibraryItem en src/lib/types.ts.
create table public.library_items (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,                         -- "movie:603" o "tv:1399"
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  backdrop_path text,
  year text,
  genres text[] not null default '{}',
  status text not null check (status in ('planned', 'watching', 'completed', 'paused', 'dropped')),
  rating smallint check (rating between 1 and 10),
  note text not null default '',
  runtime integer,
  seasons jsonb not null default '[]',       -- [{seasonNumber, episodeCount, name}]
  watched_at timestamptz,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Un registro por episodio visto: permite historial, rachas y "qué vieron mis amigos".
create table public.episode_watches (
  user_id uuid not null references auth.users on delete cascade,
  tmdb_id integer not null,
  season smallint not null,
  episode smallint not null,
  watched_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, season, episode)
);

-- Seguidores (fase 3, red social).
create table public.follows (
  follower_id uuid not null references auth.users on delete cascade,
  following_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index library_items_user_updated on public.library_items (user_id, updated_at desc);
create index episode_watches_user_time on public.episode_watches (user_id, watched_at desc);

-- Seguridad a nivel de fila: cada quien solo escribe lo suyo.
alter table public.profiles enable row level security;
alter table public.library_items enable row level security;
alter table public.episode_watches enable row level security;
alter table public.follows enable row level security;

create policy "perfil: leer públicos o propio" on public.profiles
  for select using (is_public or auth.uid() = id);
create policy "perfil: editar propio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "biblioteca: leer propia o de perfil público" on public.library_items
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
  );
create policy "biblioteca: escribir propia" on public.library_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "episodios: leer propios o de perfil público" on public.episode_watches
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
  );
create policy "episodios: escribir propios" on public.episode_watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "seguidores: leer" on public.follows for select using (true);
create policy "seguidores: gestionar los propios" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
