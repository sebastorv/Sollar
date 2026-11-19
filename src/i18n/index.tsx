/**
 * Idioma de la app. Por defecto, inglés; se cambia en Ajustes.
 *
 * La interfaz está escrita en español. Cada texto que se muestra pasa por tr(): si el idioma no
 * es español, se busca la traducción exacta; si el texto lleva números o nombres, se traducen
 * sus partes con reglas (por ejemplo "12 episodios" → "12 episodes", "T1 · E3" → "S1 · E3").
 * Los datos de las series (sinopsis, títulos, géneros) los entrega TMDB en el idioma elegido.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fragment, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setTmdbLanguage } from '@/lib/tmdb';

import { EN } from './en';

export type Lang = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it';

export const LANGUAGES: { id: Lang; label: string; tmdb: string; note?: string }[] = [
  { id: 'en', label: 'English', tmdb: 'en-US' },
  { id: 'es', label: 'Español', tmdb: 'es-MX' },
  { id: 'pt', label: 'Português', tmdb: 'pt-BR', note: 'Content in Portuguese, interface in English' },
  { id: 'fr', label: 'Français', tmdb: 'fr-FR', note: 'Content in French, interface in English' },
  { id: 'de', label: 'Deutsch', tmdb: 'de-DE', note: 'Content in German, interface in English' },
  { id: 'it', label: 'Italiano', tmdb: 'it-IT', note: 'Content in Italian, interface in English' },
];

const KEY = 'sollar.lang.v1';
let current: Lang = 'en';
setTmdbLanguage('en-US');

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DY_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Reglas para textos con números, fechas y nombres. Se aplican en orden. */
const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  [/\bT(\d+) · E(\d+)/g, 'S$1 · E$2'],
  [/\bT(\d+)(?= ·|$|\)|\/)/g, 'S$1'],
  [/\bTemporada (\d+)/g, 'Season $1'],
  [/\bTEMPORADA (\d+)/g, 'SEASON $1'],
  [/\bEPISODIO (\d+) DE (\d+)/g, 'EPISODE $1 OF $2'],
  [/\b(\d[\d.,]*) registros? · /g, (_, n) => `${n} ${n === '1' ? 'entry' : 'entries'} · `],
  [/ frente a la pantalla/g, ' of screen time'],
  [/\bEpisodio (\d+) de (\d+)/g, 'Episode $1 of $2'],
  [/\bEpisodio (\d+)/g, 'Episode $1'],
  [/\b(\d[\d.,]*) episodios? vistos/g, '$1 episodes watched'],
  [/\b(\d[\d.,]*) episodios\b/g, '$1 episodes'],
  [/\b1 episodio\b/g, '1 episode'],
  [/\b(\d[\d.,]*) temporadas\b/g, '$1 seasons'],
  [/\b1 temporada\b/g, '1 season'],
  [/\b(\d[\d.,]*) películas\b/g, '$1 movies'],
  [/\b(\d[\d.,]*) títulos\b/g, '$1 titles'],
  [/\b(\d[\d.,]*) vistos\b/g, '$1 watched'],
  [/\b(\d[\d.,]*) ep\./g, '$1 eps'],
  [/(\d+) de (\d+) vistos/g, '$1 of $2 watched'],
  [/(\d[\d.,]*) de (\d[\d.,]*)/g, '$1 of $2'],
  [/\b(\d+) faltan\b/g, '$1 left'],
  [/\b1 falta\b/g, '1 left'],
  [/\bfaltan (\d+) episodios/g, '$1 episodes left'],
  [/\bfalta 1 episodio/g, '1 episode left'],
  [/Te faltan (.+?) para terminarla \((\d+) episodios?\)/g, (_, t, n) => `${t} left to finish it (${n} episode${n === '1' ? '' : 's'})`],
  [/, y (\d+) por estrenarse/g, ', plus $1 upcoming'],
  [/¡Estás al día!/g, "You're all caught up!"],
  [/Faltan (\d+) episodios por estrenarse\./g, '$1 episodes still to air.'],
  [/\bRacha de (\d+) días?/g, (_, n) => `${n}-day streak`],
  [/\bSigue con\b/g, 'Continue with'],
  [/\bSigue\b/g, 'Next'],
  [/\bSale el\b/g, 'Airs'],
  [/\bSale\b/g, 'Airs'],
  [/\bSe estrena el\b/g, 'Premieres'],
  [/\bhace (\d+) min\b/g, '$1 min ago'],
  [/\bhace (\d+) h\b/g, '$1 h ago'],
  [/\bhace (\d+) d\b/g, '$1 d ago'],
  [/(\d+) sem\b/g, '$1 wk'],
  [/\b(\d+) a\b/g, '$1 y'],
  [/(\d+) m\b(?! ?in)/g, '$1 mo'],
  [/\bmil\b/g, 'k'],
  [/\bvotos\b/g, 'votes'],
  [/Viendo desde (\S+) de (\d{4})/g, (_, m, y) => `Watching since ${MONTHS_EN[MONTHS_ES.indexOf(m.toLowerCase())] ?? m} ${y}`],
  [/^Marcar el primer episodio de (.+)$/g, 'Mark the first episode of $1'],
  [/^Marcar (.+?) como vist[oa]$/g, 'Mark $1 as watched'],
  [/^Todo · (\d)/g, 'All · $1'],
  [/^Listas · (\d)/g, 'Lists · $1'],
  [/Porque te gustó /g, 'Because you liked '],
  [/Le pusiste (\d+)\/10/g, 'You gave it $1/10'],
  [/vio y le puso/g, 'watched and rated'],
  [/le puso/g, 'rated'],
  [/\bvio\b/g, 'watched'],
  [/Mostrar más \((.+?) restantes\)/g, 'Show more ($1 left)'],
  [/Mostrar más/g, 'Show more'],
  [/Ver todas las opciones/g, 'See all options'],
  [/Ver las (\d+) plataformas/g, 'See all $1 services'],
  [/Fondos de pantalla/g, 'Wallpapers'],
  [/Carátulas/g, 'Posters'],
  [/Importar (.+?) títulos/g, 'Import $1 titles'],
  [/Se importaron (\d+) títulos\./g, 'Imported $1 titles.'],
  [/Sincronizado a las/g, 'Synced at'],
  [/Disponibilidad revisada hace (\d+) días?\./g, 'Availability checked $1 days ago.'],
  [/Revisando dónde ver…/g, 'Checking where to watch…'],
  [/No encontramos nada para/g, 'Nothing found for'],
  [/El día del estreno/g, 'Release day'],
  [/La has visto (\d+) veces:/g, "You've watched it $1 times:"],
  [/series con episodio nuevo/g, 'shows with a new episode'],
  [/Episodios ≤/g, 'Episodes ≤'],
  [/Hasta (\d+) min/g, 'Up to $1 min'],
  [/\bEn (.+?) y (\d+) más/g, 'On $1 and $2 more'],
  [/\bEn tu lista\b/g, 'In your list'],
  [/\bcon episodios\b/g, 'with episodes'],
  [/Creada por /g, 'Created by '],
  [/Dirigida por /g, 'Directed by '],
  [/ en total/g, ' in total'],
  [/ restantes/g, ' left'],
  [/ · otra vez/g, ' · again'],
  [/Viendo desde/g, 'Watching since'],
  [/ días\b/g, ' days'],
  [/ día\b/g, ' day'],
  [/\bHoy\b/g, 'Today'],
  [/\bhoy\b/g, 'today'],
  [/\bmañana\b/g, 'tomorrow'],
  [/\ben (\d+) (?:días|days)\b/g, 'in $1 days'],
  [/\ben (\d+) semanas\b/g, 'in $1 weeks'],
  [/\ben (\d+) meses\b/g, 'in $1 months'],
  [/\bMañana\b/g, 'Tomorrow'],
  [/\bAyer\b/g, 'Yesterday'],
  [new RegExp(`\\b(${MONTHS_ES.join('|')})\\b`, 'gi'), (m) => MONTHS_EN[MONTHS_ES.indexOf(m.toLowerCase())]],
  [new RegExp(`\\b(${DAYS_ES.join('|')})\\b`, 'gi'), (m) => DAYS_EN[DAYS_ES.indexOf(m.toLowerCase())]],
  // Meses y días abreviados solo junto a una fecha ("12 ago 2024", "lun, 12"), para no tocar
  // palabras en inglés como "ago" en las sinopsis.
  [new RegExp(`(?<=\\d )(${MON_ES.join('|')})(?![\\wáéíóú])`, 'gi'), (m) => MON_EN[MON_ES.indexOf(m.toLowerCase())]],
  [new RegExp(`(?<![\\wáéíóú])(${DY_ES.join('|')})(?=,? \\d)`, 'gi'), (m) => DY_EN[DY_ES.indexOf(m.toLowerCase())]],
  [/([A-Z][a-z]+day) (\d{1,2}) de ([A-Z][a-z]+)/g, '$1, $3 $2'],
  [/(\d{1,2}) de ([A-Z][a-z]+)/g, '$2 $1'],
  [/ de (\d{4})/g, ' $1'],
  [/\bSerie\b/g, 'Show'],
  [/\bPelícula\b/g, 'Movie'],
  [/\bPelículas\b/g, 'Movies'],
];

/** Traduce un texto de la interfaz al idioma elegido. */
export function tr(text: string): string {
  if (current === 'es' || !text) return text;
  const core = text.trim();
  if (!core) return text;
  const exact = EN[core];
  const lead = text.slice(0, text.indexOf(core));
  const tail = text.slice(text.indexOf(core) + core.length);
  if (exact) return lead + exact + tail;
  // Mayúsculas completas (rótulos): se busca la versión normal.
  const upper = core === core.toUpperCase() && EN[cap(core.toLowerCase())];
  if (upper) return lead + upper.toUpperCase() + tail;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to as never);
  return out;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>('en');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v && LANGUAGES.some((l) => l.id === v)) apply(v as Lang);
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function apply(l: Lang) {
    current = l;
    setTmdbLanguage(LANGUAGES.find((x) => x.id === l)!.tmdb);
    setLangRaw(l);
  }
  const value = useMemo(
    () => ({
      lang,
      setLang: (l: Lang) => {
        apply(l);
        AsyncStorage.setItem(KEY, l).catch(() => {});
      },
    }),
    [lang],
  );
  if (!ready) return null;
  // Al cambiar de idioma se vuelve a montar todo, para pedir los datos en el idioma nuevo.
  return (
    <LangCtx value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LangCtx>
  );
}

export function useLang() {
  return useContext(LangCtx);
}

/** Texto en el idioma actual, para frases armadas con datos: L('Faltan 3', '3 left'). */
export function useL() {
  const { lang } = useLang();
  return (es: string, en: string) => (lang === 'es' ? es : en);
}
