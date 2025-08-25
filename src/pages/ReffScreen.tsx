import React, { useState, useEffect, useCallback } from "react";
import { Chip } from "@/components/ui/ways-chip";
import { WaysButton } from "@/components/ui/ways-button";
import { PlayerItem } from "@/components/game/PlayerItem";
import { Users, UserPlus, X, User, Link, RefreshCw } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";
import { api } from "@/services/api";
import WebApp from "@twa-dev/sdk";

const generateMockWallet = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "UQ";
  for (let i = 0; i < 46; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const formatWallet = (wallet: string) => {
  if (wallet.length < 6) return wallet;
  return `${wallet.slice(0, 3)}...${wallet.slice(-3)}`;
};

export function ReffScreen() {
  const { user, getUserDisplayName, inviteFriends } = useTelegram();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserProfile = useCallback(
    async (retries = 3) => {
      if (!user?.id) return;

      setRefreshing(true);
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const profile = await api.getUserProfile(user.id);
          if (profile && profile.id) {
            setUserProfile(profile);
            break;
          }
        } catch (error) {
          console.error(`Profile fetch attempt ${attempt} failed:`, error);
          if (attempt === retries) {
            WebApp.showAlert("Failed to load data. Please try again later.");
          }
        }
      }
      setLoading(false);
      setRefreshing(false);
    },
    [user?.id]
  );

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchUserProfile, 30000);
    return () => clearInterval(interval);
  }, [fetchUserProfile]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Add pull-to-refresh functionality
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && e.touches[0].clientY > startY + 50) {
        fetchUserProfile();
      }
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [fetchUserProfile]);

  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      {/* Refresh indicator */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 z-50">
          Updating data...
        </div>
      )}

      {/* Manual refresh button */}
      <button
        onClick={() => fetchUserProfile()}
        className="fixed top-4 right-4 bg-blue-500 p-2 rounded-full z-50"
      >
        <RefreshCw className="w-6 h-6 text-white" />
      </button>

      <div className="flex-1 p-2.5 flex flex-col justify-end gap-2.5 ">
        {/* Hero Banner */}
        <div
          className="px-5 py-5 bg-gradient-to-b from-fuchsia-500 to-indigo-400 rounded-[20px] flex flex-col gap-5 relative overflow-hidden"
          style={{
            backgroundImage: "url(/src/assets/ref_back.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="text-neutral-50 text-3xl font-bold w-[80%]">
            Post videos and earn money
          </div>
          <div className="flex ">
            <button
              onClick={inviteFriends}
              className="h-10 px-3 py-2 bg-white rounded-[20px]"
            >
              <span className="text-black text-base font-semibold">
                Earn money
              </span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-2.5 bg-zinc-900/70 rounded-[20px] flex flex-col gap-5">
          {/* User Info Row */}
          <div className="flex justify-between items-center h-8">
            <div className="flex items-center gap-2.5 px-3 py-2">
              {user?.avatar_url || user?.photo_url ? (
                <img
                  src={user.avatar_url || user.photo_url}
                  className="w-7 h-7 rounded-full object-cover"
                  alt="avatar"
                />
              ) : (
                <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">TG</span>
                </div>
              )}
              <span className="text-neutral-50 text-sm">
                {getUserDisplayName()}
              </span>
            </div>

            <div className="px-1.5 py-2 bg-[#4378FF20] rounded-[20px] flex items-center gap-1.5 h-8">
              <img
                src="/src/assets/icons/ref.svg"
                className="w-5 h-5"
                alt="ref"
              />
              <span className="text-blue-400 text-base font-semibold">
                {formatWallet(user?.wallet_address || generateMockWallet())}
              </span>
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
          <div className="flex  justify-between w-[50%]">
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">invited users</span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2 w-fit">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-neutral-50 text-sm">
                  {userProfile?.referrals?.length || 0}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-xs">
                Total claimed amount
              </span>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2 w-fit">
                <img
                  src="/src/assets/icons/star.svg"
                  className="w-4 h-4"
                  alt="star"
                />

                <span className="text-neutral-50 text-sm">
                  {userProfile?.total_amount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Referral Users */}
          <div className="flex flex-col gap-2">
            <span className="text-neutral-500 text-xs">
              Referral users ({userProfile?.referrals?.length || 0})
            </span>

            {userProfile?.referrals?.map((referralUser) => (
              <div
                key={referralUser.id}
                className="px-2.5 py-2 bg-white/5 rounded-[37px] flex justify-between items-center"
              >
                <div className="flex items-center gap-2.5">
                  {referralUser.avatar_url ? (
                    <img
                      src={referralUser.avatar_url}
                      className="w-7 h-7 rounded-full object-cover"
                      alt="avatar"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">
                        TG
                      </span>
                    </div>
                  )}
                  <span className="text-neutral-50 text-sm">
                    {referralUser.username
                      ? `@${referralUser.username}`
                      : `User ${referralUser.id}`}
                  </span>
                </div>
                <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-0.5">
                  <span className="text-neutral-50 text-sm">
                    {referralUser.earn_money || 0}
                  </span>
                  <img
                    src="/src/assets/icons/star.svg"
                    className="w-3.5 h-3.5"
                    alt="star"
                  />
                </div>
              </div>
            ))}

            {(!userProfile?.referrals ||
              userProfile.referrals.length === 0) && (
              <div className="text-center py-4 text-neutral-500 text-sm">
                {loading
                  ? "Loading referrals..."
                  : "No referrals yet. Invite friends to start earning!"}
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
          <span className="text-white text-base font-semibold">
            Invite friends
          </span>
        </button>
      </div>
    </div>
  );
}
