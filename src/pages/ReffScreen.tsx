import React from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { Users, Star, Gift } from "lucide-react"

const referralUsers = [
  { name: "Alex", ballz: 10 },
  { name: "Marina", ballz: 30 },
  { name: "Dima", ballz: 50 }
]

export function ReffScreen() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Banner */}
      <div className="mx-4 mt-4 mb-4">
        <div 
          className="relative h-24 rounded-2xl p-4 flex flex-col justify-center"
          style={{ background: '#2B5BFF' }}
        >
          <h1 className="text-foreground mb-2">Post videos and earn money</h1>
          <WaysButton 
            variant="secondary" 
            className="self-start bg-white/10 border-none h-8 px-3 py-1.5 rounded-[10px]"
          >
            Earn money
          </WaysButton>
        </div>
      </div>

      {/* Referral Card */}
      <div className="mx-4">
        <div className="game-card">
          {/* User Info Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <span className="caption text-text-secondary">U</span>
              </div>
              <span className="caption text-text-tertiary">@username</span>
            </div>
            
            <Chip variant="blue" onClose={() => {}}>
              XD...FEeF
            </Chip>
          </div>

          {/* Title */}
          <div className="mb-4">
            <p className="title text-foreground leading-relaxed">
              invite referrals to earn 10% of their market buys
            </p>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-text-secondary" />
              <span className="caption text-text-secondary">invited users</span>
              <span className="caption text-foreground font-semibold">0</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Chip variant="gray" className="flex items-center gap-1">
                <Star className="w-3 h-3 text-gold fill-current" />
                <span className="caption">Claimable</span>
              </Chip>
              
              <span className="caption text-text-secondary">Total claimed</span>
            </div>
          </div>

          {/* Claim Button */}
          <div className="mb-4">
            <WaysButton variant="claim" className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-gold fill-current" />
              Claim starz
            </WaysButton>
          </div>

          {/* Referral Users Section */}
          <div className="mb-4">
            <h3 className="title text-foreground mb-3">Referral users</h3>
            <div className="space-y-0">
              {referralUsers.map((user, index) => (
                <React.Fragment key={user.name}>
                  <PlayerItem
                    name={user.name}
                    ballz={user.ballz}
                    isYou={false}
                  />
                  {index < referralUsers.length - 1 && (
                    <div className="h-px bg-border mx-3" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Invite Button */}
          <WaysButton 
            variant="primary" 
            className="w-full"
            style={{ 
              background: 'hsl(var(--accent-blue))',
              boxShadow: '0 8px 16px rgba(47, 134, 255, 0.35)'
            }}
          >
            <Gift className="w-4 h-4" />
            Invite friends
          </WaysButton>
        </div>
      </div>
    </div>
  )
}