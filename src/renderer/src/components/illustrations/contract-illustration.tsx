import type { IllustrationProps } from './types'

export function ContractIllustration({
  size = 160,
  className
}: IllustrationProps): React.JSX.Element {
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
      <ellipse cx="80" cy="138" rx="42" ry="3" fill="#78716f" opacity="0.12" />

      {/* Paper back sheet (offset for depth) */}
      <rect x="40" y="28" width="78" height="104" rx="3" fill="#e7e5e4" />
      <rect
        x="40"
        y="28"
        width="78"
        height="104"
        rx="3"
        stroke="#a8a29e"
        strokeWidth="1"
        fill="none"
      />

      {/* Paper main sheet */}
      <rect x="34" y="22" width="78" height="104" rx="3" fill="#f5f5f4" />
      <rect
        x="34"
        y="22"
        width="78"
        height="104"
        rx="3"
        stroke="#78716f"
        strokeWidth="1.25"
        fill="none"
      />

      {/* Header band */}
      <rect x="42" y="32" width="28" height="3" rx="1" fill="#b45309" />
      <rect x="42" y="38" width="42" height="2" rx="1" fill="#a8a29e" opacity="0.5" />

      {/* Body text lines */}
      <rect x="42" y="50" width="62" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.55" />
      <rect x="42" y="56" width="58" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.55" />
      <rect x="42" y="62" width="62" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.55" />
      <rect x="42" y="68" width="48" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.55" />

      <rect x="42" y="80" width="62" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.45" />
      <rect x="42" y="86" width="54" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.45" />
      <rect x="42" y="92" width="40" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.45" />

      {/* Signature line */}
      <line x1="42" y1="110" x2="86" y2="110" stroke="#78716f" strokeWidth="1" />
      {/* Signature scribble */}
      <path
        d="M44 108 Q50 102 56 108 T68 106 Q74 110 80 104"
        stroke="#b45309"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="42" y="114" width="22" height="1.25" rx="0.5" fill="#a8a29e" opacity="0.55" />

      {/* Pen */}
      <g transform="rotate(32 104 104)">
        <rect x="96" y="100" width="26" height="6" rx="1.5" fill="#b45309" />
        <rect x="96" y="100" width="6" height="6" rx="1.5" fill="#78716f" />
        <path d="M122 100 L128 103 L122 106 Z" fill="#a8a29e" />
        <path d="M126 103 L130 103" stroke="#78716f" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  )
}
