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
    title: 'Bienvenido a Casa Alberto',
    content:
      'Te voy a mostrar en 5 pasos cómo está organizada la app. Puedes saltar el recorrido cuando quieras.',
    skipBeacon: true
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    placement: 'right',
    title: 'Tablero del día',
    content:
      'Aquí es donde arrancas la jornada: alertas, cobros pendientes, entregas próximas y balance.',
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
    title: 'Botón de ayuda',
    content:
      'Si te quedas con alguna duda, pulsa este botón abajo a la derecha. Te muestro consejos según la pantalla en la que estés.',
    skipBeacon: true
  }
]

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
        primaryColor: '#c38a2e',
        zIndex: 10000
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
