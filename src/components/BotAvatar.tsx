import type { ReactElement } from 'react'

const SHAPES = ['circle', 'squircle', 'pill', 'triangle', 'hexagon'] as const
type Shape = (typeof SHAPES)[number]

const PRIMARY_COLOR = '#8b5cf6'

function hash(str: string): number {
  let h = 0
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function defaultShape(name: string): Shape {
  return SHAPES[hash(name) % SHAPES.length]
}

/** Deterministic, name-derived color — mirrors Hermes' `profileColor`. */
function nameColor(name: string): string {
  const hue = hash(name) % 360
  return `hsl(${hue} 55% 52%)`
}

function isDarkColor(color: string): boolean {
  if (!color.startsWith('#')) return false
  const n = parseInt(color.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110
}

function body(shape: Shape, color: string): ReactElement {
  switch (shape) {
    case 'squircle':
      return <rect x={3} y={3} width={34} height={34} rx={11} fill={color} />
    case 'pill':
      return <rect x={2} y={7} width={36} height={26} rx={13} fill={color} />
    case 'triangle':
      return <path d="M20 5.5 L36 33.5 L4 33.5 Z" fill={color} stroke={color} strokeWidth={7} strokeLinejoin="round" />
    case 'hexagon':
      return (
        <path
          d="M20 3.5 L34.5 11.75 L34.5 28.25 L20 36.5 L5.5 28.25 L5.5 11.75 Z"
          fill={color}
          stroke={color}
          strokeWidth={7}
          strokeLinejoin="round"
        />
      )
    default:
      return <circle cx={20} cy={20} r={17.5} fill={color} />
  }
}

/**
 * A bot's face: a colored shape + two eyes, matching Hermes' bot avatars
 * (the "default" profile wears the friendly violet squircle). Static/clean —
 * no animation.
 */
export function BotAvatar({ name, size = 42 }: { name: string; size?: number }) {
  const isPrimary = name === 'default'
  const shape: Shape = isPrimary ? 'squircle' : defaultShape(name)
  const color = isPrimary ? PRIMARY_COLOR : nameColor(name)
  const eyeFill = isDarkColor(color) ? 'rgba(232,220,195,0.95)' : 'rgba(0,0,0,0.85)'
  const hlFill = isDarkColor(color) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      {body(shape, color)}
      <g>
        <ellipse cx={15.4} cy={17.2} rx={2.2} ry={2.3} fill={eyeFill} />
        <ellipse cx={24.6} cy={17.2} rx={2.2} ry={2.3} fill={eyeFill} />
        <circle cx={14.8} cy={16.5} r={0.65} fill={hlFill} />
        <circle cx={24} cy={16.5} r={0.65} fill={hlFill} />
      </g>
    </svg>
  )
}
