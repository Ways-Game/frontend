import { useEffect, useState } from 'react'
import { wsService } from '@/services/websocket'
import type { GameDetailResponse } from '@/types/api'

export function useGames() {
  const [games, setGames] = useState<GameDetailResponse[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const unsubscribe = wsService.subscribe('games_list', (data: GameDetailResponse[]) => {
      console.log('Received games:', data)
      setGames(data)
    })
    
    wsService.connect()

    const checkConnection = () => {
      const connected = wsService.isConnected()
      setIsConnected(connected)
      // Запрашиваем данные при подключении
      if (connected && games.length === 0) {
        wsService.requestGames()
      }
    }
    
    const interval = setInterval(checkConnection, 1000)
    checkConnection()

    return () => {
      clearInterval(interval)
      unsubscribe()
      wsService.disconnect()
    }
  }, [games.length])

  return {
    games,
    isConnected
  }
}