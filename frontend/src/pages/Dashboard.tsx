import { ChartCard } from '@/components/ChartCard';
import { useInventoryStore } from '@/store/inventoryStore';
import { TrendingUp, Package, DollarSign, AlertCircle, BarChart3, PieChart, Activity } from 'lucide-react';

export const Dashboard = () => {
  const { analyticsResult, inventoryData, stockData } = useInventoryStore();

  const totalRecords = inventoryData.length;
  const totalInAmount = inventoryData.filter((d) => d.type === 'in').reduce((s, d) => s + d.amount, 0);
  const totalOutAmount = inventoryData.filter((d) => d.type === 'out').reduce((s, d) => s + d.amount, 0);
  const totalStockBalance = stockData.reduce((s, d) => s + d.balanceAmount, 0);
  const materialCount = new Set(inventoryData.map((item) => item.materialCode)).size;
  const warningCount = analyticsResult?.warnings.filter((w) => w.level === 'danger').length || 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">存货可视化仪表板</h2>
        <p className="text-gray-500">实时监控库存数据，快速掌握库存状况</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">记录总数</p>
              <p className="text-2xl font-bold text-gray-800">{totalRecords.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">物料种类</p>
              <p className="text-2xl font-bold text-gray-800">{Math.max(materialCount, stockData.length)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">结存金额</p>
              <p className="text-2xl font-bold text-gray-800">
                {(totalStockBalance > 0 ? totalStockBalance : totalInAmount - totalOutAmount).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">严重预警</p>
              <p className={`text-2xl font-bold ${warningCount > 0 ? 'text-red-500' : 'text-gray-800'}`}>
                {warningCount}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${warningCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertCircle className={`w-6 h-6 ${warningCount > 0 ? 'text-red-500' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* 1. 采购入库趋势 / 存货结存数据趋势 - 按月展示（折线图） */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">一、采购入库趋势 / 存货结存数据趋势（按月）</h3>
        </div>
        <ChartCard title="入库金额 / 出库金额 / 结存金额 趋势" type="line" data={analyticsResult?.trendData || []} />
      </div>

      {/* 2+3. 入库构成 & 出库构成 - 按类别（饼图） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-800">二、入库构成 - 按入库类别</h3>
          </div>
          <ChartCard title="入库类别金额占比" type="doughnut" data={analyticsResult?.inboundComposition || []} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-5 h-5 text-pink-500" />
            <h3 className="text-lg font-semibold text-gray-800">三、出库构成 - 按出库类别</h3>
          </div>
          <ChartCard title="出库类别金额占比" type="doughnut" data={analyticsResult?.outboundComposition || []} />
        </div>
      </div>

      {/* 4. 库存构成 - 按需求部门 / 需求项目 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-800">四、库存构成 - 按需求部门 / 需求项目</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="按需求部门金额构成" type="doughnut" data={analyticsResult?.departmentComposition || []} />
          <ChartCard title="按需求项目金额构成" type="bar" data={analyticsResult?.projectComposition || []} />
        </div>
      </div>

      {/* 5. 物料TOP分析 - 按入库金额TOP10 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-800">五、物料TOP分析 - 入库金额TOP10物料编码</h3>
        </div>
        <ChartCard title="入库金额TOP10物料" type="bar" data={analyticsResult?.topMaterials || []} />

        {/* 物料TOP10详细表格 */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left font-medium text-gray-600">排名</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">物料编码</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">物料名称</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">入库金额</th>
              </tr>
            </thead>
            <tbody>
              {(analyticsResult?.topMaterials || []).map((m) => (
                <tr key={m.materialCode} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-4">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                      {m.rank}
                    </span>
                  </td>
                  <td className="py-2 px-4 font-mono text-gray-800">{m.materialCode}</td>
                  <td className="py-2 px-4 text-gray-700">{m.materialName}</td>
                  <td className="py-2 px-4 text-right text-gray-800 font-medium">{Math.round(m.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. 库存周转率 Top10 / Bottom10 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            六、库存周转率 Top10 / Bottom10 （周转率 = 月出库量 / 平均库存）
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              周转率 TOP10（高效）
            </h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(analyticsResult?.topTurnover || []).map((item, idx) => (
                <div key={item.materialCode} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                  <span className="w-7 h-7 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{item.materialCode}</div>
                    <div className="text-xs text-gray-500">
                      月出库: {Math.round(item.monthlyOutQty).toLocaleString()} | 平均库存: {Math.round(item.avgStock).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-green-700 flex-shrink-0">{item.turnoverRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              周转率 Bottom10（需关注）
            </h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(analyticsResult?.bottomTurnover || []).map((item, idx) => (
                <div key={item.materialCode} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                  <span className="w-7 h-7 bg-red-200 text-red-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{item.materialCode}</div>
                    <div className="text-xs text-gray-500">
                      月出库: {Math.round(item.monthlyOutQty).toLocaleString()} | 平均库存: {Math.round(item.avgStock).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-700 flex-shrink-0">{item.turnoverRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
