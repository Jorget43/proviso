'use client'
import { useRef } from 'react'

// Which years the Future charts show: quick choices, then a slider with a
// handle for each end. Dragging the shaded part between the handles moves
// the whole window along, like a scroll bar. Shared by every chart through
// ScrubChart's YearWindow.

export interface YearSpan { from: number; to: number }

interface Props {
  first:   number
  last:    number
  value:   YearSpan | null
  presets: { label: string; span: YearSpan | null }[]
  onChange: (span: YearSpan | null) => void
}

const MIN_SPAN = 4

export default function YearRange({ first, last, value, presets, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; from: number; to: number } | null>(null)
  const from = Math.max(first, value?.from ?? first)
  const to = Math.min(last, value?.to ?? last)
  const total = Math.max(1, last - first)
  const pct = (y: number) => ((y - first) / total) * 100

  const set = (f: number, t: number) => onChange(f <= first && t >= last ? null : { from: f, to: t })
  const same = (a: YearSpan | null) => (a ? a.from === from && a.to === to : from === first && to === last)

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current, track = trackRef.current
    if (!d || !track) return
    const moved = Math.round(((e.clientX - d.x) / track.clientWidth) * total)
    const shift = Math.max(first - d.from, Math.min(last - d.to, moved))
    if (d.from + shift !== from) set(d.from + shift, d.to + shift)
  }

  return (
    <div className="year-range">
      <div className="year-range-head">
        <div className="seg year-range-presets" role="radiogroup" aria-label="Years shown">
          {presets.map(p => (
            <button key={p.label} type="button" role="radio" aria-checked={same(p.span)} className={same(p.span) ? 'on' : ''}
              onClick={() => onChange(p.span)}>{p.label}</button>
          ))}
        </div>
        <span className="year-range-label">{from}–{to}</span>
      </div>
      <div className="year-range-slider" ref={trackRef}>
        <div className="year-range-track" />
        <div className="year-range-fill" style={{ left: `${pct(from)}%`, width: `${pct(to) - pct(from)}%` }}
          title="Drag to move through the years"
          onPointerDown={e => { drag.current = { x: e.clientX, from, to }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={onPointerMove}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }} />
        <input type="range" min={first} max={last} value={from} aria-label="First year shown"
          onChange={e => set(Math.min(Number(e.target.value), to - MIN_SPAN), to)} />
        <input type="range" min={first} max={last} value={to} aria-label="Last year shown"
          onChange={e => set(from, Math.max(Number(e.target.value), from + MIN_SPAN))} />
      </div>
    </div>
  )
}
