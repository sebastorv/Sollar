/**
 * Sincronización con Supabase (tablas de supabase/schema.sql).
 *
 * Cada título de la lista es una fila con el LibraryItem completo en JSON. Al borrar un
 * título queda una fila marcada como borrada, para que el borrado llegue a los demás
 * dispositivos. Si dos dispositivos cambian el mismo título, gana el cambio más reciente:
 * lo decide el servidor comparando client_updated_at.
 */

import type { LibraryItem } from './types';
import { supabase } from './supabase';

export type RemoteRow = {
  key: string;
  data: LibraryItem | null;
  deleted: boolean;
  client_updated_at: string;
  updated_at: string;
};

export type PushRow = {
  key: string;
  data: LibraryItem | null;
  deleted: boolean;
  client_updated_at: string;
};

/** Margen al pedir cambios, por si una escritura terminó un poco después de su marca de tiempo. */
const OVERLAP_MS = 30_000;

export async function pushRows(userId: string, rows: PushRow[]): Promise<void> {
  if (!supabase || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200).map((r) => ({ ...r, user_id: userId }));
    const { error } = await supabase.from('library').upsert(part, { onConflict: 'user_id,key' });
    if (error) throw new Error(error.message);
  }
}

/** Cambios del servidor desde la última vez (con un margen de seguridad). */
export async function pullRows(since: string | null): Promise<RemoteRow[]> {
  if (!supabase) return [];
  const out: RemoteRow[] = [];
  const from = since ? new Date(new Date(since).getTime() - OVERLAP_MS).toISOString() : null;
  for (let page = 0; page < 50; page++) {
    let q = supabase
      .from('library')
      .select('key, data, deleted, client_updated_at, updated_at')
      .order('updated_at', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (from) q = q.gt('updated_at', from);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as RemoteRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export type RemoteSettings = { data: { myProviders?: number[] }; client_updated_at: string } | null;

export async function pullSettings(): Promise<RemoteSettings> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_settings').select('data, client_updated_at').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RemoteSettings) ?? null;
}

export async function pushSettings(userId: string, data: { myProviders: number[] }, at: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, data, client_updated_at: at }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/** Avisa cuando otro dispositivo cambia la lista. Devuelve la función para dejar de escuchar. */
export function onRemoteChange(userId: string, fn: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`library:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'library', filter: `user_id=eq.${userId}` }, fn)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` }, fn)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
