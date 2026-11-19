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
  | 'more'
  | 'bookmark'
  | 'pause'
  | 'close'
  | 'playSolid'
  | 'gear'
  | 'tv'
  | 'bell'
  | 'globe'
  | 'grid'
  | 'list'
  | 'camera'
  | 'history'
  | 'chart'
  | 'users'
  | 'moreV'
  | 'music'
  | 'checks'
  | 'chevronLeft'
  | 'info';

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
  // Relleno sólido de un solo color: los detalles quedan como huecos, sin líneas por dentro.
  const fillOpacity = filled ? 1 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'play' ? (
        <>
          {/* Pantalla con el botón de reproducir: lo que estás siguiendo */}
          {filled ? (
            <>
              {/* Versión sólida: la pantalla llena con el triángulo calado, sin contornos. */}
              <Path
                fillRule="evenodd"
                d="M6.5 3.8h11A4.2 4.2 0 0 1 21.7 8v6a4.2 4.2 0 0 1-4.2 4.2h-11A4.2 4.2 0 0 1 2.3 14V8a4.2 4.2 0 0 1 4.2-4.2ZM10.4 8.3v5.4c0 .5.5.8.9.5l4.2-2.7a.6.6 0 0 0 0-1L11.3 7.8c-.4-.3-.9 0-.9.5Z"
                fill={color}
              />
              <Rect x="8.5" y="19.6" width="7" height="1.8" rx="0.9" fill={color} />
            </>
          ) : (
            <>
              <Rect x="3" y="4.5" width="18" height="13" rx="3.5" {...s} />
              <Path d="M10.3 8.6v4.8a.6.6 0 0 0 .9.5l3.8-2.4a.6.6 0 0 0 0-1l-3.8-2.4a.6.6 0 0 0-.9.5Z" {...s} fill={color} strokeWidth={1.2} />
            </>
          )}
          <Path d="M9 20.5h6" {...s} />
        </>
      ) : null}

      {name === 'calendar' ? (
        <>
          {/* Hoja de calendario con dos argollas y un día marcado */}
          {filled ? (
            <>
              {/* Sólido: la hoja llena con una franja calada arriba y el día marcado calado. */}
              <Path
                fillRule="evenodd"
                d="M7 4.6h10a3.9 3.9 0 0 1 3.9 3.9v8.6a3.9 3.9 0 0 1-3.9 3.9H7a3.9 3.9 0 0 1-3.9-3.9V8.5A3.9 3.9 0 0 1 7 4.6ZM4.6 9.4h14.8v1.2H4.6ZM15.5 13.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"
                fill={color}
              />
              <Rect x="7.1" y="2.4" width="1.8" height="4.6" rx="0.9" fill={color} />
              <Rect x="15.1" y="2.4" width="1.8" height="4.6" rx="0.9" fill={color} />
            </>
          ) : (
            <>
              <Rect x="3.5" y="5" width="17" height="15.5" rx="3.5" {...s} />
              <Path d="M3.5 10h17" {...s} />
              <Circle cx="15.5" cy="15" r="1.7" fill={color} stroke="none" />
            </>
          )}
          {filled ? null : <Path d="M8 3v4M16 3v4" {...s} />}
        </>
      ) : null}

      {name === 'chevronRight' ? <Path d="M9 5l7 7-7 7" {...s} /> : null}
      {name === 'chevronLeft' ? <Path d="M15 5l-7 7 7 7" {...s} /> : null}
      {name === 'moreV' ? (
        <>
          <Circle cx="12" cy="5.5" r="1.9" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="1.9" fill={color} stroke="none" />
          <Circle cx="12" cy="18.5" r="1.9" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'music' ? (
        <>
          <Path d="M9 17.5V5.8l11-2.3v11.7" {...s} />
          <Circle cx="6.5" cy="17.5" r="2.7" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Circle cx="17.5" cy="15.2" r="2.7" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M9 9.2l11-2.3" {...s} />
        </>
      ) : null}
      {name === 'checks' ? <Path d="M2.5 12.5l4.2 4.2L15 8.3M11.5 15.8l.9.9L21 8.3" {...s} /> : null}
      {name === 'info' ? (
        <>
          <Circle cx="12" cy="12" r="9" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M12 11v5.5" {...s} />
          <Circle cx="12" cy="7.8" r="1.1" fill={color} stroke="none" />
        </>
      ) : null}
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
      {name === 'edit' ? <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" {...s} fill={fill} fillOpacity={fillOpacity} /> : null}

      {name === 'film' ? (
        <>
          {/* Claqueta de cine */}
          <Path d="M3.5 10h17v7.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5Z" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M3.6 9.7 3 7.3a1.5 1.5 0 0 1 1.1-1.8l13.6-3.4a1.5 1.5 0 0 1 1.8 1.1l.6 2.4Z" {...s} fill={fill} fillOpacity={fillOpacity} />
          {filled ? null : <Path d="M7.4 4.6l2.4 3.6M12.3 3.4l2.4 3.6" {...s} />}
        </>
      ) : null}

      {name === 'search' ? (
        <>
          <Circle cx="10.5" cy="10.5" r="6" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M15 15l5 5" {...s} />
          {filled ? null : <Path d="M8 8.2a3 3 0 0 1 2.4-1.2" {...s} strokeWidth={strokeWidth * 0.8} />}
        </>
      ) : null}

      {name === 'ticket' ? (
        <>
          {/* Boleta con muescas laterales y línea de corte */}
          <Path
            d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"
            {...s}
            fill="none"
            strokeOpacity={filled ? 0 : 1}
          />
          {filled ? null : <Path d="M14.5 6.5v1.5M14.5 11v2M14.5 16v1.5" {...s} />}
          {filled ? (
            <Path
              fillRule="evenodd"
              d="M5.5 5.3h13a2.2 2.2 0 0 1 2.2 2.2v1.6a.4.4 0 0 1-.3.4 2.6 2.6 0 0 0 0 5 .4.4 0 0 1 .3.4v1.6a2.2 2.2 0 0 1-2.2 2.2h-13a2.2 2.2 0 0 1-2.2-2.2v-1.6c0-.2.1-.4.3-.4a2.6 2.6 0 0 0 0-5 .4.4 0 0 1-.3-.4V7.5a2.2 2.2 0 0 1 2.2-2.2ZM13.8 7.2h1.4v1.6h-1.4ZM13.8 11.2h1.4v1.6h-1.4ZM13.8 15.2h1.4v1.6h-1.4Z"
              fill={color}
            />
          ) : null}
        </>
      ) : null}

      {name === 'person' ? (
        <>
          {filled ? (
            <>
              <Circle cx="12" cy="8" r="4.2" fill={color} />
              <Path d="M4.3 19.4C5.5 15.9 8.4 14 12 14s6.5 1.9 7.7 5.4a1 1 0 0 1-1 1.3H5.3a1 1 0 0 1-1-1.3Z" fill={color} />
            </>
          ) : (
            <>
              <Circle cx="12" cy="8.5" r="3.5" {...s} />
              <Path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" {...s} />
            </>
          )}
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
      {name === 'bookmark' ? <Path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" {...s} fill={fill} fillOpacity={fillOpacity} /> : null}
      {name === 'pause' ? <Path d="M9 6v12M15 6v12" {...s} strokeWidth={strokeWidth + 0.8} /> : null}
      {name === 'close' ? <Path d="M7 7l10 10M17 7 7 17" {...s} /> : null}
      {name === 'playSolid' ? <Path d="M8.5 5.8v12.4a1 1 0 0 0 1.5.86l10-6.2a1 1 0 0 0 0-1.72l-10-6.2a1 1 0 0 0-1.5.86Z" {...s} fill={color} /> : null}
      {name === 'tv' ? (
        <>
          <Path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h12a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5Z" {...s} />
          <Path d="M8.5 2.8 12 6l3.5-3.2" {...s} />
        </>
      ) : null}
      {name === 'bell' ? (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15Z" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...s} />
        </>
      ) : null}
      {name === 'globe' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...s} />
          <Path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5Z" {...s} />
        </>
      ) : null}
      {name === 'grid' ? <Path d="M4 4h6.5v6.5H4ZM13.5 4H20v6.5h-6.5ZM4 13.5h6.5V20H4ZM13.5 13.5H20V20h-6.5Z" {...s} /> : null}
      {name === 'list' ? <Path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" {...s} strokeWidth={strokeWidth + 0.4} /> : null}
      {name === 'gear' ? (
        <>
          <Path
            d="M10.3 3.6a1.7 1.7 0 0 1 3.4 0l.2.9a1.7 1.7 0 0 0 2.4 1l.8-.4a1.7 1.7 0 0 1 2.4 2.4l-.4.8a1.7 1.7 0 0 0 1 2.4l.9.2a1.7 1.7 0 0 1 0 3.4l-.9.2a1.7 1.7 0 0 0-1 2.4l.4.8a1.7 1.7 0 0 1-2.4 2.4l-.8-.4a1.7 1.7 0 0 0-2.4 1l-.2.9a1.7 1.7 0 0 1-3.4 0l-.2-.9a1.7 1.7 0 0 0-2.4-1l-.8.4a1.7 1.7 0 0 1-2.4-2.4l.4-.8a1.7 1.7 0 0 0-1-2.4l-.9-.2a1.7 1.7 0 0 1 0-3.4l.9-.2a1.7 1.7 0 0 0 1-2.4l-.4-.8a1.7 1.7 0 0 1 2.4-2.4l.8.4a1.7 1.7 0 0 0 2.4-1Z"
            {...s}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Circle cx={12} cy={12} r={3} {...s} />
        </>
      ) : null}
      {name === 'camera' ? (
        <>
          <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" {...s} />
          <Circle cx={12} cy={12.5} r={3.3} {...s} />
        </>
      ) : null}
      {name === 'history' ? <Path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6M12 8v4.4l3 1.8" {...s} /> : null}
      {name === 'chart' ? <Path d="M5 19V11M10 19V5M15 19v-6M20 19V8" {...s} strokeWidth={strokeWidth + 0.6} /> : null}
      {name === 'users' ? (
        <>
          <Circle cx={9} cy={8.5} r={3.3} {...s} />
          <Path d="M3 19c.6-3 3-4.8 6-4.8s5.4 1.8 6 4.8M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6c1.8.6 3 2.1 3.4 4.4" {...s} />
        </>
      ) : null}
      {name === 'more' ? <Path d="M5.5 12h.01M12 12h.01M18.5 12h.01" {...s} strokeWidth={3.2} /> : null}
    </Svg>
  );
}
