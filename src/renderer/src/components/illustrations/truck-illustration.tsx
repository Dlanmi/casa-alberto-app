import type { IllustrationProps } from './types'

export function TruckIllustration({ size = 160, className }: IllustrationProps): React.JSX.Element {
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
      {/* Ground shadow */}
      <ellipse cx="80" cy="124" rx="58" ry="4" fill="#78716f" opacity="0.12" />

      {/* Cargo box */}
      <rect x="24" y="52" width="72" height="62" rx="3" fill="#e7c68a" />
      <rect
        x="24"
        y="52"
        width="72"
        height="62"
        rx="3"
        stroke="#b45309"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Cargo box panel lines */}
      <line x1="60" y1="52" x2="60" y2="114" stroke="#b45309" strokeWidth="1" opacity="0.45" />
      <line x1="24" y1="82" x2="96" y2="82" stroke="#b45309" strokeWidth="1" opacity="0.35" />

      {/* Cab */}
      <path d="M96 68 L120 68 L132 84 L132 114 L96 114 Z" fill="#b45309" opacity="0.85" />
      <path
        d="M96 68 L120 68 L132 84 L132 114 L96 114 Z"
        stroke="#78716f"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Window */}
      <path d="M100 72 L118 72 L126 84 L100 84 Z" fill="#f5f5f4" />
      <path d="M100 72 L118 72 L126 84 L100 84 Z" stroke="#78716f" strokeWidth="1" fill="none" />
      {/* Door handle */}
      <rect x="102" y="96" width="8" height="2" rx="1" fill="#78716f" opacity="0.7" />

      {/* Headlight */}
      <circle cx="128" cy="104" r="2" fill="#f5f5f4" />

      {/* Wheels */}
      <circle cx="44" cy="116" r="10" fill="#44403b" />
      <circle cx="44" cy="116" r="4" fill="#a8a29e" />
      <circle cx="112" cy="116" r="10" fill="#44403b" />
      <circle cx="112" cy="116" r="4" fill="#a8a29e" />

      {/* Motion lines */}
      <line
        x1="6"
        y1="66"
        x2="18"
        y2="66"
        stroke="#78716f"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <line
        x1="2"
        y1="78"
        x2="20"
        y2="78"
        stroke="#78716f"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <line
        x1="8"
        y1="90"
        x2="18"
        y2="90"
        stroke="#78716f"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  )
}
