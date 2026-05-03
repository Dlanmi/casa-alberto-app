import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Button } from './button'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  illustration?: React.ReactNode
  actionLabel?: string
  actionIcon?: LucideIcon
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

// Stagger: el icono lidera (hero), el resto cascadea con un total <500ms.
const STAGGER_MS = {
  icon: 0,
  title: 100,
  description: 180,
  actions: 280
} as const

// AGENT_UX: Empty states now have a prominent primary CTA (with icon) plus
// optional secondary action. Body text reads higher contrast for 60-year-old user.
export function EmptyState({
  icon: Icon,
  title,
  description,
  illustration,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryActionLabel,
  onSecondaryAction
}: EmptyStateProps): React.JSX.Element {
  const CtaIcon = ActionIcon ?? Plus
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-surface-muted/70">
      {illustration ? (
        <div className="mb-5 animate-scale-pop" style={{ animationDelay: `${STAGGER_MS.icon}ms` }}>
          {illustration}
        </div>
      ) : (
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-surface shadow-1 animate-scale-pop"
          style={{ animationDelay: `${STAGGER_MS.icon}ms` }}
        >
          <Icon size={40} className="text-accent-strong" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <h3
        className="text-lg font-semibold text-text mb-2 animate-fade-in-up"
        style={{ animationDelay: `${STAGGER_MS.title}ms` }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm text-text-muted max-w-[min(28rem,90%)] mb-6 leading-relaxed animate-fade-in-up"
          style={{ animationDelay: `${STAGGER_MS.description}ms` }}
        >
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div
          className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up"
          style={{ animationDelay: `${STAGGER_MS.actions}ms` }}
        >
          {actionLabel && onAction && (
            <Button size="lg" onClick={onAction}>
              <CtaIcon size={18} />
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button size="lg" variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
