import React, { useState, useEffect } from "react"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { CircularTimer } from "@/components/game/TimerChip"
import { Trophy, Volume2, VolumeX, X } from "lucide-react"

interface GameScreenProps {
  onClose: () => void
}

export function GameScreen({ onClose }: GameScreenProps) {
  const [timeLeft, setTimeLeft] = useState(56)
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Game Background Gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(44,64,92,0.25) 0%, rgba(0,0,0,1) 50%)'
        }}
      />

      {/* Top Status Bar */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-2.5">
        <Chip variant="prize" icon="star">
          Prize: ⭐ 110
        </Chip>
        
        <CircularTimer seconds={timeLeft} totalSeconds={60} />
        
        <div className="flex items-center gap-2">
          <span className="caption text-text-secondary">GAME #23245</span>
          <WaysButton variant="close" onClick={onClose} className="flex items-center gap-1">
            <X className="w-3 h-3" />
            Close
          </WaysButton>
        </div>
      </div>

      {/* Game Field */}
      <div className="relative mt-8 h-[500px] mx-4">
        {/* Glowing Barriers */}
        <div className="absolute top-0 left-0 right-0 h-16">
          <svg className="w-full h-full" viewBox="0 0 390 64">
            <path
              d="M 50 50 Q 195 10 340 50"
              stroke="hsl(var(--accent-cyan))"
              strokeWidth="6"
              fill="none"
              className="drop-shadow-[0_0_12px_hsl(var(--accent-cyan))]"
            />
          </svg>
        </div>

        {/* Game Balls */}
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
          <div 
            className="w-4 h-4 rounded-full bg-white/90 border-2 border-accent-yellow animate-bounce"
            style={{
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.5), inset 2px 2px 4px rgba(255, 255, 255, 0.3)'
            }}
          />
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-text-secondary" />
          </div>
        </div>

        {/* Additional balls scattered */}
        <div className="absolute top-32 left-16">
          <div className="w-4 h-4 rounded-full bg-white/80 border border-white/20" />
        </div>
        <div className="absolute top-28 right-20">
          <div className="w-4 h-4 rounded-full bg-white/80 border border-white/20" />
        </div>
        <div className="absolute top-40 left-1/3">
          <div className="w-4 h-4 rounded-full bg-white/80 border border-white/20" />
        </div>

        {/* Block Wall */}
        <div className="absolute bottom-16 left-0 right-0">
          <div className="grid grid-cols-12 gap-1 px-4">
            {/* First row - Pink */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`row1-${i}`}
                className="h-2.5 rounded-sm"
                style={{ backgroundColor: '#E46C7A' }}
              />
            ))}
            {/* Second row - Peach */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`row2-${i}`}
                className="h-2.5 rounded-sm"
                style={{ backgroundColor: '#EAA36C' }}
              />
            ))}
            {/* Third row - Ochre */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`row3-${i}`}
                className="h-2.5 rounded-sm"
                style={{ backgroundColor: '#C67E40' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-0 right-0 px-4">
        <div className="flex items-center justify-between">
          <WaysButton variant="close" className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            Leader
          </WaysButton>
          
          <WaysButton
            variant="round"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-9 h-9"
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
  )
}