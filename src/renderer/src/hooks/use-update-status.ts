import { useCallback, useEffect, useState } from 'react'
import type { IpcResult, UpdateStatus } from '@shared/types'

const INITIAL_STATUS: UpdateStatus = { state: 'idle' }

// Hook único y reusable para observar el auto-updater desde cualquier componente.
// Centraliza el boilerplate de suscripción y acciones para que sidebar, banner
// flotante y futuros consumidores (ej. botón "buscar actualizaciones" en
// configuración) compartan el mismo source of truth.
//
// - status: estado reactivo, inicializado con getStatus() por si una update
//   terminó de bajar mientras el renderer arrancaba (evita el flash "idle→downloaded").
// - quitAndInstall: cierra la app e instala. Solo hay efecto si state === 'downloaded'.
// - checkNow: fuerza un re-check (noop en dev).
export function useUpdateStatus(): {
  status: UpdateStatus
  quitAndInstall: () => Promise<void>
  checkNow: () => Promise<void>
} {
  const [status, setStatus] = useState<UpdateStatus>(INITIAL_STATUS)

  useEffect(() => {
    let cancelled = false

    // Hidrata el estado inicial — cubre el caso en que el main ya descargó
    // una update antes de que el renderer se suscribiera.
    void (async () => {
      try {
        const result = (await window.api.updater.getStatus()) as IpcResult<UpdateStatus>
        if (!cancelled && result.ok) setStatus(result.data)
      } catch {
        // Silencioso — el listener abajo cubrirá los cambios futuros.
      }
    })()

    const unsubscribe = window.api.updater.onStatusChange((next) => {
      if (!cancelled) setStatus(next as UpdateStatus)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const quitAndInstall = useCallback(async () => {
    await window.api.updater.quitAndInstall()
  }, [])

  const checkNow = useCallback(async () => {
    await window.api.updater.checkNow()
  }, [])

  return { status, quitAndInstall, checkNow }
}
