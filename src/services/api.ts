import { Player, GameData, UserProfile, GameDetailResponse, GameState } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://bot.guarant.network/api';

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
      const errorText = await response.text();
      throw new Error(errorText || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // removed getCurrentGame (not present on backend)
  // Use GET /api/game/get_game/{game_id} instead via api.getGameById
  async getGameById(game_id: number): Promise<GameDetailResponse > {
    return this.request<GameDetailResponse >(`/game/get_game/${game_id}`);
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

  async shareResult(gameId: string): Promise<{ shared: boolean }> {
    return this.request<{ shared: boolean }>('/game/share', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  }

  async getUserProfile(id: number): Promise<UserProfile> {
    return this.request<UserProfile>(`/profile/me/${id}`);
  }

  async getHistoryAll(): Promise<GameDetailResponse[]> {
    return this.request<GameDetailResponse[]>(`/history/all`);
  }

  async getHistoryKing(): Promise<GameDetailResponse[]> {
    return this.request<GameDetailResponse[]>(`/history/king`);
  }

  async getHistoryLucky(): Promise<GameDetailResponse[]> {
    return this.request<GameDetailResponse[]>(`/history/lucky`);
  }

  async getHistorySolo(): Promise<GameDetailResponse[]> {
    return this.request<GameDetailResponse[]>(`/history/solo`);
  }

  async updateUserPhoto(user_id: number, avatar_url: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/profile/update_photo/`, {
      method: 'PUT',
      body: JSON.stringify({ user_id, avatar_url }),
    });
  }

  // Update game winner
  /**
   * Update the winner of a game.
   * PUT /api/game/update_winner
   * Body: { game_id, user_id }
   * Responses:
   *  200 - success
   *  400 - winner already set
   *  404 - game not found
   *  500 - server error
   */

  async updateGameWinner(game_id: number, user_id: number): Promise<void> {
    return this.request<void>('/game/update_winner', {
      method: 'PUT',
      body: JSON.stringify({ game_id, user_id }),
    });
  }

  async updateGameState(game_id: number, status: string): Promise<void> {
    return this.request<void>('/game/update_game_status', {
      method: 'PUT',
      body: JSON.stringify({ game_id, status }),
    });
  }


  async shareGameStory(user_id: number, is_winner: boolean): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/stories/share_game_story', {
      method: 'POST',
      body: JSON.stringify({ user_id, is_winner }),
    });
  }

  async buyBalls( userId: number, countBalls: number, initData: string, gameId: number): Promise<{ invoiceLink: string, paymentId: string  }> {
    return this.request<{ invoiceLink: string, paymentId: string }>('/payments/buy_balls', {
      method: 'POST',
      body: JSON.stringify({

        user_id: userId,
        count_balls: countBalls,
        init_data: initData,
        game_id: gameId
      }),
    });
  }
}

export const api = new ApiService();