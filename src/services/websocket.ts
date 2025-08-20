import type { GameDetailResponse } from '@/types/api'
const API_BASE_URL = import.meta.env.VITE_API_URL


class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  connect() {
    const wsUrl =  `wss://bot.guarant.network/api/game/ws/games`
    try {
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {

        this.reconnectAttempts = 0
        // Сервер отправляет games_list сразу, но можно запросить обновление
        setTimeout(() => this.requestGames(), 100)
      }
      
      this.ws.onmessage = (event) => {
        try {

          const message = JSON.parse(event.data)

          this.notifyListeners(message.event, message.data)
        } catch (error) {

        }
      }
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.attemptReconnect()
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      this.attemptReconnect()
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`)
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)
    return () => {
      const callbacks = this.listeners.get(eventType)

      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  private notifyListeners(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    } else {
      console.log('No callbacks found for event:', eventType)
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  requestGames() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Отправляем get_games для получения данных
      this.ws.send('get_games')
    }
  }
}

export const wsService = new WebSocketService()