import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Button } from './button'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: LucideIcon
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

// AGENT_UX: Empty states now have a prominent primary CTA (with icon) plus
// optional secondary action. Body text reads higher contrast for 60-year-old user.
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryActionLabel,
  onSecondaryAction
}: EmptyStateProps): React.JSX.Element {
  const CtaIcon = ActionIcon ?? Plus
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-surface-muted/70 animate-fade-in-up">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-surface shadow-1">
        <Icon size={40} className="text-accent-strong" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted max-w-[min(28rem,90%)] mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
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
