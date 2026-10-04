interface PanelProps {
  title: string
  dotColor?: string
  right?: React.ReactNode
  children: React.ReactNode
  rawBody?: boolean
}

export default function Panel({ title, dotColor, right, children, rawBody = false }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="ph-title">
          {dotColor && <span className="dot" style={{ background: dotColor }} />}
          {title}
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
      </div>
      {rawBody ? children : <div className="panel-body">{children}</div>}
    </div>
  )
}
