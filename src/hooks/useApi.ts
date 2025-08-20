import { useState, useCallback } from 'react';
import { apiProxy } from '@/services/apiProxy';

export function useApi<T>(apiCall: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return { data, loading, error, execute };
}

export const useGameApi = () => ({
  getCurrentGame: useApi(() => apiProxy.getCurrentGame()),
  startGame: useApi(() => apiProxy.startGame()),
  getGameResult: useApi(() => apiProxy.getGameResult()),
});

export const useUserApi = () => ({
  buyBallz: (amount: number) => useApi(() => apiProxy.buyBallz(amount)),
  shareResult: (gameId: string) => useApi(() => apiProxy.shareResult(gameId)),
});