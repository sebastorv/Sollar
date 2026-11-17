// Sollar: puente hacia TMDB. Guarda el token de TMDB en secreto (TMDB_TOKEN) y solo
// atiende a personas con sesión iniciada en Sollar.
//
// Crear en Supabase > Edge Functions > Deploy a new function > Via Editor, con el nombre
// "tmdb". Desactivar "Verify JWT" (la función revisa la sesión por su cuenta).

const TMDB = 'https://api.themoviedb.org/3';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, accept, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Sesiones ya revisadas, para no consultar en cada llamada.
const checked = new Map<string, number>();

function reply(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ') || !apikey) return false;
  const until = checked.get(auth);
  if (until && until > Date.now()) return true;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: auth, apikey },
  });
  if (!res.ok) return false;
  if (checked.size > 500) checked.clear();
  checked.set(auth, Date.now() + 5 * 60 * 1000);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return reply({ error: 'Método no permitido' }, 405);
  if (!(await signedIn(req))) return reply({ error: 'Inicia sesión en Sollar' }, 401);

  const token = Deno.env.get('TMDB_TOKEN');
  if (!token) return reply({ error: 'Falta el secreto TMDB_TOKEN en Supabase' }, 500);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/tmdb(?=\/)/, '');
  if (!/^\/[a-z0-9_/]+$/i.test(path)) return reply({ error: 'Ruta no válida' }, 400);

  const res = await fetch(`${TMDB}${path}${url.search}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
  });
});
