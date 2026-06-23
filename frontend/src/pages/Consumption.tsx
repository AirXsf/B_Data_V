import { useInventoryStore } from '@/store/inventoryStore';
import { BarChart3, Users, FolderOpen, ArrowUpDown, TrendingUp } from 'lucide-react';

export const Consumption = () => {
  const { analyticsResult } = useInventoryStore();

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

      {/* 1. 部门需求分析 - 各需求部门的入库金额 vs 出库金额 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                {(analyticsResult?.departmentAnalysis || []).map((item, index) => (
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

          {/* 部门柱状图可视化 */}
          <div className="mt-6 space-y-3">
            {(analyticsResult?.departmentAnalysis || []).slice(0, 6).map((item) => {
              const max = Math.max(...(analyticsResult?.departmentAnalysis || []).map((d) => Math.max(d.inAmount, d.outAmount)), 1);
              const inWidth = (item.inAmount / max) * 100;
              const outWidth = (item.outAmount / max) * 100;
              return (
                <div key={item.department} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-800 mb-2">{item.department}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-blue-600 w-16">入库</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${inWidth}%` }}></div>
                      </div>
                      <span className="text-gray-700 text-right w-20">{Math.round(item.inAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-orange-600 w-16">出库</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${outWidth}%` }}></div>
                      </div>
                      <span className="text-gray-700 text-right w-20">{Math.round(item.outAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 项目维度分析 - 按项目汇总采购金额与领用金额 */}
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
                {(analyticsResult?.projectAnalysis || []).map((item, index) => (
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

          {/* 项目柱状对比 */}
          <div className="mt-6 space-y-3">
            {(analyticsResult?.projectAnalysis || []).slice(0, 6).map((item) => {
              const max = Math.max(
                ...(analyticsResult?.projectAnalysis || []).map((d) => Math.max(d.purchaseAmount, d.usedAmount)),
                1
              );
              const inWidth = (item.purchaseAmount / max) * 100;
              const outWidth = (item.usedAmount / max) * 100;
              return (
                <div key={item.project} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-800">{item.project}</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-blue-600 w-16">采购</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${inWidth}%` }}></div>
                      </div>
                      <span className="text-gray-700 text-right w-20">{Math.round(item.purchaseAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-orange-600 w-16">领用</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${outWidth}%` }}></div>
                      </div>
                      <span className="text-gray-700 text-right w-20">{Math.round(item.usedAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. 库存周转率分析 - Top10 & Bottom10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-800">周转率 TOP10（周转快）</h3>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(analyticsResult?.topTurnover || []).map((item, index) => (
              <div key={item.materialCode} className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                <span className="w-8 h-8 bg-green-200 text-green-800 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 font-mono text-sm">{item.materialCode}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    月出库: {Math.round(item.monthlyOutQty).toLocaleString()} | 平均库存: {Math.round(item.avgStock).toLocaleString()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-lg font-bold text-green-700">{item.turnoverRate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <ArrowUpDown className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800">周转率 Bottom10（需关注）</h3>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(analyticsResult?.bottomTurnover || []).map((item, index) => (
              <div key={item.materialCode} className="flex items-center gap-4 p-3 bg-red-50 rounded-lg">
                <span className="w-8 h-8 bg-red-200 text-red-800 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 font-mono text-sm">{item.materialCode}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    月出库: {Math.round(item.monthlyOutQty).toLocaleString()} | 平均库存: {Math.round(item.avgStock).toLocaleString()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-lg font-bold text-red-700">{item.turnoverRate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 部门入库vs出库图表展示 */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">部门入库 vs 出库对比（图表可视化）</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(analyticsResult?.departmentAnalysis || []).slice(0, 5).map((item) => (
            <div key={item.department} className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-100">
              <p className="text-sm font-semibold text-gray-800 mb-3">{item.department}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>入库
                  </span>
                  <span className="text-gray-700 font-medium">{Math.round(item.inAmount).toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (item.inAmount / Math.max(item.inAmount, item.outAmount, 1)) * 100)}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-sm mt-2">
                  <span className="text-orange-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>出库
                  </span>
                  <span className="text-gray-700 font-medium">{Math.round(item.outAmount).toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (item.outAmount / Math.max(item.inAmount, item.outAmount, 1)) * 100)}%` }}
                  ></div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs">
                  <span className="text-gray-500">差额</span>
                  <span className={`font-medium ${item.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.difference >= 0 ? '+' : ''}
                    {Math.round(item.difference).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
