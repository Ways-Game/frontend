import { Outlet } from "react-router-dom"
import { TabBar } from "@/components/navigation/TabBar"
import { useTelegram } from "@/hooks/useTelegram"

export function Layout() {
  const { isReady } = useTelegram()

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background max-w-[600px] mx-auto">
      <Outlet />
      <TabBar />
    </div>
  )
}