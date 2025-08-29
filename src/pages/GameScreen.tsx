import React, { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { CircularTimer } from "@/components/game/TimerChip"
import { GameResultModal } from "@/components/modals/GameResultModal"
import { GameCanvas } from "@/components/GameCanvas"
import { GameCanvasHidden } from "@/components/GameCanvasHidden"
import {GameCanvasRef} from "@/types/components"
import { Trophy, Volume2, VolumeX, X, Star, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "@/services/api"
import { useTelegram } from "@/hooks/useTelegram"
import { TabBar } from "@/components/navigation/TabBar"
import { starIcon, discIcon } from "@/assets/icons"

export function GameScreen() {
  const navigate = useNavigate()
  const { webApp, shareGameStory, user } = useTelegram()
  const gameCanvasRef = useRef<GameCanvasRef>(null)
  const hiddenCanvasRef = useRef<GameCanvasRef>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [gameModal, setGameModal] = useState<"win" | "lose" | null>(null)
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'lose'; prize?: number } | null>(null)
  const [winnerInfo, setWinnerInfo] = useState<{ name?: string; avatar?: string } | null>(null)
  const [isReplay, setIsReplay] = useState(false)
  // gameData holds meta (prize, total_balls, game_id)
  const [gameStarted, setGameStarted] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownText, setCountdownText] = useState('3')
  const [speedUpTime, setSpeedUpTime] = useState(0)
  const [cameraMode, setCameraMode] = useState<'leader' | 'swipe'>('leader')
  const [scrollY, setScrollY] = useState(0)
  const [maxScrollY, setMaxScrollY] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartScrollY = useRef(0)
  const [gameData, setGameData] = useState({ game_id: 0, seed: "", mapId: 0, participants: [], prize: 0, total_balls: 0, music_content: "", music_title: "", winner_id: 0 })
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [predictedBallId, setPredictedBallId] = useState<string | null>(null)
  const [predictedWinnerUserId, setPredictedWinnerUserId] = useState<string | null>(null)

  // Enable to use local mock instead of navigation state
  const USE_MOCK = false; // set to false to disable quickly

 // ref to keep latest gameData accessible to callbacks
const gameDataRef = useRef<typeof gameData>(gameData);

useEffect(() => {
  gameDataRef.current = gameData;
}, [gameData]);

// ref to defer autoStart until gameData is applied; store pending payload
const autoStartPendingRef = useRef<any | null>(null);
    useEffect(() => {
    if (gameData.winner_id) {
      setWinnerId(gameData.winner_id.toString())
    }
  }, [gameData])

  const handleClose = () => {
    try {
      gameCanvasRef.current?.destroyCanvas?.();
    } catch (e) {}
    // small delay to ensure canvas cleanup runs before navigation
    setTimeout(() => navigate(isReplay ? '/history' : '/'), 50);
  }

  const handlePlayAgain = () => {
    try {
      gameCanvasRef.current?.destroyCanvas?.();
    } catch (e) {}
    setTimeout(() => navigate('/'), 50);
  }

  const handleShare = async () => {
    if (gameResult) {
      await shareGameStory(gameResult.result === 'win')
    }
  }

  const handleGameStart = () => {
    setGameStarted(true)
    if (gameCanvasRef.current && cameraMode === 'swipe') {
      const gameSize = gameCanvasRef.current.getGameSize()
      const containerHeight = window.innerHeight - 80
      const scale = window.innerWidth / 1200 // Исправлено с 1000 на 1200
      const scaledHeight = gameSize.height * scale
      setMaxScrollY( 4000)
    }
  }


  const handleBallWin = async (ballId: string, playerId: string) => {
    const localUserId = user ? user.id : null
    const isLocalUserWinner = localUserId !== null && +playerId === localUserId

    try {
      const currentGameData = gameDataRef.current;
      if (currentGameData && currentGameData.game_id) {
        try {
            await api.updateGameState(currentGameData.game_id, 'finish' )
        } catch (e) {
          console.warn('Failed to finish', e)
        }
      }

      // fetch winner profile for display (works for both win and lose)
      let winnerName: string | undefined
      let winnerAvatar: string | undefined
      try {
        const profile = await api.getUserProfile(+playerId)
        winnerName = profile.username || `User${profile.id}`
        winnerAvatar = profile.avatar_url
      } catch (e) {
        console.warn('Failed to fetch winner profile', e)
        winnerName = `User${playerId}`
      }

      setWinnerInfo({ name: winnerName, avatar: winnerAvatar })

      // compute prize from latest available data (prefer ref)
      const prize = (currentGameData && (currentGameData as any).prize) ?? gameData.prize ?? 0

      // Show win modal only if the winner is the current Telegram user
      if (isLocalUserWinner) {
        setGameResult({ result: 'win', prize })
        setGameModal('win')
      } else {
        setGameResult({ result: 'lose', prize })
        setGameModal('lose')
      }
    } catch (err) {
      console.error('Failed to update winner or fetch info', err)
      // Fallback: show lose modal unless the winner matches local user
      setWinnerInfo({ name: `User${playerId}` })
      if (isLocalUserWinner) {
        setGameResult({ result: 'win' })
        setGameModal('win')
      } else {
        setGameResult({ result: 'lose' })
        setGameModal('lose')
      }
    }
  }


  const startGame = (dataFromState?: { seed: string; mapId: number[] | number; participants: any[]; winner_id: number }) => {
    const countdownDuration = 4;
    
    const currentRoundGameData = dataFromState || gameData;

    if (speedUpTime >= countdownDuration) {
      handleGameStart();
      gameCanvasRef.current?.startGame(currentRoundGameData);
    } else {
      setShowCountdown(true);
      
      const remainingCountdown = countdownDuration - speedUpTime - 1;
      let count = Math.max(1, remainingCountdown);
      
      const countdown = () => {
        if (count > 0) {
          setCountdownText(count.toString());
          // start hidden simulation at first tick only once
          if (count === Math.max(1, remainingCountdown)) {
            console.log('[COUNTDOWN] start hidden sim, remainingCountdown=', remainingCountdown);
            // clear previous prediction
            setPredictedBallId(null);
            setPredictedWinnerUserId(null);
            // run hidden canvas fast-forward 100s
            // it will call onPredictedWinner and we will store it, then destroy it on completion
          }
          count--;
          setTimeout(countdown, 1000);
        } else {
          setCountdownText("LET'S GO!");
          setTimeout(() => {
            setShowCountdown(false);
            console.log('[START MAIN] predictedBallId=', predictedBallId, 'desiredWinnerUserId=', gameDataRef.current.winner_id);
            gameCanvasRef.current?.startGame({
              ...currentRoundGameData,
              // pass prediction to main canvas so it can swap owners deterministically
              predictedWinningBallId: predictedBallId || undefined,
              desiredWinnerUserId: (gameDataRef.current.winner_id || 0) ? String(gameDataRef.current.winner_id) : undefined,
            } as any);
          }, 1000);
        }
      };
      countdown();
    }
  };

  // If navigated with state (from PvPScreen dev button), apply it and auto-start
  const location = useLocation()
  useEffect(() => {
    // Build mock data if enabled
    if (USE_MOCK) {
      const mockPlayers = [
        { id: 1, username: 'Alice', avatar_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/%D0%92%D0%BB%D0%B0%D0%B4%D0%B8%D0%BC%D0%B8%D1%80_%D0%9F%D1%83%D1%82%D0%B8%D0%BD_%2808-03-2024%29_%28cropped%29_%28higher_res%29.jpg/330px-%D0%92%D0%BB%D0%B0%D0%B4%D0%B8%D0%BC%D0%B8%D1%80_%D0%9F%D1%83%D1%82%D0%B8%D0%BD_%2808-03-2024%29_%28cropped%29_%28higher_res%29.jpg`, balls_count: 5 },
        { id: 2, username: 'Bob',   avatar_url: `https://cdn.forbes.ru/files/c/320x320/forbes_import/pg/pg_putin-main.jpg`, balls_count: 25 },
        { id: 3, username: 'Carol', avatar_url: `https://expert.ru/upload/resize_cache/iblock/96d/780_398_240cd750bba9870f18aada2478b24840a/8sdnhv09r7xifqvb8wtt6blviff9c3ba.jpg`, balls_count: 10 },
        { id: 4, username: 'Dave',  avatar_url: `https://cdn-storage-media.tass.ru/resize/752x496/tass_media/2025/02/20/y/1740062732667871_yGJMr6lS.jpg`, balls_count: 10 },
      ];
      const mock = {
        game_id: 9999,
        seed: `asdhkjasdkjas`,
        mapId: 1,
        participants: mockPlayers,
        prize: 12345,
        total_balls: mockPlayers.reduce((a, p) => a + (p.balls_count||0), 0), // 50
        music_content: '',
        music_title: 'mock',
        winner_id: 3, // second player should win
      };
      console.log('[MOCK] Using mock gameData', mock);
      setGameData(mock as any);
      setSpeedUpTime(0);
      setIsReplay(false);
      autoStartPendingRef.current = mock;
      setPredictedBallId(null);
      setPredictedWinnerUserId(null);
      return;
    }

    const state: any = (location && (location as any).state) || null
    if (state) {
      // support two shapes: fullGame passed or flat state
      const payload = state.fullGame || state;
      const nextGameData = {
        game_id: payload.game_id ?? payload.gameId ?? 0,
        seed: payload.seed || state.seed || "",
        mapId: payload.map_id ?? payload.mapId ?? state.mapId ?? 0,
        participants: payload.participants || state.participants || [],
        prize: payload.total_price ?? payload.total_price ?? payload.prize ?? state.prize ?? 0,
        total_balls: payload.total_balls ?? payload.totalBalls ?? state.total_balls ?? 0,
        music_content: payload.music_content || state.music_content || "",
        music_title: payload.music_title || state.music_title || "",
        winner_id: payload.winner_id || state.winner_id || 0

      };
      setGameData(nextGameData as any);
      // Set speedUpTime if passed
      if (state.speedUpTime) {
        setSpeedUpTime(state.speedUpTime);
      }
      
      // Set replay mode
      if (state.isReplay) {
        setIsReplay(true);
      }
      
      if (state.autoStart) {
        autoStartPendingRef.current = nextGameData;
      }
      // keep predicted winner empty when a new state comes
      setPredictedBallId(null);
      setPredictedWinnerUserId(null);
    }
  }, [location.state])

  // trigger auto-start after gameData has been applied
  useEffect(() => {
    const pending = autoStartPendingRef.current;
    if (pending && gameData && (gameData.seed || gameData.game_id)) {
      // start with the fully-initialized data object we stored
      startGame(pending);
      autoStartPendingRef.current = null;
    }
  }, [gameData]);

  // Функция для переключения режима камеры
  const toggleCameraMode = () => {
    const newMode = cameraMode === 'leader' ? 'swipe' : 'leader'
    setCameraMode(newMode)
    
    // Передаем новый режим в GameCanvas
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setCameraMode(newMode)

      
      if (newMode === 'swipe') {
        setMaxScrollY( 4000)
      }
    }
  } 
  

  const handleScrollUp = () => {
    const newY = Math.max(0, scrollY - 200)
    setScrollY(newY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(newY)
    }
  }

  const handleScrollDown = () => {
    const newY = Math.min(maxScrollY, scrollY + 200)
    setScrollY(newY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(newY)
    }
  }

  const handleScroll = (newY: number) => {
    const clampedY = Math.max(0, Math.min(maxScrollY, newY))
    setScrollY(clampedY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(clampedY)
    }
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    if (cameraMode === 'swipe') {
      e.preventDefault();
      handleScroll(scrollY + e.deltaY);
    }
  }, [cameraMode, scrollY, maxScrollY]);

  useEffect(() => {
    const element = document.querySelector('.game-container');
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
      return () => element.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // when countdown shows, launch hidden canvas simulation (opacity 0)
  useEffect(() => {
    if (!showCountdown) return;
    const currentRoundGameData: any = gameDataRef.current;
    // kick off hidden sim after a small delay to align with first tick
    const t = setTimeout(() => {
      try {
        console.log('[HIDDEN START] seed=', currentRoundGameData.seed, 'mapId=', currentRoundGameData.mapId, 'participants=', currentRoundGameData.participants?.length);
        hiddenCanvasRef.current?.startGame({
          seed: currentRoundGameData.seed,
          mapId: currentRoundGameData.mapId,
          participants: currentRoundGameData.participants,
        } as any);
      } catch (e) { console.warn('[HIDDEN START ERR]', e); }
    }, 50);
    return () => clearTimeout(t);
  }, [showCountdown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe') {
      setTouchStartY(e.touches[0].clientY);
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe' && touchStartY !== 0) {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      handleScroll(scrollY + deltaY);
      setTouchStartY(touchY);
    }
  }

  const handleTouchEnd = () => {
    setTouchStartY(0);
  }

  const handleScrollbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartScrollY.current = scrollY
  }

  const handleScrollbarTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
    dragStartScrollY.current = scrollY
  }

  const handleScrollbarMove = useCallback((clientY: number) => {
    if (!isDragging) return
    const track = document.querySelector('.scrollbar-track') as HTMLElement
    if (!track) return
    const trackRect = track.getBoundingClientRect()
    const clickPosition = clientY - trackRect.top
    const trackHeight = trackRect.height
    const scrollPercentage = clickPosition / trackHeight
    const newScrollY = scrollPercentage * maxScrollY
    handleScroll(newScrollY)
  }, [isDragging, maxScrollY])

  const handleScrollbarMoveMouse = useCallback((e: MouseEvent) => {
    e.preventDefault()
    handleScrollbarMove(e.clientY)
  }, [handleScrollbarMove])

  const handleScrollbarMoveTouch = useCallback((e: TouchEvent) => {
    handleScrollbarMove(e.touches[0].clientY)
  }, [handleScrollbarMove])

  const handleScrollbarEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleScrollbarMoveMouse)
      document.addEventListener('mouseup', handleScrollbarEnd)
      document.addEventListener('touchmove', handleScrollbarMoveTouch)
      document.addEventListener('touchend', handleScrollbarEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleScrollbarMoveMouse)
        document.removeEventListener('mouseup', handleScrollbarEnd)
        document.removeEventListener('touchmove', handleScrollbarMoveTouch)
        document.removeEventListener('touchend', handleScrollbarEnd)
      }
    }
  }, [isDragging, handleScrollbarMoveMouse, handleScrollbarMoveTouch, handleScrollbarEnd])


  // Treat modal as replay if it's actual replay or viewer didn't participate
  const isUserInGame = !!user && Array.isArray(gameData?.participants) && gameData.participants.some((p: any) => {
    const uid = p?.user?.id ?? p?.id;
    return Number(uid) === Number(user.id);
  });

  return (
    <div 
      className="min-h-screen bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Hidden pre-sim canvas during countdown (opacity: 0) */}
      {showCountdown && (
        <GameCanvasHidden
          ref={hiddenCanvasRef}
          className="absolute inset-0 w-full h-full"
          countdownFastForwardSeconds={100}
          data={{ seed: gameData.seed, mapId: gameData.mapId, participants: gameData.participants }}
          onPredictedWinner={(ballId, playerId) => {
            console.log('[HIDDEN FINISHED] predicted winner ballId=', ballId, 'playerId=', playerId);
            setPredictedBallId(ballId);
            setPredictedWinnerUserId(String(playerId));
            try { hiddenCanvasRef.current?.destroyCanvas?.(); } catch (e) {}
          }}
        />
      )}

      {/* Game Canvas - Full Screen */}
      <div 
        className="game-container absolute inset-0 w-full h-full overflow-hidden"
        style={{ display: showCountdown ? 'none' : 'block' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <GameCanvas
          ref={gameCanvasRef}
          onBallWin={handleBallWin}
          onGameStart={handleGameStart}
          className="absolute inset-0 w-full h-full"
          speedUpTime={speedUpTime - 4}
          initialCameraMode={cameraMode}
          scrollY={cameraMode === 'swipe' ? scrollY : 0}
          soundEnabled={soundEnabled}
          musicContent={gameData.music_content}
          predictedWinningBallId={predictedBallId || undefined}
          desiredWinnerUserId={(gameData.winner_id || 0) ? String(gameData.winner_id) : undefined}
        />
      </div>
      
      {/* Скроллбар */}
      {cameraMode === 'swipe' && maxScrollY > 0 && (
        <div 
          className="scrollbar-track absolute right-2 top-20 bottom-32 z-50 w-3 bg-gray-800/30 rounded-full cursor-pointer"
          onMouseDown={handleScrollbarMouseDown}
          onTouchStart={handleScrollbarTouchStart}
        >
          <div 
            className="scrollbar-thumb absolute w-full bg-yellow-500 rounded-full transition-all duration-200 hover:bg-yellow-400"
            style={{ 
              height: `${Math.max(20, (window.innerHeight - 52) / maxScrollY * 100)}%`,
              top: `${(scrollY / maxScrollY) * 100}%`
            }}
          />
        </div>
      )}
      
      
      
      
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40">
          <div className="text-center">
            <div className="text-8xl font-black text-transparent bg-gradient-to-b from-yellow-400 via-yellow-500 to-orange-600 bg-clip-text animate-pulse drop-shadow-2xl">
              {countdownText}
            </div>
            <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-orange-600 mx-auto mt-4 rounded-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Permanent Back Button for Replay */}
      {isReplay && (
        <button
          onClick={handleClose}
          className="absolute top-16 right-4 z-30 bg-zinc-800/80 backdrop-blur-sm rounded-[20px] px-3 py-2 flex items-center gap-2"
        >
          <span className="text-white text-sm">Back</span>
          <div className="w-5 h-5 bg-neutral-600 rounded-full flex items-center justify-center">
            <X className="w-3 h-3 text-white" />
          </div>
        </button>
      )}

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Chip variant="prize">
            <span className="text-base font-semibold">Prize: <img src={starIcon} className="w-5 h-5 inline mx-1" alt="star" /> 110</span>
          </Chip>
          
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">
            <div className="flex justify-start items-center gap-0.5">
              <img src={discIcon} className="w-4 h-4" alt="disc" />
              <div className="text-center text-neutral-50 text-sm leading-snug">{gameData?.total_balls ?? 0}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="caption text-text-secondary bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">GAME #{gameData?.game_id}</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-0 right-0 z-20">
        <div className=" flex items-center justify-between px-4 py-3">
          {/* Кнопка переключения режима камеры */}
          <WaysButton 
            variant="close" 
            className="h-10 flex items-center gap-1.5 bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-4 py-3"
            onClick={toggleCameraMode}
          >
            <Trophy className="w-4 h-4" />
            {cameraMode === 'leader' ? 'Leader' : 'Swipe'}
          </WaysButton>
          
          <div className="flex items-center gap-2">
            <WaysButton
              variant="round"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-12 h-10 bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-4 py-3"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-text-tertiary" />
              )}
            </WaysButton>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <TabBar />
      </div>

      {/* Game Result Modal */}
      {gameModal && gameResult && (
        <GameResultModal
          type={gameModal}
          prize={gameData.prize}
          onPlayAgain={handlePlayAgain}
          onShare={handleShare}
          onClose={handleClose}
          winnerName={winnerInfo?.name}
          winnerAvatar={winnerInfo?.avatar}
          musicTitle={gameData.music_title}
          isReplay={isReplay || !isUserInGame}
        />
      )}
    </div>
  )
}
