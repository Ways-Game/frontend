export interface GameState {
  id: string
  status: 'waiting' | 'active' | 'finished'
  players: Player[]
  prizePool: number
  timeLeft: number
  maxPlayers: number
  createdAt?: Date
  startedAt?: Date
  endedAt?: Date
}

export interface Player {
  id: string
  name: string
  ballz: number
  isYou: boolean
  avatar?: string
  score?: number
}

export interface WebSocketMessage {
  type: 'game_update' | 'player_joined' | 'player_left' | 'game_started' | 'game_ended' | 'error'
  data: any
  timestamp?: number
}

export interface GameEvents {
  onGameUpdate: (game: GameState) => void
  onPlayerJoined: (player: Player) => void
  onPlayerLeft: (playerId: string) => void
  onGameStarted: (game: GameState) => void
  onGameEnded: (game: GameState) => void
  onError: (error: string) => void
}

export interface WebSocketConfig {
  url: string
  reconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
}