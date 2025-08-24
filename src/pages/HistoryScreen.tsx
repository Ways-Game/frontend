import React, { useState, useEffect } from "react"
import { Search, Play } from "lucide-react"
import { api } from "@/services/api"
import { useTelegram } from "@/hooks/useTelegram"
import type { GameDetailResponse } from "@/types/api"

type FilterType = 'time' | 'luckiest' | 'solo'

export function HistoryScreen() {
  const { user } = useTelegram()
  const [games, setGames] = useState<GameDetailResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('time')

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id) return
      
      try {
        const history = await api.getUserPvpHistory(user.id)
        setGames(history)
      } catch (error) {
        console.error('Failed to load history:', error)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [user?.id])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const getWinner = (game: GameDetailResponse) => {
    return game.participants.find(p => {
      const participant = p.user ? p.user : p
      return participant.id === game.winner_id
    })
  }

  const getUserBalls = (game: GameDetailResponse) => {
    const userParticipant = game.participants.find(p => {
      const participant = p.user ? p.user : p
      return participant.id === user.id
    })
    return userParticipant?.balls_count || 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-text-secondary">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-96 h-[746px] bg-black inline-flex flex-col justify-end items-start gap-2.5 overflow-hidden">
      <div className="self-stretch flex-1 p-2.5 flex flex-col justify-end items-start gap-2.5 overflow-hidden">
        {/* Search Input */}
        <div className="self-stretch flex flex-col justify-start items-start">
          <div className="self-stretch h-12 px-4 bg-zinc-800 rounded-xl inline-flex justify-start items-center gap-3 overflow-hidden">
            <div className="flex-1 flex justify-start items-center gap-1 flex-wrap content-center">
              <input
                type="text"
                placeholder="Search Game"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-neutral-400 text-base font-normal leading-snug outline-none placeholder-neutral-400"
              />
            </div>
            <Search className="w-6 h-6 text-neutral-400 opacity-50" />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="self-stretch inline-flex justify-start items-start gap-2.5">
          <button
            onClick={() => setActiveFilter('time')}
            className={`flex-1 h-9 px-3 py-3.5 rounded-lg flex justify-center items-center gap-2.5 overflow-hidden ${
              activeFilter === 'time'
                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 shadow-lg'
                : 'bg-zinc-800'
            }`}
          >
            <span className="text-neutral-50 text-sm leading-snug">⌛ By time</span>
          </button>
          <button
            onClick={() => setActiveFilter('luckiest')}
            className={`flex-1 px-3 py-3 rounded-lg flex justify-center items-center gap-2 overflow-hidden ${
              activeFilter === 'luckiest'
                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 shadow-lg'
                : 'bg-zinc-800'
            }`}
          >
            <span className="text-neutral-50 text-sm leading-snug">🍀 Luckiest</span>
          </button>
          <button
            onClick={() => setActiveFilter('solo')}
            className={`flex-1 px-3 py-3 rounded-lg flex justify-center items-center gap-2 overflow-hidden ${
              activeFilter === 'solo'
                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 shadow-lg'
                : 'bg-zinc-800'
            }`}
          >
            <span className="text-neutral-50 text-sm leading-snug">👤 Solo</span>
          </button>
        </div>

        {/* Games List */}
        <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5 overflow-y-auto">
          {games.length === 0 ? (
            <div className="self-stretch flex-1 flex items-center justify-center">
              <p className="text-neutral-400 text-sm">No games found</p>
            </div>
          ) : (
            games.map((game) => {
              const winner = getWinner(game)
              const userBalls = getUserBalls(game)
              const winnerUser = winner?.user ? winner.user : winner
              
              return (
                <div key={game.game_id} className="self-stretch px-3.5 py-4 bg-stone-950 rounded-[20px] backdrop-blur-sm flex flex-col justify-center items-center gap-5 overflow-hidden">
                  {/* Game Header */}
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="rounded-[20px] flex justify-center items-center gap-2">
                      <span className="text-zinc-500 text-xs leading-snug">GAME #{game.game_id}</span>
                    </div>
                    <div className="rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
                      <span className="text-zinc-500 text-xs leading-snug">
                        {game.created_at ? formatDate(game.created_at) : 'Unknown'} - {game.music_title || 'No music'}
                      </span>
                      <Play className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Winner Info */}
                  <div className="self-stretch rounded-[37px] inline-flex justify-between items-center overflow-hidden">
                    <div className="flex justify-start items-center gap-2.5">
                      {winnerUser?.avatar ? (
                        <img 
                          src={winnerUser.avatar} 
                          className="w-7 h-7 rounded-full object-cover" 
                          alt="avatar" 
                        />
                      ) : (
                        <div className="w-7 h-7 bg-zinc-300 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">TG</span>
                        </div>
                      )}
                      <span className="text-neutral-50 text-sm leading-snug">
                        @{winnerUser?.username || `User${winnerUser?.id}`}
                      </span>
                    </div>
                    <div className="flex justify-start items-center gap-0.5">
                      <img src="/src/assets/icons/star.svg" className="w-6 h-6" alt="star" />
                      <span className="text-neutral-50 text-base leading-snug">{game.total_price}</span>
                    </div>
                  </div>

                  {/* Game Stats */}
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="px-3 py-2 rounded-[20px] flex justify-center items-center gap-2 overflow-hidden">
                      <div className="flex justify-start items-center gap-0.5">
                        <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
                        <span className="text-neutral-50 text-sm leading-snug">{userBalls}</span>
                        <span className="text-neutral-50/40 text-sm leading-snug"> vs {game.total_balls}</span>
                      </div>
                    </div>
                    <button className="h-8 pl-3 pr-2 py-2 bg-zinc-800 rounded-xl flex justify-center items-center gap-2 overflow-hidden">
                      <span className="text-white text-base leading-snug">View replay</span>
                      <Play className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="w-96 px-14 py-3 bg-black border-t-2 border-zinc-800 inline-flex justify-center items-center gap-4 overflow-hidden">
        <div className="flex justify-start items-center gap-4">
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-medium">PvP</span>
          </div>
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-medium">Market</span>
          </div>
          <div className="w-16 h-14 inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gray-400 rounded" />
            <span className="text-gray-400 text-xs font-medium">Earn</span>
          </div>
          <div className="w-16 h-14 bg-zinc-800 rounded-3xl inline-flex flex-col justify-center items-center gap-2">
            <div className="w-6 h-6 bg-white rounded" />
            <span className="text-white text-xs font-bold">History</span>
          </div>
        </div>
      </div>
    </div>
  )
}