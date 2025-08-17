import React, { useState } from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { ProgressChip } from "@/components/game/ProgressChip"
import { TimerChip } from "@/components/game/TimerChip"
import { Cable, RotateCcw } from "lucide-react"

const players = [
  { name: "YOU", ballz: 20, isYou: true },
  { name: "Alex", ballz: 10, isYou: false },
  { name: "Marina", ballz: 30, isYou: false },
  { name: "Dima", ballz: 50, isYou: false }
]

const quickActions = ["210", "5", "10", "X2"]

export function PvPScreen() {
  const [activeAction, setActiveAction] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-5">
        <div className="flex items-center gap-2">
          <Chip variant="live">LIVE</Chip>
          <Chip variant="gray" className="text-text-secondary">24</Chip>
        </div>
        
        <Chip variant="live">LIVE</Chip>
        
        <WaysButton variant="connect" className="flex items-center gap-1.5">
          <Cable className="w-[14px] h-[14px]" />
          Connect
        </WaysButton>
      </div>

      {/* Game Card */}
      <div className="mx-4 mb-20">
        <div className="game-card">
          {/* Status Row */}
          <div className="flex items-center justify-between mb-3">
            <Chip variant="gray">GAME #23245</Chip>
            <TimerChip seconds={15} />
            <ProgressChip current={110} total={300} progress={36} />
          </div>

          {/* Prize Pill */}
          <div className="flex justify-center mb-3">
            <Chip variant="prize" icon="star">
              Prize: ⭐ 110
            </Chip>
          </div>

          {/* Players List */}
          <div className="space-y-0">
            {players.map((player, index) => (
              <React.Fragment key={player.name}>
                <PlayerItem
                  name={player.name}
                  ballz={player.ballz}
                  isYou={player.isYou}
                />
                {index < players.length - 1 && (
                  <div className="h-px bg-border mx-3" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 space-y-4">
            <div className="flex justify-center gap-2">
              {quickActions.map((action) => (
                <WaysButton
                  key={action}
                  variant="round"
                  onClick={() => setActiveAction(action)}
                  className={`${
                    activeAction === action 
                      ? "ring-2 ring-accent-cyan" 
                      : ""
                  }`}
                >
                  {action}
                </WaysButton>
              ))}
              <WaysButton
                variant="round"
                onClick={() => setActiveAction("rotate")}
                className={`${
                  activeAction === "rotate" 
                    ? "ring-2 ring-accent-cyan" 
                    : ""
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </WaysButton>
            </div>

            {/* Main Buy Button */}
            <WaysButton variant="primary" className="w-full">
              Buy Ballz – 210 | ⭐ 6 300
            </WaysButton>

            {/* Balance Info */}
            <div className="text-center">
              <span className="micro text-text-secondary">
                You have ⭐ 500 ballz | 1 ballz = ⭐ 30
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}