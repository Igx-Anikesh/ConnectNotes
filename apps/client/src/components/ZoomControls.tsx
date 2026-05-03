import type { CanvasBackgroundMode } from '@draftboard/shared'

interface ZoomControlsProps {
  zoom: number
  bgMode: CanvasBackgroundMode
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onBgModeChange: (mode: CanvasBackgroundMode) => void
}

const modes: { id: CanvasBackgroundMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dots', label: 'Dotted Grid',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="2" cy="2" r="1" /><circle cx="8" cy="2" r="1" /><circle cx="14" cy="2" r="1" /><circle cx="2" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="14" cy="8" r="1" /><circle cx="2" cy="14" r="1" /><circle cx="8" cy="14" r="1" /><circle cx="14" cy="14" r="1" /></svg>,
  },
  {
    id: 'blank', label: 'Blank Canvas',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="2" /></svg>,
  },
  {
    id: 'grid', label: 'Square Grid',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="15" height="15" /><line x1="5.5" y1="0.5" x2="5.5" y2="15.5" /><line x1="10.5" y1="0.5" x2="10.5" y2="15.5" /><line x1="0.5" y1="5.5" x2="15.5" y2="5.5" /><line x1="0.5" y1="10.5" x2="15.5" y2="10.5" /></svg>,
  },
]

export function ZoomControls({ zoom, bgMode, onZoomIn, onZoomOut, onResetZoom, onBgModeChange }: ZoomControlsProps) {
  return (
    <div className="zoom-controls" id="zoom-controls">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`bg-mode-btn ${bgMode === mode.id ? 'active' : ''}`}
          id={`bg-${mode.id}`}
          onClick={() => onBgModeChange(mode.id)}
          title={mode.label}
        >
          {mode.icon}
        </button>
      ))}
      <span style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px' }} />
      <button className="zoom-btn" id="zoom-out-btn" onClick={onZoomOut} title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <span className="zoom-level" id="zoom-level" onClick={onResetZoom} title="Reset zoom">
        {zoom}%
      </span>
      <button className="zoom-btn" id="zoom-in-btn" onClick={onZoomIn} title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
    </div>
  )
}
