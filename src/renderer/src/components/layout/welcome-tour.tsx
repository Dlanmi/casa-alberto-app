import { useEffect, useState } from 'react'
import { Joyride, STATUS, type EventData, type Step } from 'react-joyride'

// Fase 4 — Tour de 5 pasos para la primera vez que papá abre la app
// después del onboarding. El flag se guarda en localStorage porque es un
// estado puramente de UI por instalación y no amerita persistir en SQLite.

const STORAGE_KEY = 'ca:welcome-tour-completed:v1'

const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '¡Hola! Bienvenido a Casa Alberto',
    content:
      'Te voy a mostrar en 5 pasos cómo está organizada la app. Puedes saltar el recorrido cuando quieras con el botón "Saltar tour".',
    skipBeacon: true
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    placement: 'right',
    title: 'Tablero del día',
    content:
      'Aquí arranca la jornada: alertas, cobros pendientes, entregas próximas y balance financiero.',
    skipBeacon: true
  },
  {
    target: '[data-tour="sidebar-cotizador"]',
    placement: 'right',
    title: 'Cotizador',
    content:
      'Crea cotizaciones paso a paso. Al confirmar, la app te lleva directo al pedido recién creado.',
    skipBeacon: true
  },
  {
    target: '[data-tour="sidebar-pedidos"]',
    placement: 'right',
    title: 'Pedidos',
    content:
      'Ve todos tus trabajos en tablero o lista. Arrastra las tarjetas entre columnas para avanzar el estado.',
    skipBeacon: true
  },
  {
    target: '[data-tour="help-button"]',
    placement: 'left',
    title: 'Ayuda contextual',
    content:
      'Si quedas con alguna duda, pulsa este botón abajo a la derecha. Te muestro consejos según la pantalla en la que estés.',
    skipBeacon: true
  }
]

// Colores directamente del tema amber/warm para que el tour se sienta
// parte de la app. Evitamos usar CSS vars en inline styles porque Joyride
// genera styles en JS y algunas propiedades no resuelven var() bien.
const ACCENT = '#c38a2e'
const TEXT = '#44403c'
const TEXT_MUTED = '#57534e'
const SURFACE = '#ffffff'

export function WelcomeTour(): React.JSX.Element | null {
  const [run, setRun] = useState(false)

  useEffect(() => {
    // Retraso leve para dejar que el shell termine de montarse y los
    // data-tour estén presentes en el DOM antes de arrancar.
    const completed = localStorage.getItem(STORAGE_KEY) === '1'
    if (completed) return
    const id = window.setTimeout(() => setRun(true), 600)
    return () => window.clearTimeout(id)
  }, [])

  function handleEvent(data: EventData): void {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(STORAGE_KEY, '1')
      setRun(false)
    }
  }

  if (!run) return null

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      options={{
        showProgress: true,
        buttons: ['back', 'skip', 'primary'],
        primaryColor: ACCENT,
        backgroundColor: SURFACE,
        textColor: TEXT,
        arrowColor: SURFACE,
        overlayColor: 'rgba(28, 25, 23, 0.55)',
        spotlightPadding: 8,
        spotlightRadius: 10,
        zIndex: 10000
      }}
      styles={{
        tooltip: {
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(28, 25, 23, 0.25)',
          padding: 0,
          fontFamily: 'inherit',
          width: 380,
          maxWidth: 'calc(100vw - 48px)'
        },
        tooltipContainer: {
          padding: '24px 24px 0 24px',
          textAlign: 'left'
        },
        tooltipTitle: {
          fontSize: 20,
          fontWeight: 700,
          color: TEXT,
          margin: 0,
          lineHeight: 1.3
        },
        tooltipContent: {
          fontSize: 16,
          color: TEXT_MUTED,
          lineHeight: 1.55,
          padding: '12px 0 4px',
          textAlign: 'left'
        },
        tooltipFooter: {
          marginTop: 12,
          padding: '16px 24px',
          borderTop: '1px solid #e7e5e4',
          backgroundColor: '#faf9f7',
          borderRadius: '0 0 14px 14px',
          gap: 8
        },
        tooltipFooterSpacer: {
          flex: 1
        },
        buttonPrimary: {
          backgroundColor: ACCENT,
          color: '#ffffff',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          minHeight: 44,
          transition: 'background-color 0.15s ease'
        },
        buttonBack: {
          color: TEXT_MUTED,
          backgroundColor: 'transparent',
          fontSize: 15,
          fontWeight: 500,
          padding: '10px 16px',
          minHeight: 44,
          cursor: 'pointer'
        },
        buttonSkip: {
          color: TEXT_MUTED,
          backgroundColor: 'transparent',
          fontSize: 14,
          fontWeight: 500,
          padding: '10px 16px',
          minHeight: 44,
          cursor: 'pointer'
        },
        buttonClose: {
          display: 'none'
        },
        overlay: {
          mixBlendMode: 'normal'
        },
        beacon: {
          display: 'none'
        }
      }}
      locale={{
        back: 'Anterior',
        close: 'Cerrar',
        last: 'Terminar',
        next: 'Siguiente',
        skip: 'Saltar tour'
      }}
      onEvent={handleEvent}
    />
  )
}

// Permite reiniciar el tour desde Configuración.
// eslint-disable-next-line react-refresh/only-export-components
export function resetWelcomeTour(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.location.reload()
}
