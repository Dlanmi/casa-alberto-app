import type { IllustrationProps } from './types'

export function CalmDayIllustration({
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
      {/* Sun */}
      <circle cx="116" cy="44" r="16" fill="#f5c97a" opacity="0.85" />
      <circle cx="116" cy="44" r="16" stroke="#b45309" strokeWidth="1.5" fill="none" />
      {/* Sun rays */}
      <line
        x1="116"
        y1="18"
        x2="116"
        y2="24"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="116"
        y1="64"
        x2="116"
        y2="70"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="90"
        y1="44"
        x2="96"
        y2="44"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="136"
        y1="44"
        x2="142"
        y2="44"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="98"
        y1="26"
        x2="102"
        y2="30"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="130"
        y1="58"
        x2="134"
        y2="62"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="98"
        y1="62"
        x2="102"
        y2="58"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="130"
        y1="30"
        x2="134"
        y2="26"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Saucer */}
      <ellipse cx="64" cy="118" rx="42" ry="6" fill="#78716f" opacity="0.18" />
      <ellipse cx="64" cy="114" rx="38" ry="5" fill="#f5f5f4" />
      <ellipse cx="64" cy="114" rx="38" ry="5" stroke="#a8a29e" strokeWidth="1.25" fill="none" />

      {/* Cup body */}
      <path d="M34 78 L94 78 L90 112 Q90 116 84 116 L44 116 Q38 116 38 112 Z" fill="#f5f5f4" />
      <path
        d="M34 78 L94 78 L90 112 Q90 116 84 116 L44 116 Q38 116 38 112 Z"
        stroke="#78716f"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Cup rim shadow */}
      <ellipse cx="64" cy="78" rx="30" ry="4" fill="#d6a35c" opacity="0.35" />
      <ellipse cx="64" cy="78" rx="30" ry="4" stroke="#78716f" strokeWidth="1" fill="none" />
      {/* Coffee */}
      <ellipse cx="64" cy="78" rx="26" ry="3" fill="#7c2d12" opacity="0.85" />

      {/* Handle */}
      <path
        d="M94 84 Q108 84 108 96 Q108 108 92 108"
        stroke="#78716f"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Steam */}
      <path
        d="M54 68 Q50 62 54 56 Q58 50 54 44"
        stroke="#a8a29e"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M66 66 Q62 60 66 54 Q70 48 66 42"
        stroke="#a8a29e"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M78 68 Q74 62 78 56 Q82 50 78 44"
        stroke="#a8a29e"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}
