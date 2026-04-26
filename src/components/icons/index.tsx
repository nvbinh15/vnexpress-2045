// Lightweight chrome icons. Stroke 1.5 to match VnExpress feel.
// Each icon takes optional size and inherits currentColor.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const baseProps = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export function SearchIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  )
}

export function UserIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  )
}

export function MenuIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

// Speech-bubble used for comment counts. Matches VnE shape: rounded-corner
// rectangle with a small triangular tail at bottom-left.
export function CommentBubbleIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M3 5.6C3 4.7 3.7 4 4.6 4h10.8c.9 0 1.6.7 1.6 1.6v6.7c0 .9-.7 1.6-1.6 1.6H10.5l-3.3 2.9-.0-2.9H4.6c-.9 0-1.6-.7-1.6-1.6V5.6z" />
    </svg>
  )
}

export function ShareIcon({ size = 14, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
      <path d="M8.2 11l6.6-3.6M8.2 13l6.6 3.6" />
    </svg>
  )
}

export function BookmarkIcon({ size = 14, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  )
}

// Cloud-with-sun for weather widget
export function WeatherIcon({ size = 14, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="8" cy="9" r="2.6" />
      <path d="M8 3.2v1.4M3.4 9H4.8M5.1 5.9L6 6.9M11.2 5.9l-.9 1" />
      <path d="M11.5 14.5h5.5a3 3 0 1 0-1-5.85" />
      <path d="M11.5 14.5H9a2.5 2.5 0 1 1 .65-4.92" />
    </svg>
  )
}

export function ClockIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

export function PlayIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...rest}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export function HomeIcon({ size = 14, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} {...rest}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </svg>
  )
}
