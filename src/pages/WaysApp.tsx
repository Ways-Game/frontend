import React, { useState } from "react"
import { TabBar } from "@/components/navigation/TabBar"
import { PvPScreen } from "./PvPScreen"
import { ReffScreen } from "./ReffScreen"
import { GameScreen } from "./GameScreen"
import { GameResultModal } from "@/components/modals/GameResultModal"

type Screen = "pvp" | "market" | "earn" | "history" | "game"
type ModalType = "win" | "lose" | null

export function WaysApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("pvp")
  const [gameModal, setGameModal] = useState<ModalType>(null)

  const handleTabChange = (tab: "pvp" | "market" | "earn" | "history") => {
    if (tab === "earn") {
      setCurrentScreen("earn")
    } else {
      setCurrentScreen(tab)
    }
  }

  const handleStartGame = () => {
    setCurrentScreen("game")
  }

  const handleGameEnd = (result: "win" | "lose") => {
    setGameModal(result)
  }

  const handlePlayAgain = () => {
    setGameModal(null)
    // Game restarts automatically
  }

  const handleCloseGame = () => {
    setCurrentScreen("pvp")
    setGameModal(null)
  }

  const handleShare = () => {
    // Implement share functionality
    console.log("Sharing game result...")
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "pvp":
        return <PvPScreen />
      case "earn":
        return <ReffScreen />
      case "game":
        return <GameScreen onClose={handleCloseGame} />
      case "market":
        return (
          <div className="min-h-screen bg-background flex items-center justify-center pb-20">
            <div className="text-center">
              <h1>Market</h1>
              <p className="text-text-secondary">Coming soon...</p>
            </div>
          </div>
        )
      case "history":
        return (
          <div className="min-h-screen bg-background flex items-center justify-center pb-20">
            <div className="text-center">
              <h1>History</h1>
              <p className="text-text-secondary">Coming soon...</p>
            </div>
          </div>
        )
      default:
        return <PvPScreen />
    }
  }

  const getActiveTab = () => {
    if (currentScreen === "game") return "pvp"
    if (currentScreen === "earn") return "earn"
    return currentScreen
  }

  return (
    <div className="min-h-screen bg-background">
      {renderScreen()}
      
      {/* Tab Bar - hidden during game */}
      {currentScreen !== "game" && (
        <TabBar 
          activeTab={getActiveTab()} 
          onTabChange={handleTabChange} 
        />
      )}

      {/* Game Result Modal */}
      {gameModal && (
        <GameResultModal
          type={gameModal}
          onPlayAgain={handlePlayAgain}
          onShare={handleShare}
          onClose={() => setGameModal(null)}
        />
      )}

      {/* Demo buttons for testing modals */}
      {currentScreen === "game" && (
        <div className="fixed top-20 right-4 space-y-2 z-40">
          <button
            onClick={() => handleGameEnd("win")}
            className="px-2 py-1 bg-accent-green text-xs rounded"
          >
            Test Win
          </button>
          <button
            onClick={() => handleGameEnd("lose")}
            className="px-2 py-1 bg-accent-red text-xs rounded"
          >
            Test Lose
          </button>
        </div>
      )}
    </div>
  )
}