import { useInventoryStore } from '@/store/inventoryStore';
import { BarChart3, Users, FolderOpen } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Consumption = () => {
  const { analyticsResult } = useInventoryStore();
  const departmentAnalysis = [...(analyticsResult?.departmentAnalysis || [])].sort((a, b) =>
    a.department.localeCompare(b.department, 'zh-CN')
  );
  const projectNumber = (project: string) => {
    const match = project.match(/(\d+)\s*$/);
    return match ? Number(match[1]) : -1;
  };
  const projectAnalysis = [...(analyticsResult?.projectAnalysis || [])].sort(
    (a, b) => projectNumber(b.project) - projectNumber(a.project)
  );
  const projectChartItems = projectAnalysis;

  const departmentBarData = {
    labels: departmentAnalysis.map((item) => item.department),
    datasets: [
      {
        label: '入库金额',
        data: departmentAnalysis.map((item) => item.inAmount),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
      },
      {
        label: '出库金额',
        data: departmentAnalysis.map((item) => item.outAmount),
        backgroundColor: '#f97316',
        borderRadius: 6,
      },
    ],
  };

  const departmentBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            if (numValue >= 10000) {
              return `${(numValue / 10000).toFixed(1)}万`;
            }
            return numValue.toString();
          },
        },
      },
    },
  };

  const projectBarData = {
    labels: projectChartItems.map((item) => item.project),
    datasets: [
      {
        label: '采购金额',
        data: projectChartItems.map((item) => item.purchaseAmount),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
      },
      {
        label: '领用金额',
        data: projectChartItems.map((item) => item.usedAmount),
        backgroundColor: '#f97316',
        borderRadius: 6,
      },
    ],
  };

  const projectBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    layout: {
      padding: {
        left: 12,
        right: 12,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          afterBody: (items: any[]) => {
            const index = items?.[0]?.dataIndex;
            const item = typeof index === 'number' ? projectChartItems[index] : undefined;
            return item ? `状态：${getStatusLabel(item.status)}` : '';
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          autoSkip: false,
          font: {
            size: 11,
          },
          padding: 8,
        },
      },
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            if (numValue >= 10000) {
              return `${(numValue / 10000).toFixed(1)}万`;
            }
            return numValue.toString();
          },
        },
      },
    },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overbudget':
        return 'text-red-500 bg-red-50';
      case 'waste':
        return 'text-yellow-500 bg-yellow-50';
      default:
        return 'text-green-500 bg-green-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overbudget':
        return '超支';
      case 'waste':
        return '积压';
      default:
        return '正常';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">部门 / 项目领用消耗分析</h2>
        <p className="text-gray-500">分析各部门及项目的物料领用与消耗情况</p>
      </div>

      <div className="space-y-6">
        {/* 1. 部门需求分析 - 表格在上，柱状图在下 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">一、部门需求分析 - 各部门入库金额 vs 出库金额</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">部门</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">入库金额</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">出库金额</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">差额</th>
                </tr>
              </thead>
              <tbody>
                {departmentAnalysis.map((item, index) => (
                  <tr
                    key={item.department}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">{item.department}</td>
                    <td className="py-3 px-4 text-sm text-blue-700 text-right font-medium">
                      {Math.round(item.inAmount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-orange-700 text-right font-medium">
                      {Math.round(item.outAmount).toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm font-medium text-right ${
                        item.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {item.difference >= 0 ? '+' : ''}
                      {Math.round(item.difference).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h4 className="text-base font-semibold text-gray-800">部门入库 vs 出库柱状图</h4>
            </div>
            <div className="h-80">
              <Bar data={departmentBarData} options={departmentBarOptions} />
            </div>
          </div>
        </div>

        {/* 2. 项目维度分析 - 独立放在下面 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <FolderOpen className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800">二、项目维度分析 - 按项目采购金额 vs 领用金额</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">项目</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">采购金额</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">领用金额</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-600">状态</th>
                </tr>
              </thead>
              <tbody>
                {projectAnalysis.map((item, index) => (
                  <tr
                    key={item.project}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">{item.project}</td>
                    <td className="py-3 px-4 text-sm text-blue-700 text-right font-medium">
                      {Math.round(item.purchaseAmount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-orange-700 text-right font-medium">
                      {Math.round(item.usedAmount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h4 className="text-base font-semibold text-gray-800">项目采购 vs 领用柱状图</h4>
            </div>
            <div className="max-h-[560px] overflow-y-auto overflow-x-hidden pr-2">
              <div style={{ height: `${Math.max(420, projectChartItems.length * 32)}px` }}>
                <Bar data={projectBarData} options={projectBarOptions} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">状态说明</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-green-500 bg-green-50">正常</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-yellow-500 bg-yellow-50">积压</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-red-500 bg-red-50">超支</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
