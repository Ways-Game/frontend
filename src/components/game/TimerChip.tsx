import React from "react"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface TimerChipProps {
  seconds: number
  className?: string
}

export function TimerChip({ seconds, className }: TimerChipProps) {
  return (
    <div className={cn("chip chip-gray flex items-center gap-1.5", className)}>
      <Clock className="w-3 h-3" />
      <span className="caption">{seconds}s</span>
    </div>
  )
}

interface CircularTimerProps {
  seconds: number
  totalSeconds: number
  className?: string
}

export function CircularTimer({ seconds, totalSeconds, className }: CircularTimerProps) {
  const radius = 14
  const strokeWidth = 2
  const normalizedRadius = radius - strokeWidth * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`

  return (
    <div className={cn("relative w-7 h-7", className)}>
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
          stroke="hsl(var(--accent-yellow))"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="micro text-foreground font-medium">{seconds}</span>
      </div>
    </div>
  )
}