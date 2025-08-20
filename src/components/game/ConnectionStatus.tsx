import { Wifi, WifiOff, AlertCircle } from "lucide-react"

interface ConnectionStatusProps {
  isConnected: boolean
  playersCount: number
  maxPlayers: number
  gameStatus: 'waiting' | 'active' | 'finished'
}

export function ConnectionStatus({ isConnected, playersCount, maxPlayers, gameStatus }: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (!isConnected) return 'bg-red-500'
    if (gameStatus === 'active') return 'bg-green-500'
    if (gameStatus === 'waiting') return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected'
    if (gameStatus === 'active') return 'Game Active'
    if (gameStatus === 'waiting') return `Waiting (${playersCount}/${maxPlayers})`
    return 'Game Ended'
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-[20px]">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      {isConnected ? (
        <Wifi className="w-4 h-4 text-green-400" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-400" />
      )}
      <span className="text-neutral-50 text-sm">{getStatusText()}</span>
      {!isConnected && <AlertCircle className="w-4 h-4 text-red-400" />}
    </div>
  )
}