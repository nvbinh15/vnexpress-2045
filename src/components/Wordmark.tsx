interface Props {
  height?: number
  className?: string
}

/**
 * VnExpress 2045 wordmark — derivative SVG mark for the satirical "2045" fork.
 *
 * Same chunky condensed sans-serif energy and VnE brand red as the original,
 * but distinct enough to read as a fictional sibling brand. The "2045" is
 * rendered as a clean rounded badge to the right.
 *
 * Intrinsic ratio 350:60. Default height 42 → width ~245px.
 */
export default function Wordmark({ height = 42, className = '' }: Props) {
  const aspect = 350 / 60
  const width = Math.round(height * aspect)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 350 60"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="VnExpress 2045"
    >
      <g fill="#a4123f">
        {/* Wordmark text — heavy condensed sans, slight negative tracking */}
        <text
          x="0"
          y="42"
          fontFamily="Arial Black, Arial, Helvetica, sans-serif"
          fontWeight={900}
          fontSize="46"
          letterSpacing="-2"
        >
          VnExpress
        </text>

        {/* Stylised swooped underline beneath the wordmark — derivative of
            the original mark's dropped-curve detail. */}
        <path
          d="M3 53 Q 130 64 255 53"
          fill="none"
          stroke="#a4123f"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* "2045" sub-brand badge */}
        <rect
          x="263"
          y="14"
          width="80"
          height="32"
          rx="5"
          ry="5"
          fill="#a4123f"
        />
        <text
          x="303"
          y="37"
          fontFamily="Arial Black, Arial, Helvetica, sans-serif"
          fontSize="22"
          fontWeight={900}
          fill="#fff"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          2045
        </text>
      </g>
    </svg>
  )
}
