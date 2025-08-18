import React from "react"
import { cn } from "@/lib/utils"
import { Chip } from "@/components/ui/ways-chip"

interface PlayerItemProps {
  name: string
  ballz: number
  avatar?: string
  isYou?: boolean
  className?: string
}

export function PlayerItem({ name, ballz, avatar, isYou = false, className }: PlayerItemProps) {
  return (
    <div
      className={cn(
        "player-item",
        isYou && "player-item-you",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="caption text-text-secondary">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span className="body font-medium">{isYou ? "YOU" : name}</span>
      </div>
      
      <Chip variant="blue" className="h-7 flex items-center gap-1">
        <img src="/src/assets/icons/disc.svg" className="w-3 h-3" alt="disc" />
        {ballz} ballz
      </Chip>
    </div>
  )
}