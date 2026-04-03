import React from 'react'
import { useAppearanceStore } from '../stores/appearance-store'

export function PanelBackground({ children }: { children: React.ReactNode }) {
  const theme = useAppearanceStore((s) => s.theme)
  const isLight = theme === 'light'

  return (
    <div className="relative h-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: isLight ? 'url(vault-bg.jpg)' : 'url(midgar-bg.jpg)' }}
      />
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: isLight ? 'rgba(245,240,232,0.88)' : 'rgba(8,10,14,0.94)' }}
      />
      {/* Content */}
      <div className="relative h-full">{children}</div>
    </div>
  )
}
