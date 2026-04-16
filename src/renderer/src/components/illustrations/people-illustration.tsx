import type { IllustrationProps } from './types'

export function PeopleIllustration({
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
      {/* Person 1 — left, medium height, neutral */}
      <circle cx="44" cy="56" r="12" fill="#a8a29e" />
      <rect x="32" y="72" width="24" height="36" rx="10" fill="#a8a29e" />

      {/* Person 2 — center, tallest, accent colored */}
      <circle cx="80" cy="44" r="14" fill="#b45309" opacity="0.8" />
      <rect x="66" y="62" width="28" height="44" rx="12" fill="#b45309" opacity="0.8" />

      {/* Person 3 — right, shorter, lighter neutral */}
      <circle cx="116" cy="60" r="11" fill="#e7e5e4" />
      <rect x="105" y="75" width="22" height="32" rx="9" fill="#e7e5e4" />

      {/* Subtle shadow/ground line */}
      <ellipse cx="80" cy="130" rx="56" ry="4" fill="#a8a29e" opacity="0.15" />
    </svg>
  )
}
