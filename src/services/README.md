# WebSocket Services

## Обзор

WebSocket сервисы обеспечивают real-time коммуникацию для PvP игр.

## Файлы

- `websocket.ts` - Основной WebSocket сервис
- `mockWebSocket.ts` - Mock сервер для разработки
- `useWebSocket.ts` - React хук для WebSocket

## Использование

```tsx
import { useWebSocket } from '@/hooks/useWebSocket'

function GameComponent() {
  const { gameState, isConnected, joinGame, startGame } = useWebSocket('game_123')
  
  useEffect(() => {
    if (isConnected) {
      joinGame({ name: 'Player', ballz: 10 })
    }
  }, [isConnected])
  
  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Players: {gameState?.players.length || 0}</p>
    </div>
  )
}
```

## События

- `game_update` - Обновление состояния игры
- `player_joined` - Игрок присоединился
- `player_left` - Игрок покинул игру
- `game_started` - Игра началась
- `game_ended` - Игра завершена

## Development

В development режиме используется mock WebSocket сервер, который симулирует реальное поведение сервера.