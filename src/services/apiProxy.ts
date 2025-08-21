import { api } from './api';

class ApiProxy {
  private getService() {
    return api;
  }

  async getGameById(game_id: number) {
    try {
      return await this.getService().getGameById(game_id);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }


  async buyBallz(amount: number) {
    try {
      return await this.getService().buyBallz(amount);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async startGame() {
    try {
      return await this.getService().startGame();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async updateGameWinner(game_id: number, user_id: number) {
    try {
      return await this.getService().updateGameWinner(game_id, user_id);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async shareResult(gameId: string) {
    try {
      return await this.getService().shareResult(gameId);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
}

export const apiProxy = new ApiProxy();