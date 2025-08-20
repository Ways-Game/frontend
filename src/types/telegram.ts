export interface ExtendedUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  balance?: number
  start_link?: string
  balls_count?: number
  avatar_url?: string
  wallet_address?: string
  referrals?: any[]
  count_story_current_day?: number
}

export interface UseTelegramReturn {
  user: ExtendedUser | null
  webApp: any
  isReady: boolean
  getUserDisplayName: () => string
  inviteFriends: () => void
  showAlert: (message: string) => void
  hapticFeedback: (type: 'light' | 'medium' | 'heavy') => void
  loadUserProfile: () => Promise<void>
  shareGameStory: (isWinner: boolean) => Promise<void>
}