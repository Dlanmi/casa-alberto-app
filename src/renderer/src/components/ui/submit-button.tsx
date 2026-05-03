import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { buttonVariants } from './button-variants'

/** Duración recomendada para mantener visible el estado de éxito antes
 *  de cerrar el modal o resetear el formulario. Centralizada para que
 *  todos los formularios den el mismo tiempo de lectura al checkmark. */
export const SUBMIT_SUCCESS_VISIBLE_MS = 1200

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Cuando true, renderiza spinner + loadingLabel y bloquea clicks. */
    loading?: boolean
    /** Cuando true, renderiza checkmark + successLabel con un pulse breve. */
    success?: boolean
    /** Texto durante loading. */
    loadingLabel?: ReactNode
    /** Texto durante success. */
    successLabel?: ReactNode
  }

/**
 * SubmitButton — extiende Button con tres estados visuales coordinados por
 * el padre: idle (children) → loading (spinner) → success (checkmark + pulse).
 *
 * El padre decide cuándo entrar a cada estado. Patrón típico:
 *   const [success, setSuccess] = useState(false)
 *   async function onSubmit() {
 *     await save()
 *     setSuccess(true)
 *     setTimeout(() => { setSuccess(false); onCreated() }, 1500)
 *   }
 */
export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      success = false,
      loadingLabel = 'Guardando…',
      successLabel = '¡Listo!',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // success tiene prioridad sobre loading (caso edge: success=true cuando
    // el padre olvida limpiar loading). Evita ver "Guardando…" sobre el ✓.
    const showSuccess = success
    const showLoading = loading && !showSuccess

    return (
      <button
        ref={ref}
        type={props.type ?? 'submit'}
        disabled={disabled || showLoading || showSuccess}
        className={cn(
          buttonVariants({ variant, size }),
          showSuccess && 'animate-submit-success',
          className
        )}
        aria-busy={showLoading || undefined}
        {...props}
      >
        {showLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {loadingLabel}
          </>
        ) : showSuccess ? (
          <>
            <Check size={16} aria-hidden="true" />
            {successLabel}
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)
SubmitButton.displayName = 'SubmitButton'
