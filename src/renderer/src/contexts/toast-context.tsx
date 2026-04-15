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

      setToasts((prev) => [...prev, toast])

      if (!toast.persistent) {
        const timer = setTimeout(() => removeToast(id), toast.durationMs ?? DEFAULT_DURATION)
        timersRef.current.set(id, timer)
      }
    },
    [removeToast]
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
                    className="mt-2 text-sm font-medium text-accent-strong hover:text-accent cursor-pointer"
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-text-soft hover:text-text-muted cursor-pointer"
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
