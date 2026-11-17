# Sollar

App multiplataforma (iPhone, Android y web) para llevar el seguimiento de series y películas:
qué estás viendo, en qué episodio vas, qué quieres ver, calificaciones, notas y estadísticas.

"Sollar" es un nombre de trabajo (antes se llamó Butaca); se cambia en `app.json`. Antes de publicar,
conviene revisar el registro de marca en la SIC y en la base de marcas de la OMPI (clases 9, 41 y 42).

Este es el código base de la **fase 1** del plan (ver `docs/PLAN.md`): todo funciona en el
dispositivo, sin cuentas ni servidor.

## Qué hace ya

- **Buscar** series y películas (TMDB), con tendencias de la semana cuando no escribes nada.
- **Ficha** de cada título: sinopsis, géneros, duración, puntuación y **dónde verlo en Colombia**.
- **Estados**: Quiero ver, Viendo, Vista, En pausa, Abandonada.
- **Episodios**: marcar uno, una temporada completa, o mantener presionado para marcar hasta ahí.
- **Siguiendo**: el siguiente episodio de cada serie con un botón para marcarlo en un toque.
- **Calificación** de 1 a 10 (cinco estrellas con medias) y **nota personal**.
- **Estadísticas**: películas y episodios vistos, horas frente a la pantalla, géneros favoritos.
- **Respaldo**: exportar e importar toda tu lista en JSON.
- Si sale una temporada nueva de una serie que tenías como "Vista", vuelve sola a "Viendo".

## Requisitos

- Node.js 22 o más reciente.
- Una cuenta gratuita en [TMDB](https://www.themoviedb.org/signup) para el token de la API.
- En el celular, la app **Expo Go** (App Store o Play Store) para probar sin compilar nada.
- Para publicar en la App Store hace falta un Mac (ya lo tienes) o compilar en la nube con EAS.

## Probarla sin nada (modo demostración)

Sin token de TMDB la app arranca en **modo demostración**: 6 series y 6 películas de ejemplo con
sus temporadas y episodios, para probar todo el flujo. Las carátulas son tarjetas de color y
"Dónde ver" no aparece hasta conectar TMDB.

## Qué es el token de TMDB

TMDB es una base de datos gratuita de películas y series (como una enciclopedia). Para que la app
le pueda pedir datos, TMDB te da una **clave personal**, el "token": un texto largo que funciona
como una contraseña entre la app y TMDB. Se saca gratis con una cuenta y se pega en el archivo
`.env`. Con eso la app pasa del catálogo de ejemplo al catálogo completo.

## Primeros pasos

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
```

1. En TMDB entra a **Configuración > API**, solicita una clave de desarrollador y copia el
   **API Read Access Token** (el largo, no la "API Key" corta).
2. Pégalo en `.env` después de `EXPO_PUBLIC_TMDB_TOKEN=`.
3. Arranca:

```bash
npx expo start
```

- Escanea el código QR con la cámara (iPhone) o con Expo Go (Android).
- Presiona `w` para abrirla en el navegador.

Si cambias el `.env`, reinicia con `npx expo start --clear`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npx expo start` | Servidor de desarrollo |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npx expo export --platform web` | Genera la versión web en `dist/` |
| `npx eas-cli@latest build` | Compila para tiendas en la nube (fase de publicación) |

## Diseño

Plano y limpio, al estilo de Trakt: superficies lisas, formas redondeadas y un degradado vivo como
firma de la marca.

- **Tema** (`src/constants/theme.ts` y `src/store/theme.tsx`): modo claro (predeterminado), oscuro
  o el del teléfono, y tres degradados de marca: Brasa (predeterminado, `#FF8A3D` a `#F0306A`),
  Atardecer y Cereza. Se eligen en Perfil, Apariencia. Los colores se piden con `useColors()` y los
  estilos con `useStyles(makeStyles)`, así toda la app cambia al instante.
- **Logo** (`src/components/brand.tsx`): la palomita sonriente sobre el degradado. El ícono de la
  app y los demás recursos se generan con `docs/design/iconos.py`.
- **Calificación**: de 1 a 10 con bolsas de palomitas. La palomita grande reacciona a la nota
  (llora en 1, sonríe en 7, ojos de corazón en 10) y saltan palomitas al calificar.
- **Vidrio líquido** (`src/components/glass.tsx`): solo para lo que flota (barra de navegación,
  botón Atrás, paneles). En iPhone con iOS 26 usa el vidrio del sistema.

## Estructura

```
src/
  app/                    Pantallas (cada archivo es una ruta de Expo Router)
    (tabs)/index.tsx      Siguiendo
    (tabs)/buscar.tsx     Buscar
    (tabs)/lista.tsx      Mi lista
    (tabs)/perfil.tsx     Perfil, estadísticas, respaldo y créditos
    titulo/[tipo]/[id].tsx  Ficha de película o serie
  components/             Piezas de interfaz (ui.tsx, brand.tsx, title-card.tsx, pestañas)
  constants/theme.ts      Colores de los temas, espacios y radios
  lib/
    tmdb.ts               Cliente de la API de TMDB
    types.ts              Tipos del dominio
    progress.ts           Siguiente episodio, progreso y estadísticas (funciones puras)
    library-item.ts       Conversión de datos de TMDB y validación de respaldos
  store/library.tsx       Estado global y guardado local
  store/theme.tsx         Modo y color elegidos
supabase/schema.sql       Base de datos para la fase 2 (sincronización y social)
docs/PLAN.md              Plan del proyecto
```

## Antes de publicar (importante)

- **El token de TMDB no puede ir dentro de la app publicada.** Todo lo que empieza por
  `EXPO_PUBLIC_` queda visible en la app compilada. En la fase 2 las llamadas pasan por un
  servidor propio (Edge Function de Supabase) que guarda el token.
- **Licencia de TMDB:** la API es gratis para uso no comercial con atribución. Si la app va a
  generar ingresos (anuncios, suscripción), hay que pedir licencia comercial a TMDB.
- La atribución ya está en Perfil > Créditos, como exige TMDB, y "Datos de JustWatch" en "Dónde ver".

## Limitaciones conocidas

- TMDB a veces cuenta en una temporada episodios anunciados que aún no salen; en ese caso
  "Siguiendo" puede mostrar como siguiente un episodio sin estrenar.
- El respaldo en el celular se comparte como texto; en la fase 2 se guardará como archivo.
- Aún no hay cuentas ni sincronización entre dispositivos (fase 2).
