import type { IllustrationProps } from './types'

export function FrameIllustration({ size = 160, className }: IllustrationProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      className={className}
    >
      {/* Outer frame */}
      <rect
        x="24"
        y="20"
        width="112"
        height="120"
        rx="3"
        stroke="#b45309"
        strokeWidth="6"
        fill="none"
      />

      {/* Inner frame border */}
      <rect
        x="40"
        y="36"
        width="80"
        height="88"
        rx="1"
        stroke="#b45309"
        strokeWidth="1.5"
        fill="#f5f5f4"
      />

      {/* Corner miter lines */}
      <line x1="24" y1="20" x2="40" y2="36" stroke="#b45309" strokeWidth="1.5" />
      <line x1="136" y1="20" x2="120" y2="36" stroke="#b45309" strokeWidth="1.5" />
      <line x1="24" y1="140" x2="40" y2="124" stroke="#b45309" strokeWidth="1.5" />
      <line x1="136" y1="140" x2="120" y2="124" stroke="#b45309" strokeWidth="1.5" />

      {/* Frame fill between outer and inner */}
      <path d="M27 23 L40 36 L40 124 L27 137 Z" fill="#b45309" opacity="0.08" />
      <path d="M133 23 L120 36 L120 124 L133 137 Z" fill="#b45309" opacity="0.08" />
      <path d="M27 23 L40 36 L120 36 L133 23 Z" fill="#b45309" opacity="0.06" />
      <path d="M27 137 L40 124 L120 124 L133 137 Z" fill="#b45309" opacity="0.1" />

      {/* Landscape inside: mountain */}
      <path d="M40 110 L62 78 L74 92 L88 68 L120 110 Z" fill="#e7e5e4" />

      {/* Sun */}
      <circle cx="100" cy="56" r="8" fill="#e7e5e4" />
    </svg>
  )
}
