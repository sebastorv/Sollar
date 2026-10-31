# Butaca: plan del proyecto (versión corta para el repositorio)

El plan completo, con tablas, diagrama y fuentes, está en el documento "Butaca: plan del proyecto"
(octubre de 2026). Este archivo resume lo que hace falta mientras se programa.

## 1. Resumen

App de seguimiento de series y películas en español, para iPhone, Android y web con un solo código.
Stack: Expo (React Native) + TypeScript, Supabase desde la fase 2, datos de TMDB.

## 2. Oportunidad

TV Time cerró el 15 de julio de 2026 y borró los datos no exportados. Las alternativas (Trakt,
Serializd, Simkl, Letterboxd, Moviebase) no están pensadas primero para español y Latinoamérica.

## 3. Diferenciación

- Español real y "Dónde ver" por país latinoamericano.
- Series y películas en una sola lista.
- Exportar e importar los datos desde el primer día.
- Un toque para marcar el siguiente episodio.

## 4. Fases

| Fase | Qué se construye | Se pasa a la siguiente cuando |
| --- | --- | --- |
| 1. App personal (hecha) | Buscar, ficha, estados, episodios, calificación, notas, estadísticas, dónde ver, respaldo | La usas a diario dos semanas |
| 2. Cuentas y sincronización | Login, sincronización, servidor con el token, importar TV Time/Trakt/Letterboxd, avisos de estrenos | 20 a 50 personas la usan sin perder datos |
| 3. Publicación | Marca final, privacidad, borrar cuenta, App Store y Google Play | Aprobada y retención estable |
| 4. Social y crecimiento | Perfiles, amigos, reseñas, tarjetas para compartir, resumen anual | Usuarios que comparten solos |
| 5. Ingresos | Butaca Pro y licencia comercial de TMDB | Antes del primer cobro |

## 5. Stack

Expo SDK 58, React Native 0.88, React 19.3, Expo Router, TypeScript estricto, AsyncStorage,
Supabase (fase 2), EAS para compilar y publicar.

## 6. Arquitectura

- Hoy (fase 1) la app llama directo a TMDB con `EXPO_PUBLIC_TMDB_TOKEN`. Solo para desarrollo:
  ese token queda dentro de la app compilada.
- Fase 2: la app llama a una Edge Function de Supabase que guarda el token y consulta TMDB.
  Hay que cambiar únicamente `src/lib/tmdb.ts` (la URL base y el encabezado).
- Datos: primero en el dispositivo, luego sincronización con `supabase/schema.sql`.
  Por título gana el cambio más reciente (`updatedAt`); los episodios vistos se suman.

## 7. Licencias

- TMDB es gratis para uso no comercial con atribución. Con anuncios o suscripción hace falta
  licencia comercial (pedirla a ventas de TMDB, el precio no es público).
- Atribución en Perfil > Créditos; "Datos de JustWatch" en "Dónde ver".

## 8. Costos de lanzar

Apple 99 USD al año, Google Play 25 USD una vez. Supabase y EAS tienen plan gratis suficiente
para empezar (Supabase Pro 25 USD al mes, EAS Starter 19 USD al mes cuando haga falta).

## 9. Crecimiento

Importar desde TV Time y Trakt, tarjetas para compartir (tipo Spotify Wrapped), creadores de
contenido en español, social ligero. Definir Butaca Pro antes de crecer.

## 10. Próximos pasos

1. Crear cuenta en TMDB y poner el token en `.env`.
2. `npx expo start` y probar en el celular con Expo Go.
3. Usarla dos semanas y anotar lo que falta.
4. Elegir el nombre definitivo.
5. Crear el proyecto en Supabase y cargar `supabase/schema.sql`.
