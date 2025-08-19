import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { api, type UserProfile } from '@/services/api'

interface ExtendedUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  balance?: number
  start_link?: string
  balls_count?: number
  referrers_id?: number[]
  referrers?: any[]
}

interface UseTelegramReturn {
  user: ExtendedUser | null
  webApp: typeof WebApp
  isReady: boolean
  getUserDisplayName: () => string
  inviteFriends: () => void
  showAlert: (message: string) => void
  hapticFeedback: (type: 'light' | 'medium' | 'heavy') => void
  loadUserProfile: () => Promise<void>
}

const BOT_USERNAME = 'ways_ball_bot'

export const useTelegram = (): UseTelegramReturn => {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState<ExtendedUser | null>(null)

  useEffect(() => {
    const initTelegram = async () => {
      if (typeof window !== 'undefined') {
        WebApp.ready()
        WebApp.expand()
        WebApp.setHeaderColor('#0C0E12')
        WebApp.setBackgroundColor('#0C0E12')
        
        const telegramUser = WebApp.initDataUnsafe?.user
        
        if (telegramUser) {
          const baseUser = {
            id: telegramUser.id,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            username: telegramUser.username,
            photo_url: telegramUser.photo_url
          }
          setUser(baseUser)
          
          try {
            const profile = await api.getUserProfile(telegramUser.id)
            let referrers = []
            if (profile.referrers_id?.length) {
              referrers = await Promise.all(
                profile.referrers_id.map(id => api.getUserProfile(id))
              )
            }
            setUser({
              ...baseUser,
              balance: profile.balance,
              start_link: profile.start_link,
              balls_count: profile.balls_count,
              referrers_id: profile.referrers_id,
              referrers
            })
          } catch (error) {
            console.error('Failed to load user profile:', error)
          }
        }
        
        setIsReady(true)
      }
    }
    
    initTelegram()
  }, [])

  const loadUserProfile = async (): Promise<void> => {
    if (!user?.id) return
    
    try {
      const profile = await api.getUserProfile(user.id)
      console.log('Loaded user profile:', profile)
      setUser(prev => prev ? {
        ...prev,
        balance: profile.balance,
        start_link: profile.start_link,
        balls_count: profile.balls_count,
        referrers_id: profile.referrers_id
      } : null)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const getUserDisplayName = (): string => {
    if (!user) return 'Anonymous'
    return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User'
  }


  const inviteFriends = (): void => {
    if (!user) return
    const referralUrl = user.start_link
    console.log('Inviting friends with referral link:', user.start_link)
    const shareText = `🎮 Play Ways Ball Game with me! 🎁`
    WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`)
    WebApp.HapticFeedback.impactOccurred('medium')
  }

  const showAlert = (message: string): void => {
    WebApp.showAlert(message)
  }

  const hapticFeedback = (type: 'light' | 'medium' | 'heavy'): void => {
    WebApp.HapticFeedback.impactOccurred(type)
  }

  return {
    user,
    webApp: WebApp,
    isReady,
    inviteFriends,
    getUserDisplayName,
    showAlert,
    hapticFeedback,
    loadUserProfile
  }
}