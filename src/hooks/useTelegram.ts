import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'

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
}

export const useTelegram = (): UseTelegramReturn => {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState<TelegramUser | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      WebApp.ready()
      WebApp.expand()
      
      // Set theme
      WebApp.setHeaderColor('#0C0E12')
      WebApp.setBackgroundColor('#0C0E12')
      
      // Get user data
      if (WebApp.initDataUnsafe?.user) {
        setUser(WebApp.initDataUnsafe.user)
      }
      
      setIsReady(true)
    }
  }, [])

  return {
    user,
    webApp: WebApp,
    isReady
  }
}