/**
 * La letra de Sollar: Roboto, la misma de Trakt. Limpia, legible y no muy gruesa.
 * Cada grosor es un archivo distinto; fontFamilyFor elige el que corresponde al fontWeight.
 * Los grosores pedidos se aligeran un paso (800 se ve como 700, 700 como 600), para que nada
 * se vea pesado.
 */

import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
} from '@expo-google-fonts/roboto';

export const FONT_FILES = {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
};

export function fontFamilyFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  if (w >= 700) return 'Roboto_600SemiBold';
  if (w >= 600) return 'Roboto_500Medium';
  if (w >= 500) return 'Roboto_500Medium';
  return 'Roboto_400Regular';
}
