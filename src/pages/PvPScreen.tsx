import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { ProgressChip } from "@/components/game/ProgressChip"
import { TimerChip } from "@/components/game/TimerChip"
import { Cable, RotateCcw } from "lucide-react"
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
    <div className="min-h-screen bg-background pb-20">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-5 relative">
        {/* Live Timer Overlay */}
        {isLiveActive && (
          <div 
            className="absolute inset-0 bg-white/10 rounded-lg mx-2"
            style={{
              opacity: timeLeft / 30 * 0.3
            }}
          />
        )}
        
        <div className="flex items-center gap-2 relative z-10">
          {isLiveActive && (
            <Chip variant="live" className="animate-pulse">
              LIVE {timeLeft}s
            </Chip>
          )}
          <Chip variant="gray" className="text-text-secondary">24</Chip>
        </div>
        
        {isLiveActive && (
          <Chip variant="live" className="animate-pulse relative z-10">
            LIVE {timeLeft}s
          </Chip>
        )}
        
        <WaysButton 
          variant="connect" 
          className="flex items-center gap-1.5 relative z-10"
          onClick={handleConnect}
        >
          <Cable className="w-[14px] h-[14px]" />
          Connect
        </WaysButton>
      </div>

      {/* Game Card */}
      <div className="mx-4">
        <div className="game-card">
          {/* Status Row */}
          <div className="flex items-center justify-between mb-3">
            <Chip variant="gray">GAME #{gameData?.id}</Chip>
            <TimerChip seconds={gameData?.timeLeft || 15} />
            <ProgressChip current={gameData?.prizePool || 110} total={300} progress={36} />
          </div>

          {/* Prize Pill */}
          <div className="flex justify-center mb-3">
            <Chip variant="prize" icon="star">
              Prize: ⭐ {gameData?.prizePool || 110}
            </Chip>
          </div>

          {/* Players List */}
          <div className="space-y-0">
            {gameData?.players.map((player, index) => (
              <React.Fragment key={player.id}>
                <PlayerItem
                  name={player.name}
                  ballz={player.ballz}
                  isYou={player.isYou}
                />
                {index < (gameData?.players.length || 0) - 1 && (
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
            <WaysButton 
              variant="primary" 
              className="w-full"
              onClick={handleBuyBallz}
              disabled={!activeAction}
            >
              Buy Ballz – {activeAction || '210'} | ⭐ {((parseInt(activeAction || '210')) * 30).toLocaleString()}
            </WaysButton>

            {/* Balance Info */}
            <div className="text-center">
              <span className="micro text-text-secondary">
                You have ⭐ {userStats?.balance || 500} ballz | 1 ballz = ⭐ 30
              </span>
            </div>
          </div>
          
          {/* Start Game Button */}
          {isLiveActive && (
            <div className="mt-4">
              <WaysButton 
                variant="primary" 
                className="w-full bg-accent-red hover:bg-accent-red/90"
                onClick={handleStartGame}
              >
                START GAME ({timeLeft}s)
              </WaysButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}