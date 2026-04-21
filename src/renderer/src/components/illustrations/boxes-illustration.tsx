import type { IllustrationProps } from './types'

export function BoxesIllustration({ size = 160, className }: IllustrationProps): React.JSX.Element {
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
      {/* Shadow */}
      <ellipse cx="80" cy="134" rx="52" ry="4" fill="#78716f" opacity="0.12" />

      {/* Back box (smaller, tucked behind) */}
      <rect x="90" y="58" width="42" height="44" rx="2" fill="#d6a35c" opacity="0.9" />
      <rect x="90" y="58" width="42" height="8" rx="2" fill="#b45309" opacity="0.6" />
      <rect x="104" y="58" width="14" height="6" fill="#78716f" opacity="0.3" />

      {/* Front-left box */}
      <rect x="24" y="74" width="56" height="56" rx="2" fill="#e7c68a" />
      <rect x="24" y="74" width="56" height="10" rx="2" fill="#b45309" opacity="0.55" />
      {/* Tape */}
      <rect x="48" y="74" width="8" height="56" fill="#a8a29e" opacity="0.35" />
      <rect x="24" y="84" width="56" height="3" fill="#78716f" opacity="0.2" />
      {/* Label */}
      <rect x="34" y="96" width="22" height="14" rx="1" fill="#f5f5f4" />
      <rect x="37" y="100" width="14" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.7" />
      <rect x="37" y="104" width="10" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.5" />

      {/* Front-right box (slightly taller) */}
      <rect x="80" y="66" width="52" height="64" rx="2" fill="#d6a35c" />
      <rect x="80" y="66" width="52" height="10" rx="2" fill="#b45309" opacity="0.6" />
      <rect x="102" y="66" width="8" height="64" fill="#a8a29e" opacity="0.3" />
      <rect x="80" y="76" width="52" height="3" fill="#78716f" opacity="0.25" />
      {/* Label */}
      <rect x="88" y="90" width="22" height="14" rx="1" fill="#f5f5f4" />
      <rect x="91" y="94" width="14" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.7" />
      <rect x="91" y="98" width="10" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.5" />

      {/* Outlines to keep shapes readable */}
      <rect
        x="24"
        y="74"
        width="56"
        height="56"
        rx="2"
        stroke="#b45309"
        strokeWidth="1.25"
        fill="none"
      />
      <rect
        x="80"
        y="66"
        width="52"
        height="64"
        rx="2"
        stroke="#b45309"
        strokeWidth="1.25"
        fill="none"
      />
      <rect
        x="90"
        y="58"
        width="42"
        height="44"
        rx="2"
        stroke="#b45309"
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}
