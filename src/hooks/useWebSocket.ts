import { useEffect, useRef, useState } from 'react'
import { wsService } from '@/services/websocket'
import type { GameDetailResponse } from '@/types/api'

export function useGames() {
  const [games, setGames] = useState<GameDetailResponse[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const unsubscribeRefs = useRef<(() => void)[]>([])

  useEffect(() => {
    wsService.connect()

    const unsubscribes = [
      wsService.subscribe('games_list', (data: GameDetailResponse[]) => {
        console.log('Received games:', data)
        setGames(data)
      })
    ]

    unsubscribeRefs.current = unsubscribes

    const checkConnection = () => {
      setIsConnected(wsService.isConnected())
    }
    
    const interval = setInterval(checkConnection, 1000)
    checkConnection()

    return () => {
      clearInterval(interval)
      unsubscribeRefs.current.forEach(unsub => unsub())
      wsService.disconnect()
    }
  }, [])

  return {
    games,
    isConnected
  }
}