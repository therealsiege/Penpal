import React from 'react'

export function PanelBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(midgar-bg.jpg)' }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#080a0e]/[0.92]" />
      {/* Content */}
      <div className="relative h-full">{children}</div>
    </div>
  )
}
