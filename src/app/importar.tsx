/**
 * Importar historial desde otras apps. Por ahora: WeTrakr (archivos CSV que exporta la app).
 * Trakt, TV Time, Letterboxd e IMDb llegan después.
 */

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { card } from '@/components/glass';
import { Button, ProgressBar, Screen, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { planFromWetrakr, type ImportPlan } from '@/lib/import-wetrakr';
import { runImport, type ImportProgress } from '@/lib/importer';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

type Phase = 'pick' | 'review' | 'running' | 'done';

const n = (x: number) => x.toLocaleString('es-CO');

/** Abre el selector de archivos del navegador y devuelve el texto de cada CSV. */
function pickCsvFiles(): Promise<{ name: string; text: string }[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))));
    };
    input.click();
  });
}

export default function ImportScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const library = useLibrary();
  const [phase, setPhase] = useState<Phase>('pick');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const cancelled = useRef(false);

  async function choose() {
    setError(null);
    const files = await pickCsvFiles();
    if (!files.length) return;
    try {
      const p = planFromWetrakr(files);
      setPlan(p);
      setPhase('review');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function start() {
    if (!plan) return;
    cancelled.current = false;
    setPhase('running');
    setProgress({ done: 0, total: plan.movies.length + plan.shows.length, skipped: [] });
    const result = await runImport(plan, {
      existing: library.raw.items,
      onBatch: library.mergeImported,
      onLists: library.importLists,
      onProgress: setProgress,
      isCancelled: () => cancelled.current,
    });
    setProgress(result);
    setPhase('done');
  }

  const watchedMovies = plan?.movies.filter((m) => m.status === 'completed').length ?? 0;

  return (
    <Screen>
      <View style={{ paddingTop: Space.sm, gap: Space.xs }}>
        <T variant="title">Importar historial</T>
        <T muted>Trae lo que ya tienes en WeTrakr: series, episodios vistos, películas, calificaciones, listas y favoritos.</T>
      </View>

      {Platform.OS !== 'web' ? (
        <View style={styles.card}>
          <T>Por ahora la importación se hace desde la versión web de Sollar, en el computador.</T>
        </View>
      ) : null}

      {phase === 'pick' && Platform.OS === 'web' ? (
        <View style={styles.card}>
          <Step n={1} text="En WeTrakr, exporta tus datos. Te descarga varios archivos CSV." />
          <Step n={2} text="Toca el botón y selecciona todos los CSV a la vez (el importante es tracklog.csv)." />
          <Step n={3} text="Revisa el resumen y confirma. Sollar completa carátulas y temporadas desde TMDB." />
          <Button label="Elegir archivos CSV" onPress={choose} />
          {error ? <T variant="small" style={{ color: C.danger }}>{error}</T> : null}
        </View>
      ) : null}

      {phase === 'review' && plan ? (
        <View style={styles.card}>
          <T variant="heading">Esto es lo que encontré</T>
          <View style={styles.stats}>
            <Stat value={n(plan.shows.length)} label="series" />
            <Stat value={n(plan.episodes)} label="episodios vistos" />
            <Stat value={n(watchedMovies)} label="películas vistas" />
            <Stat value={n(plan.movies.length - watchedMovies)} label="películas por ver" />
            <Stat value={n(plan.ratings)} label="calificaciones" />
            <Stat value={n(plan.lists.length)} label={plan.lists.length === 1 ? 'lista' : 'listas'} />
            <Stat value={n(plan.favorites.length)} label="favoritos" />
          </View>
          <T variant="small" muted>
            Lo que ya tengas en Sollar no se pierde: se suman los episodios vistos y se respetan tus
            calificaciones y estados. Con tantos títulos puede tardar unos minutos; deja esta pantalla abierta.
          </T>
          <Button label={`Importar ${n(plan.shows.length + plan.movies.length)} títulos`} onPress={start} />
          <Button label="Elegir otros archivos" kind="secondary" onPress={() => setPhase('pick')} />
        </View>
      ) : null}

      {(phase === 'running' || phase === 'done') && progress ? (
        <View style={styles.card}>
          <T variant="heading">
            {phase === 'running' ? 'Importando…' : progress.error ? 'Se detuvo la importación' : '¡Listo!'}
          </T>
          {progress.error ? (
            <T variant="small" style={{ color: C.danger }}>
              No pude conectar con TMDB ({progress.error}). Revisa que la función tmdb y el secreto
              TMDB_TOKEN estén en Supabase, y vuelve a importar: lo que ya entró no se repite.
            </T>
          ) : null}
          <ProgressBar value={progress.total ? progress.done / progress.total : 1} />
          <T variant="small" muted>
            {n(progress.done)} de {n(progress.total)} títulos
            {progress.skipped.length ? ` · ${n(progress.skipped.length)} no se encontraron en TMDB` : ''}
          </T>
          {phase === 'running' ? (
            <>
              <T variant="small" muted>
                Mantén esta pantalla abierta. Lo importado se va guardando y sincronizando: si se corta,
                vuelve a importar los mismos archivos y seguirá rápido desde donde iba.
              </T>
              <Button label="Detener" kind="secondary" onPress={() => (cancelled.current = true)} />
            </>
          ) : (
            <>
              {progress.skipped.length ? (
                <T variant="caption" muted numberOfLines={4}>
                  Sin datos en TMDB: {progress.skipped.slice(0, 20).join(', ')}
                  {progress.skipped.length > 20 ? '…' : ''}
                </T>
              ) : null}
              <Button label="Ver lo que sigo" onPress={() => router.replace('/')} />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Step({ n: num, text }: { n: number; text: string }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' }}>
      <View style={styles.stepNum}>
        <T variant="label" style={{ color: C.accentInk }}>
          {num}
        </T>
      </View>
      <T style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <T variant="heading" style={{ color: C.accentInk }}>
        {value}
      </T>
      <T variant="caption" muted>
        {label}
      </T>
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    card: { ...card(C), borderRadius: Radius.lg, padding: Space.xl, gap: Space.lg },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
    stat: { flexGrow: 1, flexBasis: 120, backgroundColor: C.fill, borderRadius: Radius.md, padding: Space.md, gap: 2 },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: C.accentLine,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
