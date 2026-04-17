import { cn } from '@renderer/lib/cn'
import { iniciales } from '@renderer/lib/format'
import { useEmojis } from '@renderer/contexts/emojis-context'

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

const AVATAR_EMOJIS = ['👨', '👩', '🧑', '👴', '👵', '🧔', '👱'] as const

function pickColor(seed: number): string {
  return AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length]
}

function pickEmoji(seed: number): string {
  return AVATAR_EMOJIS[Math.abs(seed) % AVATAR_EMOJIS.length]
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

const EMOJI_BADGE_CLASS: Record<NonNullable<InitialsAvatarProps['size']>, string> = {
  sm: 'h-4 w-4 text-[9px] -bottom-0.5 -right-0.5',
  md: 'h-5 w-5 text-[11px] -bottom-0.5 -right-0.5',
  lg: 'h-6 w-6 text-[13px] -bottom-1 -right-1'
}

export function InitialsAvatar({
  nombre,
  id,
  size = 'md',
  className
}: InitialsAvatarProps): React.JSX.Element {
  const { enabled: emojisEnabled } = useEmojis()
  const seed = id ?? nombre.length
  return (
    <div className={cn('relative shrink-0', className)} aria-hidden="true">
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-semibold select-none',
          SIZE_CLASS[size],
          pickColor(seed)
        )}
      >
        {iniciales(nombre)}
      </div>
      {emojisEnabled && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-surface leading-none shadow-1 ring-1 ring-border',
            EMOJI_BADGE_CLASS[size]
          )}
        >
          {pickEmoji(seed)}
        </span>
      )}
    </div>
  )
}
