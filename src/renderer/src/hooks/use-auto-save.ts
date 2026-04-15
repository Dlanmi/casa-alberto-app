import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Estados que el hook expone al componente para que muestre el indicador UI
 * (típicamente un pill en el topbar del wizard).
 */
export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type UseAutoSaveResult = {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  saveNow: () => void
  discard: () => void
}

type UseAutoSaveOptions<T> = {
  /** Clave de almacenamiento local. Debe ser única por formulario/borrador. */
  key: string
  /** Datos que se guardan en cada tick. */
  data: T
  /** Intervalo entre intentos de guardado en milisegundos (default 30s). */
  intervalMs?: number
  /** Retraso mínimo entre el cambio y el guardado (default 1s). */
  debounceMs?: number
  /** Si se pasa, decide si los datos merecen guardarse (ej: hay algún campo). */
  isDirty?: (data: T) => boolean
  /** Función opcional para guardar en el backend además de localStorage. */
  persist?: (data: T) => Promise<void> | void
}

const SAVE_DURATION_MS = 400 // animación de "Guardando..."
const PERSIST_TIMEOUT_MS = 5000 // B-03 — límite para callback `persist` asíncrono

function storageKey(key: string): string {
  return `ca:autosave:${key}`
}

/**
 * B-03 — corre `promise` pero aborta si tarda más de `ms`. Si el timeout
 * dispara, rechaza con un error identificable. Esto evita que `doSave` se
 * cuelgue indefinidamente cuando `persist` (opcional, backend) no responde.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`autosave timeout ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * SPEC-001 — Fase 3 v2 §7.2: auto-guardado cada 30 s con indicador visual.
 *
 * Guarda `data` en localStorage bajo `ca:autosave:<key>` cada `intervalMs`
 * cuando hay cambios pendientes. El componente muestra `status` como píldora
 * ("Guardando...", "Guardado", "Error"). Si el usuario cierra la app o navega,
 * el draft queda recuperable con `loadAutoSaveDraft(key)`.
 *
 * No rompe el flujo actual: ninguna UI obligatoria, sólo un indicador opcional.
 */
export function useAutoSave<T>({
  key,
  data,
  intervalMs = 30000,
  debounceMs = 1000,
  isDirty,
  persist
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [lastSavedSerialized, setLastSavedSerialized] = useState<string>('')
  // B-03 — refs para detener retry storm cuando la misma serialización
  // falla al guardar. Si la data no cambia, no seguimos intentando ni
  // spameando logs; solo reintentamos cuando el usuario edita algo nuevo.
  const failedSerializedRef = useRef<string | null>(null)
  const loggedErrorRef = useRef<boolean>(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Serialización del estado actual — se usa para detectar cambios desde el
  // último guardado sin tocar refs durante el render.
  const currentSerialized = JSON.stringify(data)

  const doSave = useCallback(async (): Promise<void> => {
    if (currentSerialized === lastSavedSerialized) return
    if (isDirty && !isDirty(data)) return
    // B-03 — si la serialización actual ya falló antes, esperamos a que
    // cambie (usuario escribió algo) antes de reintentar. Así no bombardeamos
    // localStorage cuando está llena ni el backend cuando está caído.
    if (currentSerialized === failedSerializedRef.current) return

    setStatus('saving')
    try {
      // setItem es la operación que puede fallar con QuotaExceededError si
      // localStorage está llena. Queda dentro del try global.
      window.localStorage.setItem(
        storageKey(key),
        JSON.stringify({ data, savedAt: new Date().toISOString() })
      )
      if (persist) {
        // B-03 — 5s de timeout para evitar colgar en "saving" eternamente
        // si el backend no responde.
        await withTimeout(Promise.resolve(persist(data)), PERSIST_TIMEOUT_MS)
      }
      // Éxito — limpiar cualquier estado de error previo.
      failedSerializedRef.current = null
      loggedErrorRef.current = false
      setLastSavedSerialized(currentSerialized)
      setLastSavedAt(new Date())
      // Mantener "saving" visible un instante para que el usuario lo perciba.
      setTimeout(() => setStatus('saved'), SAVE_DURATION_MS)
    } catch (err) {
      failedSerializedRef.current = currentSerialized
      if (!loggedErrorRef.current) {
        console.error('[autosave] fallo al guardar (solo se loguea una vez)', err)
        loggedErrorRef.current = true
      }
      setStatus('error')
    }
  }, [currentSerialized, data, isDirty, key, lastSavedSerialized, persist])

  // Programar guardado con debounce cuando los datos cambian.
  useEffect(() => {
    if (currentSerialized === lastSavedSerialized) return
    if (isDirty && !isDirty(data)) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      void doSave()
    }, debounceMs)

    return (): void => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [currentSerialized, data, debounceMs, doSave, isDirty, lastSavedSerialized])

  // Tick periódico — garantiza que, aunque no haya cambios nuevos, el usuario
  // vea que el sistema sigue vivo. Guarda sólo si hay cambios pendientes.
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void doSave()
    }, intervalMs)
    return (): void => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [doSave, intervalMs])

  // Derivamos "dirty" comparando serializaciones — sin setState en efecto.
  const derivedDirty =
    status !== 'saving' &&
    status !== 'error' &&
    currentSerialized !== lastSavedSerialized &&
    (!isDirty || isDirty(data))
  const effectiveStatus: AutoSaveStatus =
    derivedDirty && (status === 'idle' || status === 'saved') ? 'dirty' : status

  const saveNow = useCallback((): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    void doSave()
  }, [doSave])

  const discard = useCallback((): void => {
    window.localStorage.removeItem(storageKey(key))
    setStatus('idle')
    setLastSavedAt(null)
    setLastSavedSerialized('')
  }, [key])

  return { status: effectiveStatus, lastSavedAt, saveNow, discard }
}

/**
 * Carga un draft previamente guardado. Devuelve null si no existe o está corrupto.
 */
export function loadAutoSaveDraft<T>(key: string): { data: T; savedAt: Date } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; savedAt: string }
    return { data: parsed.data, savedAt: new Date(parsed.savedAt) }
  } catch {
    return null
  }
}

/**
 * Borra explícitamente el draft del almacenamiento local.
 */
export function clearAutoSaveDraft(key: string): void {
  window.localStorage.removeItem(storageKey(key))
}
