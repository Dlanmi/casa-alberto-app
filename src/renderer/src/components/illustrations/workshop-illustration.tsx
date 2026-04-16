import type { IllustrationProps } from './types'

export function WorkshopIllustration({
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
      {/* Workbench top */}
      <rect x="16" y="96" width="128" height="8" rx="2" fill="#a8a29e" />

      {/* Workbench legs */}
      <rect x="24" y="104" width="6" height="36" rx="1" fill="#a8a29e" />
      <rect x="130" y="104" width="6" height="36" rx="1" fill="#a8a29e" />

      {/* Cross brace */}
      <rect x="30" y="122" width="100" height="4" rx="1" fill="#a8a29e" opacity="0.5" />

      {/* Small frame leaning on bench */}
      <rect
        x="44"
        y="56"
        width="36"
        height="40"
        rx="2"
        stroke="#b45309"
        strokeWidth="4"
        fill="none"
        transform="rotate(-8, 62, 76)"
      />
      <rect
        x="52"
        y="64"
        width="20"
        height="24"
        rx="1"
        fill="#f5f5f4"
        transform="rotate(-8, 62, 76)"
      />

      {/* Ruler */}
      <rect x="96" y="58" width="6" height="38" rx="1" fill="#b45309" opacity="0.7" />
      {/* Ruler markings */}
      <line x1="96" y1="66" x2="99" y2="66" stroke="#f5f5f4" strokeWidth="1" />
      <line x1="96" y1="74" x2="99" y2="74" stroke="#f5f5f4" strokeWidth="1" />
      <line x1="96" y1="82" x2="99" y2="82" stroke="#f5f5f4" strokeWidth="1" />
      <line x1="96" y1="90" x2="100" y2="90" stroke="#f5f5f4" strokeWidth="1.5" />

      {/* Mat cutter silhouette */}
      <rect
        x="114"
        y="64"
        width="20"
        height="6"
        rx="1"
        fill="#a8a29e"
        transform="rotate(-25, 124, 67)"
      />
      <path d="M116 72 L118 92" stroke="#a8a29e" strokeWidth="3" strokeLinecap="round" />
      {/* Blade */}
      <path d="M117 92 L119 96 L121 92" fill="#b45309" opacity="0.6" />
    </svg>
  )
}
