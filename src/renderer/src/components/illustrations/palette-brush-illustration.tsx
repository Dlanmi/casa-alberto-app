import type { IllustrationProps } from './types'

export function PaletteBrushIllustration({
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
      {/* Palette body — kidney shape via ellipse + thumb hole */}
      <ellipse cx="76" cy="90" rx="52" ry="40" fill="#e7e5e4" transform="rotate(-10, 76, 90)" />
      {/* Palette highlight */}
      <ellipse cx="76" cy="88" rx="48" ry="36" fill="#f5f5f4" transform="rotate(-10, 76, 88)" />

      {/* Thumb hole */}
      <ellipse cx="56" cy="100" rx="10" ry="8" fill="white" transform="rotate(-10, 56, 100)" />
      <ellipse
        cx="56"
        cy="100"
        rx="10"
        ry="8"
        stroke="#e7e5e4"
        strokeWidth="1.5"
        fill="none"
        transform="rotate(-10, 56, 100)"
      />

      {/* Paint dots on palette */}
      <circle cx="68" cy="72" r="6" fill="#b45309" opacity="0.7" />
      <circle cx="86" cy="68" r="5" fill="#1d4ed8" opacity="0.6" />
      <circle cx="100" cy="76" r="5" fill="#047857" opacity="0.5" />
      <circle cx="78" cy="82" r="4" fill="#b45309" opacity="0.4" />
      <circle cx="94" cy="88" r="3.5" fill="#1d4ed8" opacity="0.35" />

      {/* Brush 1 — amber handle */}
      <rect
        x="110"
        y="28"
        width="5"
        height="40"
        rx="2"
        fill="#b45309"
        opacity="0.8"
        transform="rotate(20, 112, 48)"
      />
      {/* Ferrule */}
      <rect
        x="110"
        y="66"
        width="5"
        height="6"
        rx="0.5"
        fill="#a8a29e"
        transform="rotate(20, 112, 69)"
      />
      {/* Bristles */}
      <rect
        x="110.5"
        y="71"
        width="4"
        height="10"
        rx="2"
        fill="#1d4ed8"
        opacity="0.5"
        transform="rotate(20, 112.5, 76)"
      />

      {/* Brush 2 — thinner, offset */}
      <rect
        x="124"
        y="34"
        width="4"
        height="34"
        rx="1.5"
        fill="#b45309"
        opacity="0.6"
        transform="rotate(28, 126, 51)"
      />
      {/* Ferrule 2 */}
      <rect
        x="124"
        y="66"
        width="4"
        height="5"
        rx="0.5"
        fill="#a8a29e"
        opacity="0.8"
        transform="rotate(28, 126, 68)"
      />
      {/* Bristles 2 */}
      <rect
        x="124.5"
        y="70"
        width="3"
        height="8"
        rx="1.5"
        fill="#b45309"
        opacity="0.4"
        transform="rotate(28, 126, 74)"
      />
    </svg>
  )
}
