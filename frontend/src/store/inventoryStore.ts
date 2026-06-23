import { create } from 'zustand';
import type { InventoryData, AnalyticsResult, StockData } from '../types';

interface InventoryState {
  inventoryData: InventoryData[];
  stockData: StockData[];
  analyticsResult: AnalyticsResult | null;
  currentPage: string;
  isLoading: boolean;
  error: string | null;
  hasData: boolean;

  setInventoryData: (data: InventoryData[]) => void;
  setStockData: (data: StockData[]) => void;
  setAnalyticsResult: (result: AnalyticsResult | null) => void;
  setCurrentPage: (page: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasData: (hasData: boolean) => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  inventoryData: [],
  stockData: [],
  analyticsResult: null,
  currentPage: 'upload',
  isLoading: false,
  error: null,
  hasData: false,

  setInventoryData: (data) => set({ inventoryData: data, hasData: data.length > 0 }),
  setStockData: (data) => set({ stockData: data }),
  setAnalyticsResult: (result) => set({ analyticsResult: result }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setHasData: (hasData) => set({ hasData }),
}));
