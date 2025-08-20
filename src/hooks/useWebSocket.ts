import { useEffect, useState } from 'react'
import { wsService } from '@/services/websocket'
import type { GameDetailResponse } from '@/types/api'

export function useGames() {
  const [games, setGames] = useState<GameDetailResponse[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // подписываемся один раз
    const unsubscribe = wsService.subscribe('games_list', (data: GameDetailResponse[]) => {
      console.log('Received games:', data)
      setGames(data)
    })

    // подключаемся (onopen у сервиса сам отправит get_games)
    wsService.connect()

    // только для индикации соединения (обновляем каждую секунду)
    const interval = setInterval(() => {
      setIsConnected(wsService.isConnected())
    }, 1000)
    // и выставим начальное состояние
    setIsConnected(wsService.isConnected())

    return () => {
      clearInterval(interval)
      // снимаем только нашу подписку, а не чистим всё в сервисе
      unsubscribe()
      wsService.disconnect()
    }
    // пустой массив — эффект один раз
  }, [])

  return {
    games,
    isConnected
  }
}