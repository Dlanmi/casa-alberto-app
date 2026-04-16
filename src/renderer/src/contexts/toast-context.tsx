/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, LoaderCircle } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export type ToastTone = 'success' | 'error' | 'info' | 'warning' | 'progress'

export type ToastOptions = {
  tone: ToastTone
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
  persistent?: boolean
}

type ShowToast = {
  (options: ToastOptions): void
  (tone: ToastTone, message: string, undoAction?: () => void): void
}

type ToastRecord = ToastOptions & {
  id: number
}

type ToastContextValue = {
  showToast: ShowToast
}

const ToastContext = createContext<ToastContextValue | null>(null)
const DEFAULT_DURATION = 10_000
// Máximo de toasts simultáneos visibles. Si llega uno nuevo con la pila llena,
// se descarta el más viejo para mantener la UI legible. El papá de 60 años no
// debe ver una pila de 10 notificaciones solapadas.
const MAX_TOASTS = 3

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

function normalizeToastArgs(
  input: ToastOptions | ToastTone,
  message?: string,
  undoAction?: () => void
): ToastOptions {
  if (typeof input === 'string') {
    return {
      tone: input,
      message: message ?? '',
      actionLabel: undoAction ? 'Deshacer' : undefined,
      onAction: undoAction
    }
  }

  return input
}

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = useCallback((id: number): void => {
    const timer = timersRef.current.get(id)
    if (!timer) return
    clearTimeout(timer)
    timersRef.current.delete(id)
  }, [])

  const removeToast = useCallback(
    (id: number): void => {
      clearTimer(id)
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    },
    [clearTimer]
  )

  const showToast = useCallback<ShowToast>(
    (input: ToastOptions | ToastTone, message?: string, undoAction?: () => void): void => {
      const normalized = normalizeToastArgs(input, message, undoAction)
      const id = ++idRef.current
      const toast: ToastRecord = {
        id,
        durationMs: DEFAULT_DURATION,
        persistent: false,
        ...normalized
      }

      setToasts((prev) => {
        // Dedupe: si ya existe un toast con el mismo tono y mensaje, no agregamos
        // uno nuevo. Esto evita pilas de errores idénticos cuando el usuario
        // hace clics repetidos en un botón que falla.
        const duplicado = prev.find((t) => t.tone === toast.tone && t.message === toast.message)
        if (duplicado) {
          // No agregar el nuevo; dejar que el existente siga su curso.
          return prev
        }

        // Cap: si ya hay MAX_TOASTS, remover el más viejo para hacer espacio.
        let next = prev
        while (next.length >= MAX_TOASTS) {
          const oldest = next[0]
          clearTimer(oldest.id)
          next = next.slice(1)
        }
        return [...next, toast]
      })

      if (!toast.persistent) {
        const timer = setTimeout(() => removeToast(id), toast.durationMs ?? DEFAULT_DURATION)
        timersRef.current.set(id, timer)
      }
    },
    [clearTimer, removeToast]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  function handleAction(toast: ToastRecord): void {
    toast.onAction?.()
    removeToast(toast.id)
  }

  const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
    progress: LoaderCircle
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.tone]
          const role = toast.tone === 'error' || toast.tone === 'warning' ? 'alert' : 'status'

          return (
            <div
              key={toast.id}
              role={role}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-lg shadow-3 min-w-0 w-[min(320px,calc(100vw-3rem))] max-w-120 animate-toast-in border bg-surface',
                toast.tone === 'success' && 'border-success/20',
                toast.tone === 'error' && 'border-error/20',
                toast.tone === 'info' && 'border-info/20',
                toast.tone === 'warning' && 'border-warning/20',
                toast.tone === 'progress' && 'border-border'
              )}
            >
              <Icon
                size={20}
                className={cn(
                  'mt-0.5 shrink-0',
                  toast.tone === 'success' && 'text-success-strong',
                  toast.tone === 'error' && 'text-error-strong',
                  toast.tone === 'info' && 'text-info-strong',
                  toast.tone === 'warning' && 'text-warning-strong',
                  toast.tone === 'progress' && 'text-accent-strong animate-spin'
                )}
              />
              <div className="flex-1 min-w-0">
                {toast.title && <p className="text-sm font-semibold text-text">{toast.title}</p>}
                <p className="text-sm text-text-muted">{toast.message}</p>
                {toast.actionLabel && toast.onAction && (
                  <button
                    onClick={() => handleAction(toast)}
                    className="mt-2 text-sm font-medium text-accent-strong hover:text-accent cursor-pointer min-h-10 px-3 py-1 rounded-md hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent transition-colors inline-flex items-center"
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-text-soft hover:text-text-muted hover:bg-black/5 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
