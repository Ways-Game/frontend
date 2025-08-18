import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { ProgressChip } from "@/components/game/ProgressChip"
import { TimerChip } from "@/components/game/TimerChip"
import { Cable, RotateCcw, Smile, Clock } from "lucide-react"
import { useLiveTimer } from "@/hooks/useLiveTimer"
import { MockApi, type GameData, type UserStats } from "@/services/mockApi"
import { useTelegram } from "@/hooks/useTelegram"

const quickActions = ["210", "5", "10", "X2"]

export function PvPScreen() {
  const navigate = useNavigate()
  const { user, webApp } = useTelegram()
  const { isActive: isLiveActive, timeLeft } = useLiveTimer(30)
  
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [game, stats] = await Promise.all([
          MockApi.getCurrentGame(),
          MockApi.getUserStats()
        ])
        setGameData(game)
        setUserStats(stats)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleStartGame = async () => {
    try {
      await MockApi.startGame()
      navigate('/game')
    } catch (error) {
      console.error('Failed to start game:', error)
    }
  }

  const handleConnect = () => {
    if (webApp) {
      webApp.openTelegramLink('https://t.me/wallet')
    }
  }

  const handleBuyBallz = async () => {
    if (!activeAction) return
    
    try {
      const amount = parseInt(activeAction) || 210
      await MockApi.buyBallz(amount)
      // Refresh data after purchase
      const updatedStats = await MockApi.getUserStats()
      setUserStats(updatedStats)
    } catch (error) {
      console.error('Failed to buy ballz:', error)
      webApp?.showAlert('Insufficient balance!')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-text-secondary">Loading game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-end gap-2.5 overflow-hidden pb-20">
      {/* Top Status Bar */}
      <div className="px-2.5 pt-3.5 flex flex-col justify-center items-end gap-3">
        <div className="w-full flex justify-start items-center gap-5 relative">
          <div className="flex-1 relative flex justify-start items-center gap-3 overflow-hidden">
            <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[24, 15, 8, 32, 12].map((count, index) => (
                <div key={index} onClick={handleStartGame} className="h-8 px-3 py-2 bg-red-500 rounded-[20px] flex items-center gap-2 relative overflow-hidden flex-shrink-0">
                  <div 
                    className="absolute inset-0 bg-white/20 transition-all duration-500 ease-out"
                    style={{
                      width: `${((30 - timeLeft) / 30) * 100}%`,
  
                    }}
                  />
                  <div className="flex items-center gap-1.5 relative z-10">
                    <Smile className="w-4 h-4 text-white" />
                    <span className="text-white text-base font-semibold">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1 relative z-10">
                    <span className="text-white/80 text-base font-semibold">{count}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="w-5 h-8 bg-gradient-to-l from-black to-black/0 absolute right-[-2px]" />
          </div>
          <button 
            onClick={handleConnect}
            className="h-8 px-3 py-2 bg-[#007AFF] rounded-[20px] flex items-center gap-1.5"
          >
            <img src="/src/assets/icons/ref.svg" className="w-5 h-5" alt="ref" />
            <span className="text-white text-base font-semibold">Connect</span>
          </button>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="flex-1 p-2.5 flex flex-col gap-2.5">
        <div className="flex-1 p-2.5 bg-zinc-900/60 rounded-tl-[20px] rounded-bl-[20px] rounded-br-[20px] flex flex-col gap-5">
          {/* Game Info Row */}
          <div className="flex justify-between items-start">
            <div className="h-8 px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
              <span className="text-white text-base">GAME #{gameData?.id || '23245'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-neutral-50 text-sm">{gameData?.timeLeft || 15}s</span>
              </div>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                <span className="text-neutral-50 text-sm">{gameData?.prizePool || 110}<span className="text-neutral-50/40">/300</span></span>
              </div>
            </div>
          </div>

          {/* Prize Pill */}
          <div className="flex justify-center">
            <div 
              className="h-8 px-3 py-3.5 rounded-2xl  flex items-center gap-px"
              style={{
                background: 'radial-gradient(458.72% 228.94% at 57.65% 24.39%, #444CE7 0%, #B83EFF 30.5%, #E58C4C 60.5%, #444CE7 93.5%), linear-gradient(116deg, #FFF -56.16%, #0078D2 28.08%, #8E4FF8 80.58%)',
                boxShadow: '0px 5px 22px 0px rgba(207, 62, 255, 0.34)'
              }}
            >
              <span className="text-neutral-50 text-base">Prize:</span>
              <div className="flex items-center gap-0.5">
                <img src="/src/assets/icons/star.svg" className="w-6 h-6" alt="star" />
                <span className="text-neutral-50 text-base">{gameData?.prizePool || 110}</span>
              </div>
            </div>
          </div>

          {/* Players List */}
          <div className="flex-1 py-6 flex flex-col gap-2">
            <div className="px-2.5 py-2 bg-blue-600 rounded-[37px] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">TG</span>
                </div>
                <span className="text-neutral-50 text-sm">YOU</span>
              </div>
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                <span className="text-neutral-50 text-sm">20 ballz</span>
              </div>
            </div>
            {gameData?.players.filter(p => !p.isYou).slice(0, 3).map((player, index) => (
              <div key={player.id} className="px-2.5 py-2 bg-white/5 rounded-[37px] flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">TG</span>
                  </div>
                  <span className="text-neutral-50 text-sm">{player.name}</span>
                </div>
                <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                  <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                  <span className="text-neutral-50 text-sm">{player.ballz} ballz</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Purchase Options */}
      <div className="px-6 flex flex-col gap-2.5">
        <div className="self-stretch h-24 inline-flex justify-center items-start gap-2.5">
          <div className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">1</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">30</div>
            </div>
          </div>
          <div className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">3</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">90</div>
            </div>
          </div>
          <div className="h-16 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-16 min-h-16 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[32px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex flex-col items-center justify-center gap-0">
              <div className="text-neutral-700 text-3xl font-black">5</div>
              <div className="text-neutral-700 text-[10px] font-black uppercase -mt-1">balls</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">150</div>
            </div>
          </div>
          <div className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">10</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">300</div>
            </div>
          </div>
          <div className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-green-400 to-green-700 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] flex items-center justify-center">
              <div className="text-white text-xl font-black">X2</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/thick_disc.svg" className="w-3 h-3" alt="thick_disc" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">X2</div>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Info */}
      <div className="px-6 flex flex-col gap-2.5">
        <div className="px-14 py-2.5 bg-black/30 rounded-[243px] flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-medium">You have</span>
            <div className="flex items-center gap-0.5">
              <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
              <span className="text-neutral-50 text-xs">500<span className="text-neutral-50/50"> ballz</span></span>
            </div>
          </div>
          <div className="flex items-center gap-px">
            <span className="text-white text-xs font-medium">1 ballz = 30</span>
            <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
          </div>
        </div>
      </div>
    </div>
  )
}