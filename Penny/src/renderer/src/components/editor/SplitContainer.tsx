import { useState, useCallback, useEffect } from 'react'

interface SplitContainerProps {
  direction: 'horizontal' | 'vertical'
  left: React.ReactNode
  right: React.ReactNode
}

export function SplitContainer({ direction, left, right }: SplitContainerProps) {
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [dragging, setDragging] = useState(false)

  const handleMouseDown = useCallback(() => {
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('split-container')
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (direction === 'horizontal') {
        const ratio = (e.clientX - rect.left) / rect.width
        setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)))
      } else {
        const ratio = (e.clientY - rect.top) / rect.height
        setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)))
      }
    }
    const handleMouseUp = () => setDragging(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, direction])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      id="split-container"
      className={`flex h-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}
      style={{ cursor: dragging ? (isHorizontal ? 'col-resize' : 'row-resize') : undefined }}
    >
      <div style={{ [isHorizontal ? 'width' : 'height']: `${splitRatio * 100}%` }} className="overflow-hidden">
        {left}
      </div>
      <div
        className={`shrink-0 ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} hover:bg-[#00ff88]/20 transition-colors`}
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  )
}
