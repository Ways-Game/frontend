import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { MockApi, type UserProfile } from '@/services/mockApi'
import { api } from '@/services/api'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface UseTelegramReturn {
  user: TelegramUser | null
  webApp: typeof WebApp
  isReady: boolean
  shareReferralLink: () => void
  getUserDisplayName: () => string
  inviteFriends: () => void
  showAlert: (message: string) => void
  hapticFeedback: (type: 'light' | 'medium' | 'heavy') => void
  getUserProfile: (id: number) => Promise<UserProfile>
}

const BOT_USERNAME = 'ways_ball_bot'

export const useTelegram = (): UseTelegramReturn => {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState<TelegramUser | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      WebApp.ready()
      WebApp.expand()
      WebApp.setHeaderColor('#0C0E12')
      WebApp.setBackgroundColor('#0C0E12')
      
       const telegramUser = WebApp.initDataUnsafe?.user
      
      if (telegramUser) {
        setUser({
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
          photo_url: telegramUser.photo_url
        })
      }

      // Логируем после установки состояния
      console.log('WebApp instance:', WebApp.initData)
      console.log('User data:', telegramUser) // Используем локальную переменную
      
      setIsReady(true)
      
      setIsReady(true)
    }
  }, [])

  const getUserDisplayName = (): string => {
    if (!user) return 'Anonymous'
    return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User'
  }

  const shareReferralLink = (): void => {
    if (!user) return
    const referralUrl = `https://t.me/${BOT_USERNAME}?start=ref_${user.id}`
    const shareText = `🎮 Join me in Ways Ball Game and earn rewards!\n\n🎁 Use my referral link to get bonus ballz!`
    WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`)
    WebApp.HapticFeedback.impactOccurred('light')
  }

  const inviteFriends = (): void => {
    if (!user) return
    const referralUrl = `https://t.me/${BOT_USERNAME}?start=ref_${user.id}`
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

  const getUserProfile = async (id: number): Promise<UserProfile> => {
    console.log(api.getUserProfile(id), id)
    return api.getUserProfile(id)
  }

  return {
    user,
    webApp: WebApp,
    isReady,
    shareReferralLink,
    getUserDisplayName,
    inviteFriends,
    showAlert,
    hapticFeedback,
    getUserProfile
  }
}