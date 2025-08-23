import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { PlayerItem } from "@/components/game/PlayerItem"
import { ProgressChip } from "@/components/game/ProgressChip"
import { TimerChip } from "@/components/game/TimerChip"
import { ConnectionStatus } from "@/components/game/ConnectionStatus"
import { Cable, RotateCcw, Smile, Clock, Wifi, WifiOff } from "lucide-react"
import { useLiveTimer } from "@/hooks/useLiveTimer"
import { useGames } from "@/hooks/useWebSocket"
import { api } from "@/services/api"
import { GameState } from "@/types/api"
import type { GameDetailResponse } from "@/types/api"
import { useTelegram } from "@/hooks/useTelegram"

const quickActions = ["210", "5", "10", "X2"]

export function PvPScreen() {
  const navigate = useNavigate()
  const { user, webApp, getUserDisplayName, showAlert, hapticFeedback } = useTelegram()
  
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const { games, isConnected } = useGames()

  // Function to get UTC time
  const getUTCTime = () => {
    const now = new Date();
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    );
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getUTCTime())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const getElapsedSeconds = (game: GameDetailResponse) => {
    if (!game.start_wait_play) return 0;
    // Add 'Z' to indicate UTC time
    const startTime = new Date(game.start_wait_play + 'Z').getTime();
    const currentUTCTime = getUTCTime();
    return Math.max(0, Math.floor((currentUTCTime - startTime) / 1000));
  };

  // Function to handle LIVE game transition
  const handleLiveGame = (game: GameDetailResponse) => {
    const elapsedSeconds = getElapsedSeconds(game);
    const speedUpTime = Math.max(0, elapsedSeconds);
    console.log(elapsedSeconds)
    navigate('/game', { 
      state: {
        game_id: game.game_id,
        seed: game.seed,
        mapId: game.map_id,
        participants: game.participants,
        prize: game.total_price,
        total_balls: game.total_balls,
        fullGame: game,
        autoStart: true,
        speedUpTime: speedUpTime,
        music_content: game.music_content,
        music_title: game.music_title
      }
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Exclude PLAY games from selection
        const availableGames = games.filter(g => g.status !== GameState.PLAY);
        
        // Select first available game by default
        if (availableGames.length > 0 && !selectedGame) {
          setSelectedGame(availableGames[0])
        }

        // Sync selected game with latest data
        if (selectedGame) {
          const updatedGame = games.find(g => g.seed === selectedGame.seed)
          if (updatedGame && updatedGame !== selectedGame) {
            // If game moved to PLAY status, check if user is participant and redirect
            if (updatedGame.status === GameState.PLAY) {
              const isUserParticipant = updatedGame.participants.some((p: any) => {
                const participantUser = p.user ? p.user : p
                return participantUser.id === user.id
              })
              
              if (isUserParticipant) {
                handleLiveGame(updatedGame)
                return
              }
              
              const newSelected = availableGames[0] || null;
              setSelectedGame(newSelected);
            } else {
              setSelectedGame(updatedGame)
            }
          }
        }
        
        // Check all games for user participation in newly started games
        games.forEach(game => {
          if (game.status === GameState.PLAY) {
            const isUserParticipant = game.participants.some((p: any) => {
              const participantUser = p.user ? p.user : p
              return participantUser.id === user.id
            })
            
            if (isUserParticipant && (!selectedGame || selectedGame.seed !== game.seed)) {
              handleLiveGame(game)
            }
          }
        })
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [games, selectedGame])

  const handleStartGame = async () => {
    try {
      if (selectedGame?.status === GameState.PLAY) {
        const fresh = games.find(g => g.seed === selectedGame.seed) || selectedGame;
        navigate('/game', { state: {
          game_id: fresh.game_id,
          seed: fresh.seed,
          mapId: fresh.map_id,
          participants: fresh.participants,
          prize: fresh.total_price,
          total_balls: fresh.total_balls,
          fullGame: fresh,
          autoStart: true,
          music_content: fresh.music_content,
          music_title: fresh.music_title
        }})
      }
    } catch (error) {
      console.error('Failed to start game:', error)
    }
  }

  const handleConnect = () => {
    webApp.openLink('https://t.me/wallet')
    hapticFeedback('light')
  }

  const handleBuyBallz = async (countBalls: number) => {
    if (!selectedGame || !user) return
    
    try {
      const result = await api.buyBalls(
      
        user.id,
        countBalls,
        webApp.initData,
        selectedGame.game_id
      )
      
      webApp.openInvoice(result.invoiceLink)
      hapticFeedback('light')
    } catch (error) {
      console.error('Failed to buy balls:', error)
      showAlert('Failed to create payment!')
      hapticFeedback('heavy')
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
              {games.map((game) => {
                const isWaitPlayers = game.status === GameState.WAIT_PLAYERS;
                const isWaitPlay = game.status === GameState.WAIT_PLAY;
                const isPlay = game.status === GameState.PLAY;
                const isSelected = selectedGame?.seed === game.seed && !isPlay;
                
                // LIVE games get special treatment
                if (isPlay) {
                  return (
                    <div 
                      key={game.seed} 
                      onClick={() => handleLiveGame(game)}
                      className="h-8 px-3 py-2 rounded-[20px] flex items-center gap-2 relative overflow-hidden flex-shrink-0 cursor-pointer bg-red-500"
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      
                      <div className="flex items-center gap-1.5 relative z-10">         
                        <span className="text-white text-base font-semibold">LIVE</span>
                        <Smile className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-1 relative z-10">
                        <span className="text-white/80 text-base font-semibold">{game.participants.length}</span>
                      </div>
                    </div>
                  );
                }
                
                // Waiting games
                return (
                  <div 
                    key={game.seed} 
                    onClick={() => setSelectedGame(game)}
                    className={`h-8 px-3 py-2 rounded-[20px] flex items-center gap-2 relative overflow-hidden flex-shrink-0 cursor-pointer ${
                      isSelected ? 'bg-gray-600' : 'bg-gray-500'
                    }`}
                  >
                    {/* Progress bar for WAIT_PLAY */}
                    {isWaitPlay && (
                      <div 
                        className="absolute inset-0 bg-white/20 transition-all duration-1000 ease-out"
                        style={{
                          width: `${Math.min(100, (getElapsedSeconds(game) / 30) * 100)}%`,
                        }}
                      />
                    )}
                    
                    <div className="flex items-center gap-1.5 relative z-10">         
                      <span className="text-white text-base font-semibold">WAIT</span>
                      <Smile className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1 relative z-10">
                      <span className="text-white/80 text-base font-semibold">{game.participants.length}</span>
                    </div>
                  </div>
                );
              })}
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
        <div className="relative flex-1 p-2.5 bg-zinc-900/60 rounded-tl-[20px] rounded-bl-[20px] rounded-br-[20px] flex flex-col gap-5">          
          {/* Game Info Row */}
          <div className="flex justify-between items-start">
            <div className="h-8 px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
              <span className="text-white text-base">GAME #{selectedGame?.game_id || '-----'}</span>
              <div className={`w-2 h-2 rounded-full ${
                selectedGame?.status === GameState.PLAY ? 'bg-green-500' :
                selectedGame?.status === GameState.WAIT_PLAYERS || selectedGame?.status === GameState.WAIT_PLAY ? 'bg-yellow-500' : 'bg-gray-500'
              }`} />
            </div>
            <div className="flex items-center gap-2">
              {/* Timer only for WAIT_PLAY */}
              {selectedGame?.status === GameState.WAIT_PLAY && (
                <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-neutral-50 text-sm">{getElapsedSeconds(selectedGame)}s</span>
                </div>
              )}
              <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                <span className="text-neutral-50 text-sm">{selectedGame?.total_balls || 0}<span className="text-neutral-50/40">/300</span></span>
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
                <span className="text-neutral-50 text-base">{selectedGame?.total_price || 0}</span>
              </div>
            </div>
          </div>

          {/* Players List */}
          <div className="flex-1 py-6 flex flex-col gap-2">
            {selectedGame?.participants.length ? (
              selectedGame.participants.map((participantItem: any, index) => {
                // Normalize participant shape: some payloads have { user: { id, username, avatar, balls_count } }
                const participantUser = participantItem.user ? participantItem.user : participantItem
                const avatar = participantUser.avatar || participantUser.avatar_url
                const pid = participantUser.id
                const username = participantUser.username || `User${pid}`
                const ballsCount = participantItem.balls_count ?? participantUser.balls_count ?? 0

                return (
                  <div key={pid} className={`px-2.5 py-2 rounded-[37px] flex justify-between items-center ${
                    user.id === participantUser.id ? 'bg-blue-600' : 'bg-white/5'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {avatar ? (
                        <img 
                          src={avatar} 
                          className="w-7 h-7 rounded-full object-cover" 
                          alt="avatar" 
                        />
                      ) : (
                        <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">TG</span>
                        </div>
                      )}
                      <span className="text-neutral-50 text-sm">{username}</span>
                    </div>
                    <div className="px-3 py-2 bg-zinc-800 rounded-[20px] flex items-center gap-2">
                      <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                      <span className="text-neutral-50 text-sm">{ballsCount} ballz</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-neutral-400 text-sm">Waiting for players...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Options */}
      <div className="px-6 flex flex-col gap-2.5">
        <div className="self-stretch h-24 inline-flex justify-center items-start gap-2.5">
          <button onClick={() => handleBuyBallz(1)} className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">1</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">30</div>
            </div>
          </button>
          <button onClick={() => handleBuyBallz(3)} className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">3</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">90</div>
            </div>
          </button>
          <button onClick={() => handleBuyBallz(5)} className="h-16 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-16 min-h-16 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[32px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex flex-col items-center justify-center gap-0">
              <div className="text-neutral-700 text-3xl font-black">5</div>
              <div className="text-neutral-700 text-[10px] font-black uppercase -mt-1">balls</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">150</div>
            </div>
          </button>
          <button onClick={() => handleBuyBallz(10)} className="min-h-14 inline-flex flex-col justify-start items-center gap-1.5">
            <div className="w-14 min-h-14 bg-gradient-to-b from-amber-300 to-yellow-600 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] outline outline-2 outline-offset-[-2px] outline-white/40 flex items-center justify-center">
              <div className="text-neutral-700 text-xl font-black">10</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-3 h-3" alt="star" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">300</div>
            </div>
          </button>
          <button
            onClick={() => {
              if (!selectedGame || !user) return

              // Find participant in selected game
              const participant = selectedGame.participants.find((p: any) => {
                const participantUser = p.user ? p.user : p
                return participantUser.id === user.id
              })
              const currentBalls = participant ? participant?.user? (participant?.user.balls_count ?? 0) : (participant.balls_count ?? 0) : 0

              if (currentBalls <= 0) return

              handleBuyBallz(currentBalls * 2)
            }}
            className={`min-h-14 inline-flex flex-col justify-start items-center gap-1.5 ${!selectedGame || !selectedGame.participants.some((p: any) => (p.user ? p.user : p).id === user.id) ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <div className="w-14 min-h-14 bg-gradient-to-b from-green-400 to-green-700 rounded-[28px] shadow-[inset_6px_9px_8.800000190734863px_0px_rgba(255,255,255,0.25)] flex items-center justify-center">
              <div className="text-white text-xl font-black">X2</div>
            </div>
            <div className="inline-flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/thick_disc.svg" className="w-3 h-3" alt="thick_disc" />
              <div className="text-center justify-center text-neutral-600 text-xs font-black leading-snug">X2</div>
            </div>
          </button>
        </div>
      </div>

      {/* Balance Info */}
      <div className="px-6 flex flex-col gap-2.5">
        <div className="px-14 py-2.5 bg-black/30 rounded-[243px] flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-px">
            <span className="text-white text-xs font-medium">1 ballz = 30</span>
            <img src="/src/assets/icons/star.svg" className="w-3.5 h-3.5" alt="star" />
          </div>
        </div>
      </div>
    </div>
  )
}