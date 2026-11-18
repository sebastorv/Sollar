/**
 * Parte social con Supabase (tablas de supabase/social.sql): tu perfil público, buscar y
 * seguir amigos, y ver lo que ven las personas que sigues.
 */

import { formatEpisode } from './progress';
import { supabase } from './supabase';
import type { LibraryItem } from './types';

export type Profile = { id: string; username: string; display_name: string; is_public: boolean };

export type FriendEvent = {
  profile: Profile;
  key: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  text: string;
  at: string;
};

/** Error claro cuando falta correr social.sql en Supabase. */
function explain(message: string): Error {
  if (/relation .*profiles|follows.* does not exist|schema cache/i.test(message)) {
    return new Error('Falta activar la parte social en Supabase (archivo supabase/social.sql).');
  }
  if (/duplicate key|unique/i.test(message)) return new Error('Ese nombre de usuario ya está en uso.');
  if (/check constraint/i.test(message)) {
    return new Error('El usuario debe tener de 3 a 24 caracteres: letras minúsculas, números, punto o guion bajo.');
  }
  return new Error(message);
}

export async function myProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw explain(error.message);
  return (data as Profile) ?? null;
}

export async function saveProfile(userId: string, p: Omit<Profile, 'id'>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...p, username: p.username.toLowerCase() });
  if (error) throw explain(error.message);
}

export async function searchProfiles(q: string, me: string): Promise<Profile[]> {
  if (!supabase || q.trim().length < 2) return [];
  const term = q.trim().replace(/[%_]/g, '');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .neq('id', me)
    .limit(20);
  if (error) throw explain(error.message);
  return (data ?? []) as Profile[];
}

export async function following(me: string): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', me);
  if (error) throw explain(error.message);
  const ids = (data ?? []).map((r: { following_id: string }) => r.following_id);
  if (!ids.length) return [];
  const { data: profs, error: e2 } = await supabase.from('profiles').select('*').in('id', ids);
  if (e2) throw explain(e2.message);
  return (profs ?? []) as Profile[];
}

export async function followers(me: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', me);
  return count ?? 0;
}

export async function follow(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('follows').insert({ following_id: id });
  if (error && !/duplicate/i.test(error.message)) throw explain(error.message);
}

export async function unfollow(me: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', id);
  if (error) throw explain(error.message);
}

/** Lo último que hicieron las personas que sigues (según los cambios en sus listas). */
export async function friendsActivity(people: Profile[]): Promise<FriendEvent[]> {
  if (!supabase || !people.length) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const { data, error } = await supabase
    .from('library')
    .select('user_id, key, data, updated_at')
    .in('user_id', [...byId.keys()])
    .eq('deleted', false)
    .not('key', 'like', 'list:%')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) throw explain(error.message);
  const out: FriendEvent[] = [];
  for (const row of (data ?? []) as { user_id: string; key: string; data: LibraryItem; updated_at: string }[]) {
    const it = row.data;
    const profile = byId.get(row.user_id);
    if (!it || !profile) continue;
    out.push({
      profile,
      key: row.key,
      tmdbId: it.tmdbId,
      mediaType: it.mediaType,
      title: it.title,
      posterPath: it.posterPath,
      text: describe(it),
      at: row.updated_at,
    });
  }
  return out;
}

function describe(it: LibraryItem): string {
  if (it.mediaType === 'tv') {
    let last: [string, string] | null = null;
    for (const [k, at] of Object.entries(it.watchedEpisodes)) if (!last || at > last[1]) last = [k, at];
    if (last && it.updatedAt.slice(0, 13) <= last[1].slice(0, 13)) {
      const [s, e] = last[0].split(':').map(Number);
      return `vio ${formatEpisode(s, e)}`;
    }
  } else if (it.watchedAt && it.updatedAt.slice(0, 13) <= it.watchedAt.slice(0, 13)) {
    return it.rating ? `vio y le puso ${it.rating}/10` : 'la vio';
  }
  if (it.rating) return `le puso ${it.rating}/10`;
  if (it.status === 'planned') return 'quiere verla';
  if (it.status === 'completed') return it.mediaType === 'tv' ? 'terminó la serie' : 'la vio';
  if (it.status === 'dropped') return 'la abandonó';
  return 'la está viendo';
}

/** "hace 5 min", "hace 3 h", "hace 2 d". */
export function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 30) return `hace ${Math.round(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
