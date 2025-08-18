import React from "react"
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
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[60px] bg-bg-elev-1 border-t border-border">
      <div className="flex items-center justify-around h-full px-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
              activeTab === id ? "text-foreground" : "text-tertiary"
            )}
          >
            <Icon className="w-[22px] h-[22px]" />
            <span className="micro">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}