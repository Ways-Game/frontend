import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useTelegram } from "@/hooks/useTelegram"

interface GameResultModalProps {
  type: "win" | "lose"
  prize?: number
  onPlayAgain: () => void
  onShare: () => void
  onClose: () => void
  winnerName?: string
  winnerAvatar?: string
  musicTitle?: string
  isReplay?: boolean
}

export function GameResultModal({ type, prize, onPlayAgain, onShare, onClose, winnerName, winnerAvatar, musicTitle, isReplay }: GameResultModalProps) {
  const [countdown, setCountdown] = useState(20)
  const [shareError, setShareError] = useState<string | null>(null)
  const { user, shareGameStory } = useTelegram()

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [onClose])

  const isWin = type === "win"
  const isGolden = isReplay
  
  return (
    <div className="fixed inset-0 bg-black/60 flex flex-col justify-end items-center px-6 pb-10 z-50">
      {/* Close/Back Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-zinc-800 rounded-[20px] px-3 py-2 flex items-center gap-2"
      >
        <span className="text-white text-base">{isReplay ? "Back" : "Close"}</span>
        <div className="w-6 h-6 bg-neutral-600 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </div>
      </button>

      <div className="w-full max-w-96 flex flex-col gap-20">
        {/* Main Result Card */}
        <div className="px-3.5 py-4 bg-zinc-900/50 rounded-[20px] backdrop-blur-sm flex flex-col items-center gap-5">
          <div className="text-center text-neutral-50 text-xl leading-snug">
            {isReplay ? "Game Replay" : (isWin ? "Great! we play again?" : "Better luck next time...")}
          </div>
          
          {/* Winner Info */}
          <div className={`w-full px-2.5 py-2 font-black ${isGolden ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : (isWin ? 'bg-green-600 text-white' : ' bg-white/5 text-neutral-50')}  rounded-[37px] flex justify-between items-center`}>
            <div className="flex items-center gap-2.5">
              {winnerAvatar ? (
                <img src={winnerAvatar} className="w-7 h-7 rounded-full object-cover" alt="winner" />
              ) : (
                <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{isWin ? "Y" : "TG"}</span>
                </div>
              )}
              <span className=" text-sm">{isWin ? (winnerName || 'YOU') : (winnerName || '@unknown')}</span>
              <span className={`text-sm py-1 rounded `}>
                WIN!{isWin ? "!" : ""}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <img src="/src/assets/icons/star.svg" className="w-5 h-5" alt="star" />

              <span className="text-base">{`${isWin ? '+' : ''}${prize?.toLocaleString()}`}</span>
            </div>
          </div>
          
          {/* Game Info */}
          <div className="w-full flex justify-between items-center">
            <span className="text-zinc-500 text-xs">GAME #23245</span>
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-xs">{musicTitle || "Unknown track"}</span>
              <img src="/src/assets/icons/music.svg" className="w-4 h-4" alt="music" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-5">
          {!isReplay && (
            <button 
              onClick={onPlayAgain}
              className="w-full h-12 px-3 py-3.5 rounded-2xl text-white text-base font-semibold"
              style={{
                background: 'radial-gradient(458.72% 228.94% at 57.65% 24.39%, #444CE7 0%, #B83EFF 30.5%, #E58C4C 60.5%, #444CE7 93.5%), linear-gradient(116deg, #FFF -56.16%, #0078D2 28.08%, #8E4FF8 80.58%)',
                boxShadow: '0px 5px 22px 0px rgba(207, 62, 255, 0.34)'
              }}
            >
              Play again
            </button>
          )}
          
          <button 
            onClick={async () => {
              try {
                await shareGameStory(type === "win")
              } catch (error: any) {
                if (error.message?.includes('maximum number of stories')) {
                  setShareError('Достигнуто максимальное количество историй в день')
                } else {
                  setShareError('Ошибка при отправке истории')
                }
              }
            }}
            className="w-full h-12 px-3 py-3.5 bg-zinc-800 rounded-2xl flex items-center justify-center gap-2.5 text-white text-base font-semibold relative overflow-hidden"
            style={{
              backgroundImage: 'url(/src/assets/share_back.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <img src="/src/assets/icons/forward.svg" className="w-6 h-6" alt="forward" />
            Share results
          </button>
          
          <div className="px-3.5 pt-2.5 pb-0.5 bg-zinc-900/50 rounded-[20px] backdrop-blur-sm flex flex-col items-center">
            <div className="text-center">
              <span className="text-neutral-400 text-base">Share a story </span>
              <span className="text-white text-base">{user?.count_story_current_day || 0}</span>
              <span className="text-neutral-400 text-base">/3 times a day</span>
            </div>
            <div className="w-80 p-3 flex gap-2">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className={`flex-1 h-[3px] rounded-sm ${
                    i < (user?.count_story_current_day || 0) ? 'bg-blue-500' : 'bg-gray-600'
                  }`} 
                />
              ))}
            </div>
          </div>
          
          {shareError ? (
            <div className="w-64 text-center text-red-400 text-sm mx-auto">
              {shareError}
            </div>
          ) : (
            <div className="w-64 text-center text-neutral-50 text-sm mx-auto">
              You can share a story and get some stars back on your balance
            </div>
          )}
        </div>
      </div>
    </div>
  )
}