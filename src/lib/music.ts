/**
 * Bandas sonoras: se buscan en el catálogo de Apple Music (la API pública de iTunes, sin clave).
 * Trae los álbumes de la banda sonora de un título y sus canciones, con un avance de 30 segundos
 * que se puede escuchar dentro de la app.
 *
 * En la web se pide con JSONP (iTunes lo admite), porque el navegador bloquea la lectura directa
 * desde otra página; en iPhone y Android se pide normal.
 */

import { Platform } from 'react-native';

export type Album = {
  id: number;
  name: string;
  artist: string;
  art: string | null;
  year: string | null;
  url: string | null;
  count: number;
};

export type Track = {
  id: number;
  name: string;
  artist: string;
  ms: number;
  preview: string | null;
  url: string | null;
  number: number;
  disc: number;
};

type RawItem = {
  wrapperType?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  collectionViewUrl?: string;
  trackCount?: number;
  trackId?: number;
  trackName?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
  trackViewUrl?: string;
  trackNumber?: number;
  discNumber?: number;
  kind?: string;
};

const cache = new Map<string, unknown>();
let seq = 0;

function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__sollarMusic${++seq}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const timer = setTimeout(() => done(new Error('timeout')), 12000);
    function done(err: Error | null, data?: T) {
      clearTimeout(timer);
      delete w[name];
      script.remove();
      if (err) reject(err);
      else resolve(data as T);
    }
    w[name] = (data: T) => done(null, data);
    script.src = `${url}&callback=${name}`;
    script.onerror = () => done(new Error('network'));
    document.head.appendChild(script);
  });
}

async function itunes(path: string, params: Record<string, string>): Promise<RawItem[]> {
  const url = `https://itunes.apple.com/${path}?${new URLSearchParams(params).toString()}`;
  if (cache.has(url)) return cache.get(url) as RawItem[];
  const data =
    Platform.OS === 'web' ? await jsonp<{ results: RawItem[] }>(url) : ((await (await fetch(url)).json()) as { results: RawItem[] });
  cache.set(url, data.results ?? []);
  return data.results ?? [];
}

/** Letras y números en minúscula, sin tildes: para comparar nombres. */
function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const OST = /(soundtrack|original score|score from|music from|original (motion picture|series|television|tv)|banda sonora|\bost\b|songs from|the score)/i;

function art(url?: string, size = 600) {
  return url ? url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`) : null;
}

/**
 * Los álbumes de la banda sonora de un título. Busca por el título (y por el título original si
 * es distinto) y deja solo los que lo nombran y dicen ser banda sonora o música original.
 */
export async function findSoundtracks(titles: string[], year: string | null): Promise<Album[]> {
  const names = [...new Set(titles.filter(Boolean))];
  const found = new Map<number, RawItem>();
  for (const t of names) {
    for (const term of [`${t} soundtrack`, `${t} original score`]) {
      const res = await itunes('search', { term, media: 'music', entity: 'album', limit: '25', country: 'US' }).catch(() => []);
      for (const r of res) if (r.collectionId) found.set(r.collectionId, r);
    }
  }
  const keys = names.map(norm).filter((k) => k.length > 1);
  const y = year ? Number(year) : null;
  const albums = [...found.values()].filter((r) => {
    const n = norm(r.collectionName ?? '');
    if (!keys.some((k) => n.includes(k))) return false;
    if (!OST.test(r.collectionName ?? '')) return false;
    // Nada anterior al estreno (salvo un año de margen): evita homónimos viejos.
    const ry = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null;
    return !(y && ry && ry < y - 1);
  });
  const score = (r: RawItem) => {
    const n = r.collectionName ?? '';
    return (/original/i.test(n) ? 2 : 0) + (/score/i.test(n) ? 1 : 0) + Math.min(r.trackCount ?? 0, 30) / 30;
  };
  return albums
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8)
    .map((r) => ({
      id: r.collectionId!,
      name: r.collectionName ?? '',
      artist: r.artistName ?? '',
      art: art(r.artworkUrl100),
      year: r.releaseDate?.slice(0, 4) ?? null,
      url: r.collectionViewUrl ?? null,
      count: r.trackCount ?? 0,
    }));
}

/** Las canciones de un álbum, en orden. */
export async function albumTracks(albumId: number): Promise<Track[]> {
  const res = await itunes('lookup', { id: String(albumId), entity: 'song', limit: '200', country: 'US' });
  return res
    .filter((r) => r.wrapperType === 'track' && r.trackId)
    .map((r) => ({
      id: r.trackId!,
      name: r.trackName ?? '',
      artist: r.artistName ?? '',
      ms: r.trackTimeMillis ?? 0,
      preview: r.previewUrl ?? null,
      url: r.trackViewUrl ?? null,
      number: r.trackNumber ?? 0,
      disc: r.discNumber ?? 1,
    }))
    .sort((a, b) => a.disc - b.disc || a.number - b.number);
}

/** "3:42". */
export function trackTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// --- Reproductor de avances (uno a la vez) ---

type Listener = (id: number | null) => void;
let audio: HTMLAudioElement | null = null;
let current: number | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

export function onPreviewChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Reproduce o detiene el avance de una canción. Devuelve false si no se puede aquí. */
export function togglePreview(track: Track): boolean {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined' || !track.preview) return false;
  if (current === track.id && audio) {
    audio.pause();
    current = null;
    emit();
    return true;
  }
  audio?.pause();
  audio = new Audio(track.preview);
  current = track.id;
  audio.onended = () => {
    current = null;
    emit();
  };
  audio.play().catch(() => {
    current = null;
    emit();
  });
  emit();
  return true;
}

export function stopPreview() {
  audio?.pause();
  current = null;
  emit();
}
