import { Player, GameData, UserStats } from './mockApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getCurrentGame(): Promise<GameData> {
    return this.request<GameData>('/game/current');
  }

  async getUserStats(): Promise<UserStats> {
    return this.request<UserStats>('/user/stats');
  }

  async buyBallz(amount: number): Promise<{ success: boolean; newBalance: number }> {
    return this.request<{ success: boolean; newBalance: number }>('/user/buy-ballz', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async startGame(): Promise<{ gameId: string }> {
    return this.request<{ gameId: string }>('/game/start', {
      method: 'POST',
    });
  }

  async getGameResult(): Promise<{ result: 'win' | 'lose'; prize?: number }> {
    return this.request<{ result: 'win' | 'lose'; prize?: number }>('/game/result');
  }

  async shareResult(gameId: string): Promise<{ shared: boolean }> {
    return this.request<{ shared: boolean }>('/game/share', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  }
}

export const api = new ApiService();