// Arma la versión web instalable de Sollar en dist/.
//
//   node scripts/build-web.mjs            -> para la raíz de un dominio
//   WEB_BASE=/sollar node scripts/build-web.mjs  -> para GitHub Pages (usuario.github.io/sollar)
//
// Además de exportar con Expo: completa la ruta base en index.html, crea manifest.json,
// copia index.html como 404.html (para que GitHub Pages abra cualquier ruta) y agrega
// .nojekyll (GitHub ignoraría las carpetas que empiezan con guion bajo).

import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const base = (process.env.WEB_BASE ?? '').replace(/\/+$/, '');
// Versión de esta publicación: la app la compara con version.json para recargarse sola.
const version = String(Date.now());
execSync('npx expo export -p web --clear', { stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_BUILD: version } });
writeFileSync('dist/version.json', JSON.stringify({ version }));

const html = readFileSync('dist/index.html', 'utf8').replaceAll('__BASE__', base);
writeFileSync('dist/index.html', html);
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');

const manifest = {
  name: 'Sollar',
  short_name: 'Sollar',
  description: 'Tus series y películas: qué sigue, cuándo sale y dónde verlo.',
  lang: 'es',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'any',
  background_color: '#F7F6F9',
  theme_color: '#F7F6F9',
  icons: [
    { src: `${base}/logo192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/logo512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}/maskable512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Web lista en dist/ (base: "${base || '/'}")`);
