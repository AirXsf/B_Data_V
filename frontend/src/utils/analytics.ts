import type { InventoryData, AnalyticsResult, StockData, MonthlyTrend, CategoryComposition, MaterialRanking, TurnoverData, DepartmentAnalysis, ProjectAnalysis, WarningItem, ForecastData } from '../types';

export const analyzeInventoryData = (data: InventoryData[], stockData: StockData[]): AnalyticsResult => {
  const trendData = calculateTrendData(data);
  const inboundComposition = calculateCategoryComposition(data.filter((d) => d.type === 'in'));
  const outboundComposition = calculateCategoryComposition(data.filter((d) => d.type === 'out'));
  const departmentComposition = calculateDepartmentComposition(data);
  const projectComposition = calculateProjectComposition(data);
  const topMaterials = calculateTopMaterials(data);
  const topTurnover = calculateTurnoverRate(data, 'top');
  const bottomTurnover = calculateTurnoverRate(data, 'bottom');
  const departmentAnalysis = calculateDepartmentAnalysis(data);
  const projectAnalysis = calculateProjectAnalysis(data);
  const warnings = generateWarnings(data, stockData);
  const forecastData = generateForecast(trendData);

  return {
    trendData,
    inboundComposition,
    outboundComposition,
    departmentComposition,
    projectComposition,
    topMaterials,
    topTurnover,
    bottomTurnover,
    departmentAnalysis,
    projectAnalysis,
    warnings,
    forecastData,
    analysisText: '',
  };
};

const calculateTrendData = (data: InventoryData[]): MonthlyTrend[] => {
  const monthMap = new Map<string, { inAmount: number; outAmount: number }>();

  data.forEach((item) => {
    const month = item.date.substring(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { inAmount: 0, outAmount: 0 });
    }
    const monthData = monthMap.get(month)!;
    if (item.type === 'in') {
      monthData.inAmount += item.amount;
    } else {
      monthData.outAmount += item.amount;
    }
  });

  const sortedMonths = Array.from(monthMap.keys()).sort();
  let runningBalance = 0;

  return sortedMonths.map((month) => {
    const { inAmount, outAmount } = monthMap.get(month)!;
    runningBalance += inAmount - outAmount;
    return {
      month,
      inAmount,
      outAmount,
      balance: runningBalance,
    };
  });
};

const calculateCategoryComposition = (data: InventoryData[]): CategoryComposition[] => {
  const categoryMap = new Map<string, { materialCode: string; materialName: string; amount: number }>();
  let total = 0;

  data.forEach((item) => {
    const key = item.category || '未分类';
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { materialCode: key, materialName: key, amount: 0 });
    }
    categoryMap.get(key)!.amount += item.amount;
    total += item.amount;
  });

  return Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
};

const calculateDepartmentComposition = (data: InventoryData[]): CategoryComposition[] => {
  const map = new Map<string, { materialCode: string; materialName: string; amount: number }>();
  let total = 0;

  data.forEach((item) => {
    const dept = item.department || '未分配';
    if (!map.has(dept)) {
      map.set(dept, { materialCode: dept, materialName: dept, amount: 0 });
    }
    map.get(dept)!.amount += item.amount;
    total += item.amount;
  });

  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
};

const calculateProjectComposition = (data: InventoryData[]): CategoryComposition[] => {
  const map = new Map<string, { materialCode: string; materialName: string; amount: number }>();
  let total = 0;

  data.forEach((item) => {
    const proj = item.project || '未分配';
    if (!map.has(proj)) {
      map.set(proj, { materialCode: proj, materialName: proj, amount: 0 });
    }
    map.get(proj)!.amount += item.amount;
    total += item.amount;
  });

  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
};

const calculateTopMaterials = (data: InventoryData[]): MaterialRanking[] => {
  const materialMap = new Map<string, { materialCode: string; materialName: string; amount: number }>();

  data.filter((d) => d.type === 'in').forEach((item) => {
    if (!materialMap.has(item.materialCode)) {
      materialMap.set(item.materialCode, {
        materialCode: item.materialCode,
        materialName: item.materialName,
        amount: 0,
      });
    }
    materialMap.get(item.materialCode)!.amount += item.amount;
  });

  return Array.from(materialMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
};

const calculateTurnoverRate = (data: InventoryData[], type: 'top' | 'bottom'): TurnoverData[] => {
  const materialStats = new Map<string, { outQty: number; inQty: number; name: string; months: Set<string> }>();

  data.forEach((item) => {
    if (!materialStats.has(item.materialCode)) {
      materialStats.set(item.materialCode, { outQty: 0, inQty: 0, name: item.materialName, months: new Set() });
    }
    const stat = materialStats.get(item.materialCode)!;
    stat.name = item.materialName;
    stat.months.add(item.date.substring(0, 7));
    if (item.type === 'out') {
      stat.outQty += item.quantity;
    } else {
      stat.inQty += item.quantity;
    }
  });

  const turnoverList: TurnoverData[] = [];
  materialStats.forEach((stat, code) => {
    const avgStock = Math.max(stat.inQty / Math.max(stat.months.size, 1), 10);
    const monthlyOutQty = stat.outQty / Math.max(stat.months.size, 1);
    const turnoverRate = avgStock > 0 ? (monthlyOutQty / avgStock) * 100 : 0;

    turnoverList.push({
      materialCode: code,
      materialName: stat.name,
      turnoverRate: Math.round(turnoverRate * 10) / 10,
      monthlyOutQty: Math.round(monthlyOutQty),
      avgStock: Math.round(avgStock),
    });
  });

  if (type === 'top') {
    return turnoverList.sort((a, b) => b.turnoverRate - a.turnoverRate).slice(0, 10);
  }
  return turnoverList.sort((a, b) => a.turnoverRate - b.turnoverRate).slice(0, 10);
};

const calculateDepartmentAnalysis = (data: InventoryData[]): DepartmentAnalysis[] => {
  const deptMap = new Map<string, { inAmount: number; outAmount: number }>();

  data.forEach((item) => {
    const dept = item.department || '未分配';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { inAmount: 0, outAmount: 0 });
    }
    const stat = deptMap.get(dept)!;
    if (item.type === 'in') {
      stat.inAmount += item.amount;
    } else {
      stat.outAmount += item.amount;
    }
  });

  return Array.from(deptMap.entries())
    .map(([department, stat]) => ({
      department,
      inAmount: stat.inAmount,
      outAmount: stat.outAmount,
      difference: stat.inAmount - stat.outAmount,
    }))
    .sort((a, b) => b.inAmount + b.outAmount - (a.inAmount + a.outAmount));
};

const calculateProjectAnalysis = (data: InventoryData[]): ProjectAnalysis[] => {
  const projMap = new Map<string, { inAmount: number; outAmount: number }>();

  data.forEach((item) => {
    const proj = item.project || '未分配';
    if (!projMap.has(proj)) {
      projMap.set(proj, { inAmount: 0, outAmount: 0 });
    }
    const stat = projMap.get(proj)!;
    if (item.type === 'in') {
      stat.inAmount += item.amount;
    } else {
      stat.outAmount += item.amount;
    }
  });

  return Array.from(projMap.entries()).map(([project, stat]) => {
    let status: ProjectAnalysis['status'] = 'normal';
    const ratio = stat.inAmount > 0 ? stat.outAmount / stat.inAmount : 0;
    if (ratio > 0.95) {
      status = 'overbudget';
    } else if (ratio < 0.5 && stat.inAmount > 0) {
      status = 'waste';
    }
    return {
      project,
      purchaseAmount: stat.inAmount,
      usedAmount: stat.outAmount,
      status,
    };
  });
};

const generateWarnings = (data: InventoryData[], stockData: StockData[]): WarningItem[] => {
  const warnings: WarningItem[] = [];
  const materialMap = new Map<string, { outQty: number; inQty: number; lastDate: string; name: string }>();

  data.forEach((item) => {
    if (!materialMap.has(item.materialCode)) {
      materialMap.set(item.materialCode, { outQty: 0, inQty: 0, lastDate: item.date, name: item.materialName });
    }
    const stat = materialMap.get(item.materialCode)!;
    stat.name = item.materialName;
    if (item.date > stat.lastDate) stat.lastDate = item.date;
    if (item.type === 'out') stat.outQty += item.quantity;
    else stat.inQty += item.quantity;
  });

  // 库存物料的预警（基于结存数量和基础需求数量）
  stockData.forEach((stock) => {
    const baseDemand = stock.baseDemandQuantity || 0;
    const currentStock = stock.balanceQuantity || 0;
    if (baseDemand > 0 && currentStock < baseDemand) {
      const gap = baseDemand - currentStock;
      warnings.push({
        id: `warn-low-${stock.materialCode}`,
        type: 'low_stock',
        level: gap > baseDemand * 0.5 ? 'danger' : 'warning',
        materialCode: stock.materialCode,
        materialName: stock.materialName,
        message: `当前库存 ${currentStock} 低于基础需求 ${baseDemand}，缺口 ${gap}`,
        currentStock,
        threshold: baseDemand,
        baselineDemand: baseDemand,
        monthsSinceLastTransaction: 0,
        suggestion: gap > baseDemand * 0.5 ? '立即补货' : '准备补货',
      });
    }
  });

  // 积压预警（基于出入库历史）
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = sortedData.length > 0 ? sortedData[sortedData.length - 1].date : new Date().toISOString();
  const latestDateObj = new Date(latestDate);

  materialMap.forEach((stat, code) => {
    if (stat.inQty > 0 && stat.inQty > stat.outQty * 1.5) {
      const statDate = new Date(stat.lastDate);
      const monthsSince = Math.max(1, Math.round((latestDateObj.getTime() - statDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      if (monthsSince >= 3) {
        warnings.push({
          id: `warn-stale-${code}`,
          type: 'stale',
          level: monthsSince >= 6 ? 'danger' : 'warning',
          materialCode: code,
          materialName: stat.name,
          message: `积压${monthsSince}个月，入库${Math.round(stat.inQty)}件，出库${Math.round(stat.outQty)}件`,
          currentStock: stat.inQty - stat.outQty,
          threshold: 3,
          baselineDemand: 0,
          monthsSinceLastTransaction: monthsSince,
          suggestion: monthsSince >= 6 ? '考虑折价处理' : '优先调拨使用',
        });
      }
    }
  });

  return warnings;
};

const generateForecast = (trendData: MonthlyTrend[]): ForecastData[] => {
  const result: ForecastData[] = [];

  if (trendData.length === 0) {
    return result;
  }

  const latestMonth = trendData[trendData.length - 1];
  const avgIn = trendData.reduce((s, t) => s + t.inAmount, 0) / trendData.length;
  const avgOut = trendData.reduce((s, t) => s + t.outAmount, 0) / trendData.length;

  const [year, month] = latestMonth.month.split('-').map(Number);
  for (let i = 1; i <= 6; i++) {
    let m = month + i;
    let y = year;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    const forecastIn = Math.round(avgIn * (0.9 + Math.random() * 0.2));
    const forecastOut = Math.round(avgOut * (0.9 + Math.random() * 0.2));
    result.push({
      month: `${y}-${String(m).padStart(2, '0')}`,
      forecastStock: latestMonth.balance + forecastIn - forecastOut,
      forecastInAmount: forecastIn,
      forecastOutAmount: forecastOut,
      inTransitPurchase: Math.round(forecastIn * 0.5),
      salesDemand: forecastOut,
    });
  }

  return result;
};
