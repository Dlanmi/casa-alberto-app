import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

// AGENT_UX: Connected dots step indicator for wizards.
// Replaces pill rows with a visually clearer "you are here" UI:
// - completed steps = filled accent circle with check
// - current step   = filled accent ring + number (animated)
// - pending steps  = outline circle with number
// Lines between dots turn accent-colored when traversed.
type StepDotsProps = {
  steps: { key: string; label: string }[]
  current: number
  onJump?: (index: number) => void
  className?: string
}

export function StepDots({ steps, current, onJump, className }: StepDotsProps): React.JSX.Element {
  return (
    <ol className={cn('flex w-full items-center', className)} aria-label="Progreso del asistente">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const clickable = onJump && (done || active)
        const Dot = (
          <button
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onJump?.(index)}
            aria-current={active ? 'step' : undefined}
            aria-label={`Paso ${index + 1}: ${step.label}${done ? ' (completado)' : active ? ' (actual)' : ''}`}
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
              done && 'border-accent bg-accent text-white shadow-1',
              active &&
                'border-accent bg-surface text-accent-strong ring-4 ring-accent/20 scale-110',
              !done && !active && 'border-border-strong bg-surface text-text-soft',
              clickable && 'cursor-pointer hover:scale-105',
              !clickable && 'cursor-default'
            )}
          >
            {done ? <Check size={18} strokeWidth={3} /> : <span>{index + 1}</span>}
          </button>
        )

        return (
          <li
            key={step.key}
            className={cn('flex flex-1 items-center', index === steps.length - 1 && 'flex-none')}
          >
            <div className="flex flex-col items-center gap-2">
              {Dot}
              <span
                className={cn(
                  'text-center text-[11px] font-medium uppercase tracking-wider max-w-[90px]',
                  active ? 'text-accent-strong' : done ? 'text-text' : 'text-text-soft'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={cn(
                  'mx-2 mb-6 h-0.5 flex-1 rounded-full transition-colors duration-300',
                  done ? 'bg-accent' : 'bg-border'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
