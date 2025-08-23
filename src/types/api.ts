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
  user?: ParticipantData;
}

export enum GameState {
  WAIT_PLAYERS = 'wait_players',
  WAIT_PLAY = 'wait_play', 
  PLAY = 'play',
  FINISH = 'finish'
}

export interface GameDetailResponse {
  game_id: number;
  seed: string;
  start_time: string;
  map_id: number;
  total_balls: number;
  total_price: number;
  status: GameState;
  participants: ParticipantData[];
  start_wait_play?: string;
  music_title ?: string;
  music_content?: string;
  winner_id?: number;
}

export interface Player {
  id: string
  name: string
  ballz: number
  avatar?: string
  isYou?: boolean
}

export interface GameData {
  game_id: number
  seed: string
  mapId: number
  participants: ParticipantData[]
  prize: number
  total_balls: number
  status: GameState
}

// Request body for updating the game winner
export interface UpdateWinner {
  game_id: number;
  user_id: number;
}

export interface ReferralUser {
  id: string
  username: string
  firstName: string
  earnings: number
  joinedAt: string
}