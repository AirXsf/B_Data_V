import { useInventoryStore } from '@/store/inventoryStore';
import { AlertTriangle, Package, AlertOctagon, TrendingUp, Calendar } from 'lucide-react';

export const Warnings = () => {
  const { analyticsResult, inventoryData } = useInventoryStore();

  const lowStockItems = analyticsResult?.warnings.filter((w) => w.type === 'low_stock') || [];
  const staleItems = analyticsResult?.warnings.filter((w) => w.type === 'stale') || [];
  const totalAmountLow = lowStockItems.reduce((s, w) => s + (w.currentStock || 0), 0);
  const totalAmountStale = staleItems.reduce((s, w) => s + (w.currentStock || 0), 0);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'danger':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'danger':
        return '危险';
      case 'warning':
        return '预警';
      default:
        return '提示';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">采购决策与异常预警</h2>
        <p className="text-gray-500">基于智能算法识别异常库存，提供采购决策依据</p>
      </div>

      {/* 预警总览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className={`rounded-xl p-6 shadow-sm border-2 ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-red-200' : 'bg-gray-200'}`}>
              <AlertTriangle className={`w-7 h-7 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">低库存预警项</p>
              <p className={`text-3xl font-bold ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {lowStockItems.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">当前库存低于基础需求数量</p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border-2 ${staleItems.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${staleItems.length > 0 ? 'bg-yellow-200' : 'bg-gray-200'}`}>
              <Package className={`w-7 h-7 ${staleItems.length > 0 ? 'text-yellow-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">积压库存预警项</p>
              <p className={`text-3xl font-bold ${staleItems.length > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                {staleItems.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">库存积压天数超过阈值</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-blue-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-200 rounded-xl flex items-center justify-center">
              <AlertOctagon className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">总预警项数</p>
              <p className="text-3xl font-bold text-blue-600">{analyticsResult?.warnings.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">需关注的异常物料</p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. 积压库存预警 - 超过3个月标黄 / 超过6个月标红 */}
      <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-800">一、积压库存预警（积压天数＞3个月标黄，＞6个月标红）</h3>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                <span className="text-gray-600">＞3个月</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-gray-600">＞6个月</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            共 {staleItems.length} 项积压物料（涉及库存量 {totalAmountStale.toLocaleString()} 件），建议优先清理或调剂使用
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">物料编码</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">物料名称</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">当前库存</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">积压天数</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">建议措施</th>
                <th className="py-3 px-4 text-center text-sm font-medium text-gray-600">等级</th>
              </tr>
            </thead>
            <tbody>
              {staleItems.length > 0 ? (
                staleItems.map((item, index) => (
                  <tr
                    key={item.materialCode}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${
                      item.level === 'danger' ? 'bg-red-50/60' : 'bg-yellow-50/60'
                    }`}
                  >
                    <td className="py-3 px-4 text-sm font-mono font-medium text-gray-800">{item.materialCode}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{item.materialName}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-700 font-medium">
                      {Math.round(item.currentStock || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-700 font-medium">
                      {Math.round(item.monthsSinceLastTransaction || 0) * 30}天
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.suggestion}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(item.level)}`}>
                        {getLevelLabel(item.level)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-sm text-gray-500">
                    暂无积压库存预警
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. 低库存预警 - 基于基础需求数量判断 */}
      <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800">二、低库存预警（当前库存＜基础需求数量）</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            共 {lowStockItems.length} 项物料库存低于基础需求（涉及缺口约 {totalAmountLow.toLocaleString()} 件），建议及时补货
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">物料编码</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">物料名称</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">当前库存</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">基础需求</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-600">缺口数量</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">建议措施</th>
                <th className="py-3 px-4 text-center text-sm font-medium text-gray-600">等级</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item, index) => {
                  const gap = (item.baselineDemand || 0) - (item.currentStock || 0);
                  return (
                    <tr
                      key={item.materialCode}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${
                        item.level === 'danger' ? 'bg-red-50/60' : 'bg-yellow-50/60'
                      }`}
                    >
                      <td className="py-3 px-4 text-sm font-mono font-medium text-gray-800">{item.materialCode}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{item.materialName}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-700 font-medium">
                        {Math.round(item.currentStock || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-700 font-medium">
                        {Math.round(item.baselineDemand || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-red-600 font-medium">-{Math.round(gap).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{item.suggestion}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(item.level)}`}>
                          {getLevelLabel(item.level)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-sm text-gray-500">
                    暂无低库存预警
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 采购与库存预测趋势 - 按月预测（折线图） */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">三、采购与库存预测趋势（基于历史数据智能预测）</h3>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-500">覆盖未来6个月</span>
          </div>
        </div>

        {/* 预测数据表格 */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left font-medium text-gray-600">月份</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">预测入库金额</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">预测出库金额</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">预测结存</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">趋势分析</th>
              </tr>
            </thead>
            <tbody>
              {(analyticsResult?.forecastData || []).map((item, index) => {
                const isIncreasing = (item.forecastOutAmount || 0) > (item.forecastInAmount || 0) * 0.9;
                return (
                  <tr key={item.month} className={`border-b border-gray-50 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="py-3 px-4 font-medium text-gray-800">{item.month}</td>
                    <td className="py-3 px-4 text-right text-blue-700 font-medium">
                      {Math.round(item.forecastInAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-700 font-medium">
                      {Math.round(item.forecastOutAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-800 font-medium">
                      {Math.round((item.forecastInAmount || 0) - (item.forecastOutAmount || 0)).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {isIncreasing ? '📈 出库趋势上升，建议适当加大采购' : '📊 需求稳定，维持现有策略'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 预测趋势图 - 用横向进度条模拟可视化 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-4">预测入库金额趋势</h4>
            <div className="space-y-3">
              {(analyticsResult?.forecastData || []).map((item) => {
                const maxIn = Math.max(...(analyticsResult?.forecastData || []).map((d) => d.forecastInAmount || 0), 1);
                const width = ((item.forecastInAmount || 0) / maxIn) * 100;
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-gray-600 font-medium">{item.month}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${width}%` }}></div>
                    </div>
                    <span className="w-24 text-right text-xs text-gray-700 font-medium">
                      {Math.round(item.forecastInAmount || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-50 to-pink-50 rounded-lg border border-orange-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-4">预测出库金额趋势</h4>
            <div className="space-y-3">
              {(analyticsResult?.forecastData || []).map((item) => {
                const maxOut = Math.max(...(analyticsResult?.forecastData || []).map((d) => d.forecastOutAmount || 0), 1);
                const width = ((item.forecastOutAmount || 0) / maxOut) * 100;
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-gray-600 font-medium">{item.month}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-500 h-3 rounded-full" style={{ width: `${width}%` }}></div>
                    </div>
                    <span className="w-24 text-right text-xs text-gray-700 font-medium">
                      {Math.round(item.forecastOutAmount || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 智能采购建议 */}
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 智能采购决策建议
          </h4>
          <p className="text-sm text-green-700 leading-relaxed">
            基于历史 {inventoryData.length} 条出入库数据及预测趋势分析：
            {analyticsResult?.forecastData && analyticsResult.forecastData.length > 0
              ? analyticsResult.forecastData
                  .map((f) => `${f.month}预测${Math.round(f.forecastInAmount || 0).toLocaleString()}元`)
                  .join('；') + '。'
              : ''}
            建议：
            {lowStockItems.length > 0 ? `①立即补货 ${lowStockItems.length} 项低库存物料；` : '①库存水平良好；'}
            {staleItems.length > 0 ? `②优先清理 ${staleItems.length} 项积压库存；` : '②无积压库存；'}
            ③维持现有采购节奏，根据部门项目需求灵活调整。
          </p>
        </div>
      </div>
    </div>
  );
};
