import { api } from './api';
import { MockApi } from './mockApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

class ApiProxy {
  private getService() {
    return USE_MOCK ? MockApi : api;
  }

  async getCurrentGame() {
    try {
      return await this.getService().getCurrentGame();
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.getCurrentGame();
      }
      throw error;
    }
  }

  async getUserStats() {
    try {
      return await this.getService().getUserStats();
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.getUserStats();
      }
      throw error;
    }
  }

  async buyBallz(amount: number) {
    try {
      return await this.getService().buyBallz(amount);
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.buyBallz(amount);
      }
      throw error;
    }
  }

  async startGame() {
    try {
      return await this.getService().startGame();
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.startGame();
      }
      throw error;
    }
  }

  async getGameResult() {
    try {
      return await this.getService().getGameResult();
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.getGameResult();
      }
      throw error;
    }
  }

  async shareResult(gameId: string) {
    try {
      return await this.getService().shareResult(gameId);
    } catch (error) {
      console.error('API Error:', error);
      if (!USE_MOCK) {
        return MockApi.shareResult(gameId);
      }
      throw error;
    }
  }
}

export const apiProxy = new ApiProxy();