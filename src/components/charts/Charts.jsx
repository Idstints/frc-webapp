import { useRef, useState } from 'react'

/* Lightweight SVG charts following the house dataviz specs:
   thin marks (bars ≤ 24px, 4px rounded data-end, square baseline), 2px lines,
   ≥8px markers with a 2px surface ring, 2px surface gaps between touching fills,
   hairline solid gridlines, muted axis text, hover tooltips on every mark. */

const SURFACE = '#fffefb'

function useTooltip() {
  const wrapRef = useRef(null)
  const [tip, setTip] = useState(null)
  const show = (evt, content) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: evt.clientX - box.left, y: evt.clientY - box.top, content })
  }
  const hide = () => setTip(null)
  return { wrapRef, tip, show, hide }
}

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="viz-tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  )
}

export function StatTile({ label, value, note, noteUp = false }) {
  return (
    <div className="card stat-tile">
      <div className="st-label">{label}</div>
      <div className="st-value">{value}</div>
      {note && <div className={`st-note ${noteUp ? 'st-delta-up' : ''}`}>{note}</div>}
    </div>
  )
}

// Horizontal bar: rounded data-end (right), square at the baseline (left).
function barPath(x, y, w, h, r) {
  const rr = Math.min(r, w, h / 2)
  return `M${x},${y} h${Math.max(w - rr, 0)} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - 2 * rr} a${rr},${rr} 0 0 1 ${-rr},${rr} h${-Math.max(w - rr, 0)} z`
}

export function HBarChart({ data, color = '#2a78d6', valueSuffix = '', maxBars = 8 }) {
  const { wrapRef, tip, show, hide } = useTooltip()
  const rows = data.slice(0, maxBars)
  if (!rows.length) return <div className="empty" style={{ padding: 24 }}>No data yet</div>

  const barH = 20
  const gap = 12
  const labelW = 150
  const width = 460
  const valueW = 44
  const height = rows.length * (barH + gap) - gap + 8
  const max = Math.max(...rows.map((d) => d.value), 1)
  const plotW = width - labelW - valueW

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Bar chart">
        {rows.map((d, i) => {
          const y = i * (barH + gap) + 4
          const w = Math.max((d.value / max) * plotW, 2)
          const name = d.label.length > 23 ? `${d.label.slice(0, 22)}…` : d.label
          return (
            <g
              key={d.label}
              onMouseMove={(e) =>
                show(e, (
                  <>
                    <div className="tt-title">{d.label}</div>
                    <div>
                      {d.value}{valueSuffix}
                      {d.extra && <span className="tt-muted"> · {d.extra}</span>}
                    </div>
                  </>
                ))
              }
              onMouseLeave={hide}
            >
              {/* generous invisible hit target */}
              <rect x="0" y={y - gap / 2} width={width} height={barH + gap} fill="transparent" />
              <text className="axis-text" x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end">{name}</text>
              <path d={barPath(labelW, y, w, barH, 4)} fill={d.color ?? color} />
              <text className="bar-label" x={labelW + w + 7} y={y + barH / 2 + 4}>
                {d.value}{valueSuffix}
              </text>
            </g>
          )
        })}
        <line className="baseline" x1={labelW} y1={0} x2={labelW} y2={height} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

export function DonutChart({ data }) {
  const { wrapRef, tip, show, hide } = useTooltip()
  const entries = data.filter((d) => d.value > 0)
  const total = entries.reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="empty" style={{ padding: 24 }}>No data yet</div>

  const size = 190
  const cx = size / 2
  const cy = size / 2
  const R = 82
  const inner = 52
  let angle = -Math.PI / 2

  const arcs = entries.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    const large = sweep > Math.PI ? 1 : 0
    const p = (r, a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    return {
      ...d,
      mid: (a0 + a1) / 2,
      path: `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(inner, a1)} A${inner},${inner} 0 ${large} 0 ${p(inner, a0)} z`,
    }
  })

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} style={{ flex: 'none', maxWidth: '100%' }} role="img" aria-label="Donut chart">
          {arcs.map((a) => (
            <path
              key={a.label}
              d={a.path}
              fill={a.color}
              stroke={SURFACE}
              strokeWidth="2"
              onMouseMove={(e) =>
                show(e, (
                  <>
                    <div className="tt-title">{a.label}</div>
                    <div>
                      {a.value} · {Math.round((a.value / total) * 100)}%
                    </div>
                  </>
                ))
              }
              onMouseLeave={hide}
            />
          ))}
          <text x={cx} y={cy - 3} textAnchor="middle" style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, fill: 'var(--ink)' }}>
            {total}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" className="axis-text">total</text>
        </svg>
        {/* legend doubles as the visible value labels (relief for low-contrast hues) */}
        <div className="legend" style={{ flexDirection: 'column', gap: 7, marginTop: 0 }}>
          {entries.map((d) => (
            <div key={d.label} className="lg-item">
              <span className="lg-swatch" style={{ background: d.color }} />
              {d.label}
              <span className="lg-count">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}

export function LineChart({ data, color = '#2a78d6', yLabel = '' }) {
  const { wrapRef, tip, show, hide } = useTooltip()
  const [hover, setHover] = useState(null)
  if (data.length < 2) return <div className="empty" style={{ padding: 24 }}>Not enough data yet — check back after a couple of sessions</div>

  const width = 720
  const height = 230
  const pad = { l: 34, r: 16, t: 12, b: 26 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const max = Math.max(...data.map((d) => d.value), 1)
  const yMax = Math.max(Math.ceil(max / 5) * 5, 5)
  const x = (i) => pad.l + (i / (data.length - 1)) * plotW
  const y = (v) => pad.t + plotH - (v / yMax) * plotH
  const ticks = [0, yMax / 2, yMax].map(Math.round)

  const linePath = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const areaPath = `${linePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} z`
  const labelEvery = Math.ceil(data.length / 8)

  const onMove = (e) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const px = ((e.clientX - box.left) / box.width) * width
    const i = Math.min(data.length - 1, Math.max(0, Math.round(((px - pad.l) / plotW) * (data.length - 1))))
    setHover(i)
    show(e, (
      <>
        <div className="tt-title">{data[i].label}</div>
        <div>{data[i].value} {yLabel}</div>
      </>
    ))
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Line chart"
        onMouseMove={onMove}
        onMouseLeave={() => { hide(); setHover(null) }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={pad.l} y1={y(t)} x2={width - pad.r} y2={y(t)} />
            <text className="axis-text" x={pad.l - 7} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path d={areaPath} fill={color} opacity="0.1" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <line x1={x(hover)} y1={pad.t} x2={x(hover)} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />
        )}
        {data.map((d, i) => (
          (i === data.length - 1 || hover === i) && (
            <circle key={d.label} cx={x(i)} cy={y(d.value)} r="4.5" fill={color} stroke={SURFACE} strokeWidth="2" />
          )
        ))}
        {data.map((d, i) => (
          i % labelEvery === 0 && (
            <text key={d.label} className="axis-text" x={x(i)} y={height - 8} textAnchor="middle">{d.label}</text>
          )
        ))}
        <line className="baseline" x1={pad.l} y1={y(0)} x2={width - pad.r} y2={y(0)} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

export function RankList({ items, suffix = '' }) {
  if (!items.length) return <div className="empty" style={{ padding: 24 }}>No data yet</div>
  return (
    <div className="rank-list">
      {items.map((it, i) => (
        <div key={it.label} className="rank-row">
          <span className="rk">{i + 1}</span>
          <span className="rn">{it.label}</span>
          <span className="rv">{it.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}
