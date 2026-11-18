/**
 * Iconos de Sollar: trazo redondeado de 1.8 sobre una cuadrícula de 24, sin puntas.
 * En la pestaña activa se rellenan con un tinte del mismo color.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useColors } from '@/store/theme';

export type IconName =
  | 'play'
  | 'calendar'
  | 'heart'
  | 'chevronRight'
  | 'flame'
  | 'share'
  | 'trash'
  | 'arrowUp'
  | 'arrowDown'
  | 'edit'
  | 'film'
  | 'search'
  | 'ticket'
  | 'person'
  | 'check'
  | 'filter'
  | 'back'
  | 'plus'
  | 'screen'
  | 'clock'
  | 'chevronDown'
  | 'chevronUp'
  | 'sparkle'
  | 'more';

export function Icon({
  name,
  size = 22,
  color,
  filled = false,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Versión rellena, para la pestaña activa. */
  filled?: boolean;
  strokeWidth?: number;
}) {
  const C = useColors();
  color = color ?? C.text;
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fill = filled ? color : 'none';
  const fillOpacity = filled ? 0.22 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'play' ? (
        <>
          {/* Pantalla con el botón de reproducir: lo que estás siguiendo */}
          <Rect x="3" y="4.5" width="18" height="13" rx="3.5" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M10.3 8.6v4.8a.6.6 0 0 0 .9.5l3.8-2.4a.6.6 0 0 0 0-1l-3.8-2.4a.6.6 0 0 0-.9.5Z" {...s} fill={color} strokeWidth={1.2} />
          <Path d="M9 20.5h6" {...s} />
        </>
      ) : null}

      {name === 'calendar' ? (
        <>
          {/* Hoja de calendario con dos argollas y un día marcado */}
          <Rect x="3.5" y="5" width="17" height="15.5" rx="3.5" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...s} />
          <Circle cx="15.5" cy="15" r="1.7" fill={color} stroke="none" />
        </>
      ) : null}

      {name === 'chevronRight' ? <Path d="M9 5l7 7-7 7" {...s} /> : null}
      {name === 'flame' ? (
        <Path
          d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-7.8.4 1.8 1.4 2.9 2.4 3.4C11.3 7.4 12.6 5 15 3c-.3 2.7.9 4.6 2.1 6.3 1 1.5 1.4 3 1.4 4.7C18.5 18.1 15.9 21 12 21Z"
          {...s}
          fill={filled ? color : 'none'}
        />
      ) : null}
      {name === 'heart' ? (
        <Path
          d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.2-7.5 10.2Z"
          {...s}
          fill={filled ? color : 'none'}
        />
      ) : null}

      {name === 'share' ? (
        <>
          <Path d="M12 3.5v11M8 7.5l4-4 4 4" {...s} />
          <Path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" {...s} />
        </>
      ) : null}

      {name === 'trash' ? (
        <>
          <Path d="M4.5 7h15M10 4h4M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" {...s} />
        </>
      ) : null}

      {name === 'arrowUp' ? <Path d="M12 19V5M6 11l6-6 6 6" {...s} /> : null}
      {name === 'arrowDown' ? <Path d="M12 5v14M6 13l6 6 6-6" {...s} /> : null}
      {name === 'edit' ? <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" {...s} /> : null}

      {name === 'film' ? (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="3" {...s} />
          <Path d="M10 9.2v5.6a.5.5 0 0 0 .8.4l4.2-2.8a.5.5 0 0 0 0-.8l-4.2-2.8a.5.5 0 0 0-.8.4Z" {...s} fill={color} strokeWidth={1} />
        </>
      ) : null}

      {name === 'search' ? (
        <>
          <Circle cx="10.5" cy="10.5" r="6" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M15 15l5 5" {...s} />
          {/* Destello del lente */}
          <Path d="M8 8.2a3 3 0 0 1 2.4-1.2" {...s} strokeWidth={strokeWidth * 0.8} />
        </>
      ) : null}

      {name === 'ticket' ? (
        <>
          {/* Boleta con muescas laterales y línea de corte */}
          <Path
            d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"
            {...s}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Path d="M14.5 6.5v1.5M14.5 11v2M14.5 16v1.5" {...s} />
        </>
      ) : null}

      {name === 'person' ? (
        <>
          <Circle cx="12" cy="8.5" r="3.5" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" {...s} />
        </>
      ) : null}

      {name === 'check' ? <Path d="M5 12.5l4.2 4.2L19 7" {...s} /> : null}

      {name === 'filter' ? (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...s} />
          <Circle cx="15" cy="7" r="2" {...s} />
          <Circle cx="9" cy="17" r="2" {...s} />
        </>
      ) : null}

      {name === 'back' ? <Path d="M14.5 5.5L8 12l6.5 6.5" {...s} /> : null}
      {name === 'chevronDown' ? <Path d="M6.5 9.5L12 15l5.5-5.5" {...s} /> : null}
      {name === 'chevronUp' ? <Path d="M6.5 14.5L12 9l5.5 5.5" {...s} /> : null}
      {name === 'plus' ? <Path d="M12 5v14M5 12h14" {...s} /> : null}

      {name === 'screen' ? (
        <>
          {/* Pantalla de cine con el haz del proyector */}
          <Rect x="3.5" y="5" width="17" height="11" rx="2" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M9 20h6M12 16v4" {...s} />
        </>
      ) : null}

      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="8" {...s} />
          <Path d="M12 7.5V12l3 2" {...s} />
        </>
      ) : null}

      {name === 'sparkle' ? (
        <Path
          d="M12 4c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z"
          {...s}
          fill={fill}
          fillOpacity={fillOpacity}
        />
      ) : null}
      {name === 'more' ? <Path d="M5.5 12h.01M12 12h.01M18.5 12h.01" {...s} strokeWidth={3.2} /> : null}
    </Svg>
  );
}
