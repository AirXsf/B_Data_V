export interface InventoryData {
  id: string;
  materialCode: string;
  materialName: string;
  category: string;
  department: string;
  project: string;
  quantity: number;
  amount: number;
  date: string;
  type: 'in' | 'out';
  baseStock: number;
  unitPrice: number;
  supplier: string;
}

export interface MonthlyTrend {
  month: string;
  inAmount: number;
  outAmount: number;
  balance: number;
}

export interface CategoryComposition {
  materialCode: string;
  materialName: string;
  amount: number;
  percentage: number;
}

export interface MaterialRanking {
  materialCode: string;
  materialName: string;
  amount: number;
  rank: number;
}

export interface TurnoverData {
  materialCode: string;
  materialName: string;
  turnoverRate: number;
  monthlyOutQty: number;
  avgStock: number;
}

export interface WarningItem {
  id: string;
  type: 'overstock' | 'understock' | 'stale' | 'low_stock';
  level: 'warning' | 'danger';
  materialCode: string;
  materialName: string;
  message: string;
  currentStock: number;
  threshold: number;
  baselineDemand: number;
  monthsSinceLastTransaction: number;
  suggestion: string;
}

export interface DepartmentAnalysis {
  department: string;
  inAmount: number;
  outAmount: number;
  difference: number;
}

export interface ProjectAnalysis {
  project: string;
  purchaseAmount: number;
  usedAmount: number;
  status: 'normal' | 'overbudget' | 'waste';
}

export interface ForecastData {
  month: string;
  forecastStock: number;
  forecastInAmount: number;
  forecastOutAmount: number;
  inTransitPurchase: number;
  salesDemand: number;
}

export interface StockData {
  materialCode: string;
  materialName: string;
  balanceQuantity: number;
  balanceAmount: number;
  baseDemandQuantity: number;
}

export interface AnalyticsResult {
  trendData: MonthlyTrend[];
  inboundComposition: CategoryComposition[];
  outboundComposition: CategoryComposition[];
  departmentComposition: CategoryComposition[];
  projectComposition: CategoryComposition[];
  topMaterials: MaterialRanking[];
  topTurnover: TurnoverData[];
  bottomTurnover: TurnoverData[];
  departmentAnalysis: DepartmentAnalysis[];
  projectAnalysis: ProjectAnalysis[];
  warnings: WarningItem[];
  forecastData: ForecastData[];
  analysisText: string;
}
