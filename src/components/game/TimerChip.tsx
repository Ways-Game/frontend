import React from "react"
import { cn } from "@/lib/utils"
import { Clock, Circle } from "lucide-react"

interface TimerChipProps {
  seconds: number
  className?: string
}

export function TimerChip({ seconds, className }: TimerChipProps) {
  return (
    <div className={cn("chip chip-gray flex items-center gap-1.5", className)}>
      <Clock className="w-3 h-3" />
      <span className="caption">{Math.max(0, seconds)}s</span>
    </div>
  )
}

interface CircularTimerProps {
  seconds: number
  totalSeconds: number
  className?: string
}

export function CircularTimer({ seconds, totalSeconds, className }: CircularTimerProps) {
  return (
    <div className={cn("flex justify-start items-center gap-0.5", className)}>
      <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
      <div className="text-center text-neutral-50 text-sm leading-snug">{seconds}</div>
    </div>
  )
}