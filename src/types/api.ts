export interface UserProfile {
  id: number;
  username?: string;
  balance: number;
  start_link: string;
  balls_count: number;
  avatar_url?: string;
  wallet_address?: string;
  referrals?: UserProfile[];
  count_story_current_day?: number;
  referrers_id?: number[];
}

export interface ParticipantData {
  id: number;
  username?: string;
  balance: number;
  start_link: string;
  balls_count: number;
  avatar_url?: string;
  wallet_address?: string;
}

export enum GameState {
  WAIT_PLAYERS = 'wait_players',
  WAIT_PLAY = 'wait_play', 
  PLAY = 'play',
  FINISH = 'finish'
}

export interface GameDetailResponse {
  id: number;
  seed: string;
  start_time: string;
  map_id: number;
  total_balls: number;
  total_price: number;
  status: GameState;
  participants: ParticipantData[];
}

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

export interface ReferralUser {
  id: string
  username: string
  firstName: string
  earnings: number
  joinedAt: string
}