import { useNavigate } from 'react-router-dom'

/**
 * AppTitleBar — barra superior custom que reemplaza la titlebar genérica
 * de Electron. Se integra con el tema warm-neutral del proyecto.
 *
 * Comportamiento por plataforma (configurado en src/main/index.ts):
 *  - macOS: `titleBarStyle: hiddenInset` muestra los semáforos de mac
 *    (rojo/amarillo/verde) a la izquierda con padding natural.
 *  - Windows: `titleBarStyle: hidden` + `titleBarOverlay` dibuja los
 *    botones nativos minimizar/maximizar/cerrar a la derecha.
 *  - Linux: misma barra custom sin botones de sistema (Electron no
 *    soporta overlay en Linux todavía).
 *
 * Layout interno: usamos `justify-center` con padding plataforma-aware
 * para que el contenido quede visualmente centrado en el espacio libre
 * (no en el total), sin chocar con los controles de sistema. En Mac
 * reservamos ~80px a la izquierda para los semáforos; en Windows ~144px
 * a la derecha para los botones minimizar/max/cerrar.
 *
 * Toda la barra es draggable (`-webkit-app-region: drag`) excepto los
 * elementos interactivos (logo clickeable), que son `no-drag`.
 */

// Tailwind v4 no tiene utility nativo para -webkit-app-region; usamos
// style inline y extendemos CSSProperties para el vendor prefix.
type DragCSS = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const dragStyle: DragCSS = { WebkitAppRegion: 'drag' }
const noDragStyle: DragCSS = { WebkitAppRegion: 'no-drag' }

function getPlatform(): 'darwin' | 'win32' | 'linux' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('win')) return 'win32'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

export function AppTitleBar(): React.JSX.Element {
  const navigate = useNavigate()
  const platform = getPlatform()

  // Padding para reservar el espacio de los controles del sistema:
  //  - mac: semáforos ocupan ~78px → pl-24 (96px) los despeja
  //  - win: botones min/max/cerrar ocupan ~140px → pr-40 (160px)
  const leftPaddingClass = platform === 'darwin' ? 'pl-24' : 'pl-4'
  const rightPaddingClass = platform === 'win32' ? 'pr-40' : 'pr-4'

  return (
    <div
      className={`relative flex h-11 shrink-0 items-center justify-center border-b border-border bg-surface ${leftPaddingClass} ${rightPaddingClass}`}
      style={dragStyle}
      role="banner"
      aria-label="Barra de título de Casa Alberto"
    >
      {/* Brand block centrado. Es un botón clickeable (va al dashboard)
          pero marcado como no-drag para que el click funcione. */}
      <button
        type="button"
        onClick={() => navigate('/')}
        style={noDragStyle}
        className="group flex items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-surface-muted cursor-pointer"
        aria-label="Ir al dashboard"
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white shadow-1 transition-transform group-hover:scale-105"
          aria-hidden
        >
          CA
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-text">Casa Alberto</span>
        <span
          aria-hidden
          className="hidden h-4 w-px bg-border sm:inline-block"
        />
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-text-soft sm:inline">
          Marquetería
        </span>
      </button>
    </div>
  )
}
