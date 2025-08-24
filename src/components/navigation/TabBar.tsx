import React, { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Smile, ShoppingBag, Users, Clock } from "lucide-react"

const tabs = [
  { id: "pvp" as const, label: "PvP", icon: Smile },
  { id: "market" as const, label: "Market", icon: ShoppingBag },
  { id: "earn" as const, label: "Earn", icon: Users },
  { id: "history" as const, label: "History", icon: Clock }
]

export function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  
  useEffect(() => {
    const initialHeight = window.visualViewport?.height || window.innerHeight
    
    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight
      setIsKeyboardOpen(currentHeight < initialHeight * 0.75)
    }
    
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [])
  
  const getActiveTab = () => {
    switch (location.pathname) {
      case '/': return 'pvp'
      case '/market': return 'market'
      case '/earn': return 'earn'
      case '/history': return 'history'
      default: return 'pvp'
    }
  }
  
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'pvp':
        navigate('/')
        break
      case 'market':
        navigate('/market')
        break
      case 'earn':
        navigate('/earn')
        break
      case 'history':
        navigate('/history')
        break
    }
  }
  
  const activeTab = getActiveTab()
  if (isKeyboardOpen) return null
  
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] bg-[#00000090] h-[80px] border-border z-50 py-2">
      <div className="flex items-center justify-around h-full px-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={cn(
              "w-16 h-16 inline-flex flex-col justify-center items-center gap-1 transition-colors cursor-pointer",
              activeTab === id ? "bg-zinc-800 rounded-3xl text-white" : "text-gray-400"
            )}
            onClick={() => handleTabChange(id)}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}