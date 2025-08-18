import React from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { Users, UserPlus, X } from "lucide-react"

const referralUsers = [
  { name: "Alex", ballz: 10 },
  { name: "Marina", ballz: 30 },
  { name: "Dima", ballz: 50 }
]

export function ReffScreen() {
  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col justify-end gap-2.5">
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
            <button className="h-10 px-3 py-2 bg-white rounded-[20px]">
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
              <span className="text-neutral-50 text-sm">@bluryt</span>
            </div>
            
            <div className="px-1.5 py-2 bg-[#4378FF20]  rounded-[20px] flex items-center gap-1.5 h-8">
              <img src="/src/assets/icons/ref.svg" className="w-5 h-5" alt="ref" />
              <span className="text-blue-400 text-base font-semibold">XDE3...FEeF</span>
              <div className="w-5 h-5 bg-[#4378FF20] rounded-full flex items-center justify-center">
                <X className="w-3 h-3 text-blue-400" />
              </div>
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
              <span className="text-neutral-50 text-sm">0</span>
            </div>
          </div>

          {/* Claimable and Total */}
          <div className="flex gap-2">
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">Claimable amount</span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5 w-fit">
                <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                <span className="text-neutral-50 text-sm">0</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">Total claimed amount</span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5 w-fit">
                <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                <span className="text-neutral-50 text-sm">0</span>
              </div>
            </div>
          </div>

          {/* Claim Button */}
          <button className="h-8 px-3 py-2 opacity-35 bg-white rounded-[20px] flex items-center gap-1.5 self-start">
            <img src="/src/assets/icons/star.svg" className="w-4 h-4 brightness-0" alt="star" />

            <span className="text-black text-base font-semibold">Claim starz</span>
          </button>

          {/* Referral Users */}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-500 text-xs">Refferal users</span>
            {['@dgfrfdtgrt', '@ergertrthr', '@rr4544'].map((username, index) => (
              <div key={username} className="px-2.5 py-2 bg-white/5 rounded-[37px] flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">TG</span>
                  </div>
                  <span className="text-neutral-50 text-sm">{username}</span>
                </div>
                <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5">
                  <span className="text-neutral-50 text-sm">+{[20, 204, 23323][index]}</span>
                  <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Button */}
      <div className="px-6 pb-3">
        <button className="w-full h-12 px-3 py-3.5 bg-[#1B91FF] rounded-2xl flex items-center justify-center gap-2.5">
          <UserPlus className="w-6 h-6 text-white" />
          <span className="text-white text-base font-semibold">Invite friends</span>
        </button>
      </div>
    </div>
  )
}