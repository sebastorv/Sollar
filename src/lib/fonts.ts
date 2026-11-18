/**
 * La letra de Sollar: Plus Jakarta Sans, geométrica y cálida, en todos los textos.
 * Cada grosor es un archivo distinto; fontFamilyFor elige el que corresponde al fontWeight.
 */

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

export const FONT_FILES = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

export function fontFamilyFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  if (w >= 800) return 'PlusJakartaSans_800ExtraBold';
  if (w >= 700) return 'PlusJakartaSans_700Bold';
  if (w >= 600) return 'PlusJakartaSans_600SemiBold';
  if (w >= 500) return 'PlusJakartaSans_500Medium';
  return 'PlusJakartaSans_400Regular';
}
