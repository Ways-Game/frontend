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
  earn_money?: number;
  total_amount?: number;
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

// === Market / Gifts ===
export interface Gift {
  available_gift_id: number;
  gift_id: number;
  telegram_id: number;
  title: string;
  url: string; // image url
  price: number;
}

export interface GiftBuyRequest {
  user_id: number;
  gift_id: number;
  count: number;
  init_data: string;
}

export interface GiftBuyResponse {
  order_id: number;
  status?: string; // optional, depends on backend
}

export interface GiftOrderStatusUpdate {
  order_id: number;
  new_status: string; // e.g., 'PENDING', 'PAID', 'CANCELLED'
}