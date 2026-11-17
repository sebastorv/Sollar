/**
 * Cuenta de usuario con Supabase: correo y contraseña.
 * Si la app no tiene Supabase configurado, no hay cuenta y todo vive en el dispositivo.
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { hasCloud, supabase } from '@/lib/supabase';

type AuthApi = {
  /** Ya se sabe si hay sesión guardada. */
  ready: boolean;
  /** La app usa servidor: hace falta iniciar sesión. */
  cloud: boolean;
  session: Session | null;
  email: string | null;
  userId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const Ctx = createContext<AuthApi | null>(null);

/** Traduce los errores de Supabase más comunes. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña no coinciden.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Falta confirmar el correo: revisa tu bandeja de entrada.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Ese correo no parece válido.';
  if (m.includes('rate limit')) return 'Demasiados intentos seguidos. Espera unos minutos.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisa tu internet.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!hasCloud);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      ready,
      cloud: hasCloud,
      session,
      email: session?.user.email ?? null,
      userId: session?.user.id ?? null,
      signIn: async (email, password) => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(friendly(error.message));
      },
      signUp: async (email, password) => {
        if (!supabase) return 'signed-in';
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(friendly(error.message));
        return data.session ? 'signed-in' : 'confirm-email';
      },
      signOut: async () => {
        await supabase?.auth.signOut();
      },
      resetPassword: async (email) => {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw new Error(friendly(error.message));
      },
    }),
    [ready, session],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
