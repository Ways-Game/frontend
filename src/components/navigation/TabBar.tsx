import React from "react"
import { cn } from "@/lib/utils"
import { Gamepad2, ShoppingBag, Star, Clock } from "lucide-react"

interface TabBarProps {
  activeTab: "pvp" | "market" | "earn" | "history"
  onTabChange: (tab: "pvp" | "market" | "earn" | "history") => void
}

const tabs = [
  { id: "pvp" as const, label: "PvP", icon: Gamepad2 },
  { id: "market" as const, label: "Market", icon: ShoppingBag },
  { id: "earn" as const, label: "Earn", icon: Star },
  { id: "history" as const, label: "History", icon: Clock }
]

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[60px] bg-bg-elev-1 border-t border-border">
      <div className="flex items-center justify-around h-full px-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
              activeTab === id ? "text-foreground" : "text-tertiary"
            )}
          >
            <Icon className="w-[22px] h-[22px]" />
            <span className="micro">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}