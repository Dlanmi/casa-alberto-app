import { cn } from '@renderer/lib/cn'
import { iniciales } from '@renderer/lib/format'

// AGENT_UX: Shared avatar with deterministic color per id/name.
// Used in cliente cards, kanban cards, detail panels so the same person
// always gets the same color for instant visual recognition.

const AVATAR_COLORS = [
  'bg-accent/10 text-accent-strong',
  'bg-success-bg text-success-strong',
  'bg-warning-bg text-warning-strong',
  'bg-info-bg text-info-strong',
  'bg-error-bg text-error-strong'
] as const

function pickColor(seed: number): string {
  return AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length]
}

type InitialsAvatarProps = {
  nombre: string
  id?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASS: Record<NonNullable<InitialsAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-14 w-14 text-base'
}

export function InitialsAvatar({
  nombre,
  id,
  size = 'md',
  className
}: InitialsAvatarProps): React.JSX.Element {
  const seed = id ?? nombre.length
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        SIZE_CLASS[size],
        pickColor(seed),
        className
      )}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </div>
  )
}
