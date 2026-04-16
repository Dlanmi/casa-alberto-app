import type { IllustrationProps } from './types'

export function CashRegisterIllustration({
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
      {/* Register body */}
      <rect x="32" y="64" width="96" height="60" rx="4" fill="#a8a29e" />

      {/* Register top panel */}
      <rect x="36" y="60" width="88" height="10" rx="2" fill="#a8a29e" opacity="0.8" />

      {/* Display screen */}
      <rect x="48" y="72" width="40" height="14" rx="2" fill="#f5f5f4" />

      {/* Display text line */}
      <rect x="52" y="77" width="24" height="2" rx="1" fill="#047857" opacity="0.6" />
      <rect x="52" y="81" width="16" height="2" rx="1" fill="#047857" opacity="0.4" />

      {/* Button grid */}
      <rect x="48" y="94" width="8" height="6" rx="1" fill="#e7e5e4" />
      <rect x="60" y="94" width="8" height="6" rx="1" fill="#e7e5e4" />
      <rect x="72" y="94" width="8" height="6" rx="1" fill="#e7e5e4" />
      <rect x="48" y="104" width="8" height="6" rx="1" fill="#e7e5e4" />
      <rect x="60" y="104" width="8" height="6" rx="1" fill="#e7e5e4" />
      <rect x="72" y="104" width="8" height="6" rx="1" fill="#047857" opacity="0.7" />

      {/* Cash drawer */}
      <rect x="36" y="116" width="88" height="8" rx="2" fill="#a8a29e" opacity="0.6" />
      <rect x="72" y="118" width="16" height="4" rx="2" fill="#e7e5e4" />

      {/* Receipt coming out the top */}
      <rect x="60" y="32" width="24" height="30" rx="1" fill="#f5f5f4" />
      <rect x="60" y="32" width="24" height="30" rx="1" stroke="#e7e5e4" strokeWidth="1" />
      {/* Receipt lines */}
      <rect x="64" y="38" width="16" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.4" />
      <rect x="64" y="43" width="12" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.4" />
      <rect x="64" y="48" width="14" height="1.5" rx="0.5" fill="#a8a29e" opacity="0.4" />
      <rect x="64" y="53" width="10" height="1.5" rx="0.5" fill="#047857" opacity="0.5" />

      {/* Coins */}
      <ellipse cx="114" cy="102" rx="10" ry="4" fill="#047857" opacity="0.25" />
      <ellipse cx="114" cy="100" rx="10" ry="4" fill="#047857" opacity="0.5" />
      <circle cx="114" cy="100" r="3" fill="#047857" opacity="0.3" />

      <ellipse cx="122" cy="112" rx="8" ry="3" fill="#047857" opacity="0.25" />
      <ellipse cx="122" cy="110" rx="8" ry="3" fill="#047857" opacity="0.45" />

      <ellipse cx="108" cy="116" rx="7" ry="3" fill="#047857" opacity="0.2" />
      <ellipse cx="108" cy="114" rx="7" ry="3" fill="#047857" opacity="0.4" />
    </svg>
  )
}
