import React from "react"
import { cn } from "@/lib/utils"
import { discIcon } from "@/assets/icons"

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
      <img src={discIcon} className="w-4 h-4" alt="disc" />
      <span className="caption">{current}/{total}</span>
    </div>
  )
}