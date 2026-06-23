import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { MonthlyTrend, CategoryComposition, MaterialRanking, ForecastData } from '@/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartCardProps {
  title: string;
  type: 'line' | 'bar' | 'doughnut';
  data: MonthlyTrend[] | CategoryComposition[] | MaterialRanking[] | ForecastData[];
  colorScheme?: string[];
}

export const ChartCard = ({ title, type, data, colorScheme }: ChartCardProps) => {
  const colors = colorScheme || [
    '#2563eb',
    '#f59e0b',
    '#10b981',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1',
  ];

  const isForecast = data.length > 0 && 'forecastStock' in data[0];

  const lineData = isForecast ? {
    labels: (data as ForecastData[]).map((d) => d.month),
    datasets: [
      {
        label: '预测库存',
        data: (data as ForecastData[]).map((d) => d.forecastStock),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: '在途采购',
        data: (data as ForecastData[]).map((d) => d.inTransitPurchase),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: '销售需求',
        data: (data as ForecastData[]).map((d) => d.salesDemand),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  } : {
    labels: (data as MonthlyTrend[]).map((d) => d.month),
    datasets: [
      {
        label: '入库金额',
        data: (data as MonthlyTrend[]).map((d) => d.inAmount),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: '出库金额',
        data: (data as MonthlyTrend[]).map((d) => d.outAmount),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: '结存金额',
        data: (data as MonthlyTrend[]).map((d) => d.balance),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const barData = {
    labels: type === 'bar' && 'materialCode' in (data[0] as MaterialRanking)
      ? (data as MaterialRanking[]).map((d) => d.materialCode)
      : (data as CategoryComposition[]).map((d) => d.materialCode),
    datasets: [
      {
        label: type === 'bar' && 'amount' in (data[0] as MaterialRanking)
          ? '采购金额'
          : '金额',
        data: type === 'bar' && 'amount' in (data[0] as MaterialRanking)
          ? (data as MaterialRanking[]).map((d) => d.amount)
          : (data as CategoryComposition[]).map((d) => d.amount),
        backgroundColor: colors.slice(0, data.length),
        borderRadius: 8,
      },
    ],
  };

  const doughnutData = {
    labels: (data as CategoryComposition[]).map((d) => d.materialName),
    datasets: [
      {
        data: (data as CategoryComposition[]).map((d) => {
          // If the percentage is > 0 but extremely small, give it a tiny visual boost
          // so it at least appears as a sliver on the chart instead of disappearing.
          // The actual tooltip will still show the correct true amount/percentage.
          const val = d.amount;
          const total = (data as CategoryComposition[]).reduce((sum, item) => sum + item.amount, 0);
          if (val > 0 && total > 0) {
            const ratio = val / total;
            // If it's less than 0.5%, artificially boost it slightly for visual rendering only
            if (ratio < 0.005) {
               return total * 0.005;
            }
          }
          return val;
        }),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            // For doughnut charts, show the real data, not the visually boosted data
            if (type === 'doughnut') {
               const originalData = data as CategoryComposition[];
               const index = context.dataIndex;
               if (originalData[index]) {
                   const item = originalData[index];
                   return ` ${item.materialName}: ${item.amount.toLocaleString()} 元 (${item.percentage.toFixed(2)}%)`;
               }
            }
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('zh-CN').format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: type !== 'doughnut' ? {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            if (numValue >= 10000) {
              return (numValue / 10000).toFixed(1) + '万';
            }
            return numValue.toString();
          },
        },
      },
    } : undefined,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="h-64">
        {type === 'line' && <Line data={lineData} options={options} />}
        {type === 'bar' && <Bar data={barData} options={options} />}
        {type === 'doughnut' && <Doughnut data={doughnutData} options={options} />}
      </div>
    </div>
  );
};