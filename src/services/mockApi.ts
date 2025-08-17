// Mock API service for development
export interface Player {
  id: string
  name: string
  ballz: number
  avatar?: string
  isYou?: boolean
}

export interface GameData {
  id: string
  players: Player[]
  prizePool: number
  timeLeft: number
  status: 'waiting' | 'active' | 'finished'
}

export interface UserStats {
  balance: number
  totalGames: number
  wins: number
  referrals: number
  claimableAmount: number
  totalClaimed: number
}

// Mock data
const mockPlayers: Player[] = [
  { id: '1', name: 'YOU', ballz: 20, isYou: true },
  { id: '2', name: 'Alex', ballz: 10 },
  { id: '3', name: 'Marina', ballz: 30 },
  { id: '4', name: 'Dima', ballz: 50 }
]

const mockUserStats: UserStats = {
  balance: 500,
  totalGames: 42,
  wins: 18,
  referrals: 0,
  claimableAmount: 0,
  totalClaimed: 0
}

export class MockApi {
  static async getCurrentGame(): Promise<GameData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))
    
    return {
      id: '23245',
      players: mockPlayers,
      prizePool: 110,
      timeLeft: 15,
      status: 'waiting'
    }
  }

  static async getUserStats(): Promise<UserStats> {
    await new Promise(resolve => setTimeout(resolve, 150))
    return mockUserStats
  }

  static async buyBallz(amount: number): Promise<{ success: boolean; newBalance: number }> {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Mock transaction
    const cost = amount * 30 // 1 ballz = 30 stars
    if (mockUserStats.balance >= cost) {
      mockUserStats.balance -= cost
      return { success: true, newBalance: mockUserStats.balance }
    }
    
    throw new Error('Insufficient balance')
  }

  static async startGame(): Promise<{ gameId: string }> {
    await new Promise(resolve => setTimeout(resolve, 100))
    return { gameId: '23246' }
  }

  static async getGameResult(): Promise<{ result: 'win' | 'lose'; prize?: number }> {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Random result for demo
    const isWin = Math.random() > 0.5
    return {
      result: isWin ? 'win' : 'lose',
      prize: isWin ? 3423 : undefined
    }
  }

  static async shareResult(gameId: string): Promise<{ shared: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Mock share via Telegram
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=https://ways.app/game/${gameId}&text=Я только что выиграл в Ways!`)
    }
    
    return { shared: true }
  }
}