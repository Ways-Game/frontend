import React, { useState, useEffect } from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { Users, UserPlus, X, User, Link } from "lucide-react"
import { useTelegram } from "@/hooks/useTelegram"
import { api } from "@/services/api"

export function ReffScreen() {
  const { user, getUserDisplayName, inviteFriends } = useTelegram()

  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col justify-end gap-2.5 h-[154px]">
        {/* Hero Banner */}
        <div 
          className="px-5 py-5 bg-gradient-to-b from-fuchsia-500 to-indigo-400 rounded-[20px] flex flex-col gap-5 relative overflow-hidden"
          style={{
            backgroundImage: 'url(/src/assets/ref_back.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="text-neutral-50 text-3xl font-bold">
            Post videos and earn money
          </div>
          <div className="flex ">
            <button 
              onClick={inviteFriends}
              className="h-10 px-3 py-2 bg-white rounded-[20px]"
            >
              <span className="text-black text-base font-semibold">Earn money</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-2.5 bg-zinc-900/70 rounded-[20px] flex flex-col gap-5">
          {/* User Info Row */}
          <div className="flex justify-between items-center h-8">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">TG</span>
              </div>
              <span className="text-neutral-50 text-sm">{getUserDisplayName()}</span>
            </div>
            
            <div className="px-1.5 py-2 bg-[#4378FF20] rounded-[20px] flex items-center gap-1.5 h-8">
              <img src="/src/assets/icons/ref.svg" className="w-5 h-5" alt="ref" />
              <span className="text-blue-400 text-base font-semibold">ref_{user?.id || '0000'}</span>
              <button 
                onClick={inviteFriends}
                className="w-5 h-5 bg-[#4378FF20] rounded-full flex items-center justify-center hover:bg-[#4378FF40] transition-colors"
              >
                <X className="w-3 h-3 text-blue-400" />
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="text-neutral-50 text-3xl font-bold">
            invite refferals to earn 10% of their market buys
          </div>

          {/* Invited Users */}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-500 text-xs">invited users</span>
            <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2 w-fit">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-neutral-50 text-sm">{user?.referrers_id?.length || 0}</span>
            </div>
          </div>

          {/* Referral Users */}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-500 text-xs">Referral users ({user?.referrers_id?.length || 0})</span>
            
            {user?.referrers_id?.map((referralUser) => (
              <div key={referralUser.id} className="px-2.5 py-2 bg-white/5 rounded-[37px] flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">TG</span>
                  </div>
                  <span className="text-neutral-50 text-sm">{referralUser.username ? `@${referralUser.username}` : `User ${referralUser.id}`}</span>
                </div>
                <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5">
                  <span className="text-neutral-50 text-sm">{referralUser.balls_count || 0}</span>
                  <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                </div>
              </div>
            ))}

            {(!user?.referrers_id || user.referrers_id.length === 0) && (
              <div className="text-center py-4 text-neutral-500 text-sm">
                No referrals yet. Invite friends to start earning!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Button */}
      <div className="px-6 pb-3">
        <button 
          onClick={inviteFriends}
          className="w-full h-12 px-3 py-3.5 bg-[#1B91FF] rounded-2xl flex items-center justify-center gap-2.5 hover:bg-[#1B91FF]/90 transition-colors"
        >
          <UserPlus className="w-6 h-6 text-white" />
          <span className="text-white text-base font-semibold">Invite friends</span>
        </button>
      </div>
    </div>
  )
}