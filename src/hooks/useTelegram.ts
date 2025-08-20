import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { api } from '@/services/api'
import { ExtendedUser, UseTelegramReturn, UserProfile } from '@/types'


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
            if (telegramUser.photo_url) {
              await api.updateUserPhoto(telegramUser.id, telegramUser.photo_url)
            }
            
            const profile = await api.getUserProfile(telegramUser.id)
            setUser({
              ...baseUser,
              balance: profile.balance,
              start_link: profile.start_link,
              balls_count: profile.balls_count,
              avatar_url: profile.avatar_url,
              wallet_address: profile.wallet_address,
              referrals: profile.referrals,
              count_story_current_day: profile.count_story_current_day
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
        referrers_id: profile.referrals,
        count_story_current_day: profile.count_story_current_day
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

  const shareGameStory = async (isWinner: boolean): Promise<void> => {
    if (!user?.id) return
    
    try {
      await api.shareGameStory(user.id, isWinner)
      // Обновляем профиль после успешной отправки истории
      await loadUserProfile()
    } catch (error: any) {
      console.error('Failed to share game story:', error)
      throw error
    }
  }

  return {
    user,
    webApp: WebApp,
    isReady,
    inviteFriends,
    getUserDisplayName,
    showAlert,
    hapticFeedback,
    loadUserProfile,
    shareGameStory
  }
}