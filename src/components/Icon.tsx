import type { ReactNode } from 'react'
import type { IconName } from '../types'

const PATHS: Record<IconName, ReactNode> = {
  pulse: <path d="M3 12h3l2.5-6.5L13 19l2.6-7H21" />,
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3.2 3.2 0 0 1 0 6M18 20a5.6 5.6 0 0 0-1.6-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  code: <path d="M9 7l-4.5 5L9 17M15 7l4.5 5L15 17" />,
}

interface IconProps {
  name: IconName
  size?: number
}

export function Icon({ name, size = 21 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
