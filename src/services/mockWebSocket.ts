import type { GameState, Player, WebSocketMessage } from '@/types/websocket'

// Mock WebSocket server для разработки
class MockWebSocketServer {
  private games: Map<string, GameState> = new Map()
  private connections: Set<MockWebSocket> = new Set()

  createGame(gameId: string): GameState {
    const game: GameState = {
      id: gameId,
      status: 'waiting',
      players: [],
      prizePool: 0,
      timeLeft: 30,
      maxPlayers: 6
    }
    this.games.set(gameId, game)
    return game
  }

  joinGame(gameId: string, player: Omit<Player, 'id' | 'isYou'>): GameState | null {
    let game = this.games.get(gameId)
    if (!game) {
      game = this.createGame(gameId)
    }

    if (game.players.length >= game.maxPlayers) {
      return null
    }

    const newPlayer: Player = {
      id: 'player_' + Date.now(),
      ...player,
      isYou: true
    }

    game.players.push(newPlayer)
    game.prizePool += player.ballz
    this.games.set(gameId, game)

    // Broadcast to all connections
    this.broadcast('game_update', game)
    return game
  }

  startGame(gameId: string): GameState | null {
    const game = this.games.get(gameId)
    if (!game || game.players.length < 2) {
      return null
    }

    game.status = 'active'
    this.games.set(gameId, game)
    this.broadcast('game_started', game)
    return game
  }

  private broadcast(type: string, data: any) {
    const message: WebSocketMessage = { type: type as any, data }
    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      }
    })
  }

  addConnection(ws: MockWebSocket) {
    this.connections.add(ws)
  }

  removeConnection(ws: MockWebSocket) {
    this.connections.delete(ws)
  }
}

// Mock WebSocket implementation
class MockWebSocket extends EventTarget {
  public readyState: number = WebSocket.CONNECTING
  private server: MockWebSocketServer
  private gameId?: string

  constructor(url: string) {
    super()
    this.server = mockServer
    
    // Extract gameId from URL
    const urlParams = new URLSearchParams(url.split('?')[1])
    this.gameId = urlParams.get('gameId') || undefined

    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.server.addConnection(this)
      this.dispatchEvent(new Event('open'))
    }, 100)
  }

  send(data: string) {
    if (this.readyState !== WebSocket.OPEN) return

    try {
      const message = JSON.parse(data)
      this.handleMessage(message)
    } catch (error) {
      console.error('Invalid message format:', error)
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED
    this.server.removeConnection(this)
    this.dispatchEvent(new Event('close'))
  }

  private handleMessage(message: { type: string; data: any }) {
    switch (message.type) {
      case 'join_game':
        if (this.gameId) {
          const game = this.server.joinGame(this.gameId, {
            name: message.data.name,
            ballz: message.data.ballz
          })
          if (game) {
            this.sendMessage('game_update', game)
          }
        }
        break

      case 'start_game':
        if (this.gameId) {
          const game = this.server.startGame(this.gameId)
          if (game) {
            this.sendMessage('game_started', game)
          }
        }
        break

      case 'leave_game':
        // Handle leave game logic
        break
    }
  }

  private sendMessage(type: string, data: any) {
    const message: WebSocketMessage = { type: type as any, data }
    setTimeout(() => {
      this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }))
    }, 10)
  }
}

// Global mock server instance
const mockServer = new MockWebSocketServer()

// Override WebSocket for development
if (process.env.NODE_ENV === 'development') {
  (window as any).WebSocket = MockWebSocket
}

export { MockWebSocketServer, MockWebSocket }