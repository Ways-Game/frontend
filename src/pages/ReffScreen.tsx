import React, { useState, useEffect } from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { Users, UserPlus, X, User, Link } from "lucide-react"
import { useTelegram } from "@/hooks/useTelegram"
import { MockApi, type ReferralUser, type UserStats, type UserProfile } from "@/services/mockApi"

export function ReffScreen() {
  const { user, getUserDisplayName, shareReferralLink, inviteFriends, getUserProfile } = useTelegram()
  const [referralUsers, setReferralUsers] = useState<ReferralUser[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, stats] = await Promise.all([
          MockApi.getReferralUsers(),
          MockApi.getUserStats()
        ])
        setReferralUsers(users)
        setUserStats(stats)
        
        if (user?.id) {
          const profile = await getUserProfile(user.id)
          setUserProfile(profile)
        }
      } catch (error) {
        console.error('Failed to load referral data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, getUserProfile])

  const handleClaimRewards = async () => {
    try {
      const result = await MockApi.claimReferralRewards()
      if (result.success) {
        const updatedStats = await MockApi.getUserStats()
        setUserStats(updatedStats)
      }
    } catch (error) {
      console.error('Failed to claim rewards:', error)
    }
  }
  
  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      <div className="flex-1 p-2.5 flex flex-col justify-end gap-2.5">
        {/* User Profile */}
        {userProfile && (
          <div className="bg-gray-900 rounded-lg p-4 mb-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold">{getUserDisplayName()}</p>
                {userProfile.username && (
                  <p className="text-gray-400 text-sm">@{userProfile.username}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-4 h-4 text-gray-400" />
              <p className="text-gray-400 text-sm">Referral Link</p>
            </div>
            <p className="text-blue-400 text-sm break-all mb-3">{userProfile.start_link}</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-gray-400 text-xs">Balance</p>
                <p className="text-white font-bold">{userProfile.balance}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-gray-400 text-xs">Balls</p>
                <p className="text-white font-bold">{userProfile.balls_count}</p>
              </div>
            </div>
          </div>
        )}

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
              onClick={shareReferralLink}
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
                onClick={shareReferralLink}
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
              <span className="text-neutral-50 text-sm">{userStats?.referrals || 0}</span>
            </div>
          </div>

          {/* Claimable and Total */}
          <div className="flex gap-2">
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">Claimable amount</span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5 w-fit">
                <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                <span className="text-neutral-50 text-sm">{userStats?.claimableAmount || 0}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">Total claimed amount</span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5 w-fit">
                <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                <span className="text-neutral-50 text-sm">{userStats?.totalClaimed || 0}</span>
              </div>
            </div>
          </div>

          {/* Claim Button */}
          <button 
            onClick={handleClaimRewards}
            disabled={!userStats?.claimableAmount}
            className={`h-8 px-3 py-2 bg-white rounded-[20px] flex items-center gap-1.5 self-start transition-opacity ${
              userStats?.claimableAmount ? 'opacity-100 hover:bg-gray-100' : 'opacity-35 cursor-not-allowed'
            }`}
          >
            <img src="/src/assets/icons/star.svg" className="w-4 h-4 brightness-0" alt="star" />
            <span className="text-black text-base font-semibold">Claim starz</span>
          </button>

          {/* Referral Users */}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-500 text-xs">Referral users</span>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : referralUsers.length > 0 ? (
              referralUsers.map((referralUser) => (
                <div key={referralUser.id} className="px-2.5 py-2 bg-white/5 rounded-[37px] flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">TG</span>
                    </div>
                    <span className="text-neutral-50 text-sm">@{referralUser.username}</span>
                  </div>
                  <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5">
                    <span className="text-neutral-50 text-sm">+{referralUser.earnings}</span>
                    <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
                  </div>
                </div>
              ))
            ) : (
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