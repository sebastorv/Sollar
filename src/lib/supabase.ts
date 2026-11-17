/**
 * Cliente de Supabase: cuenta de usuario, sincronización de la lista y acceso a TMDB a través
 * del servidor. Si no hay datos de Supabase en el entorno, la app funciona solo en el dispositivo.
 */

import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Hay servidor configurado: se pide iniciar sesión y la lista se sincroniza. */
export const hasCloud = url.length > 0 && key.length > 0;

export const SUPABASE_URL = url.replace(/\/+$/, '');
export const SUPABASE_KEY = key;

export const supabase = hasCloud
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// En el teléfono, la sesión se renueva solo mientras la app está abierta.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Token de la sesión actual, para llamar a las funciones del servidor. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
