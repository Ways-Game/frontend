import React, { useState, useEffect, useRef, useCallback } from "react"
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
  const [highlightStyle, setHighlightStyle] = useState({ width: 0, left: 0 })
  const tabRefs = useRef<Array<HTMLDivElement | null>>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const prevActiveTab = useRef<string | null>(null)
  
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
    if (location.pathname === '/game' && location.state && (location.state as any).isReplay) {
      return 'history'
    }
    
    switch (location.pathname) {
      case '/': return 'pvp'
      case '/market': return 'market'
      case '/earn': return 'earn'
      case '/history': return 'history'
      default: return 'pvp'
    }
  }
  
  const updateHighlightPosition = useCallback(() => {
    const activeTab = getActiveTab()
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab)
    
    if (tabRefs.current[activeIndex] && containerRef.current) {
      const tabElement = tabRefs.current[activeIndex]
      // Используем offsetLeft вместо getBoundingClientRect()
      const newLeft = tabElement!.offsetLeft
      const newWidth = tabElement!.offsetWidth
      
      setHighlightStyle({
        left: newLeft,
        width: newWidth
      })
      
      prevActiveTab.current = activeTab
    }
  }, [location.pathname, location.state])

  useEffect(() => {
    updateHighlightPosition()
  }, [updateHighlightPosition])

  useEffect(() => {
    const handleResize = () => {
      updateHighlightPosition()
    }

    window.addEventListener('resize', handleResize)

    // Observe container size changes (e.g., when scrollbar appears)
    let ro: ResizeObserver | null = null
    if (containerRef.current && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => {
        updateHighlightPosition()
      })
      ro.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (ro && containerRef.current) ro.disconnect()
    }
  }, [updateHighlightPosition])
  
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
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] bg-[#00000090] h-[80px] border-border z-50 py-2 animate-in slide-in-from-bottom-4 duration-300">
      <div ref={containerRef} className="flex items-center justify-around h-full px-4 relative">
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-16 bg-zinc-800 rounded-3xl backdrop-blur-sm transition-all duration-500 ease-out"
          style={{
            left: `${highlightStyle.left}px`,
            width: `${highlightStyle.width}px`,
          }}
        />
        
        {tabs.map(({ id, label, icon: Icon }, index) => (
          <div
            key={id}
            ref={el => tabRefs.current[index] = el}
            className={cn(
              "w-16 h-16 inline-flex flex-col justify-center items-center gap-1 transition-all duration-300 cursor-pointer transform hover:scale-105 relative z-10",
              activeTab === id 
                ? "text-white" 
                : "text-gray-400 hover:text-gray-300"
            )}
            onClick={() => handleTabChange(id)}
            style={{
              animationDelay: `${index * 100}ms`
            }}
          >
            <Icon className={cn(
              "w-6 h-6 transition-transform duration-200",
              activeTab === id ? "scale-110" : "scale-100"
            )} />
            <span className="text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}