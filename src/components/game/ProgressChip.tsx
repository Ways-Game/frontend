import React from "react"
import { cn } from "@/lib/utils"

interface ProgressChipProps {
  current: number
  total: number
  progress: number // 0-100
  className?: string
}

export function ProgressChip({ current, total, progress, className }: ProgressChipProps) {
  const radius = 8
  const strokeWidth = 2
  const normalizedRadius = radius - strokeWidth * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`

  return (
    <div className={cn("chip chip-gray flex items-center gap-2", className)}>
      <div className="relative w-4 h-4">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          <circle
            stroke="hsl(var(--border))"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="hsl(var(--accent-cyan))"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
      </div>
      <span className="caption">{current}/{total}</span>
    </div>
  )
}