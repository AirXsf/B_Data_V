import { AlertTriangle, AlertCircle, Package, TrendingDown, Clock } from 'lucide-react';
import type { WarningItem } from '@/types';

interface WarningCardProps {
  warnings: WarningItem[];
}

export const WarningCard = ({ warnings }: WarningCardProps) => {
  const dangerCount = warnings.filter((w) => w.level === 'danger').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  const getIcon = (type: WarningItem['type']) => {
    switch (type) {
      case 'stale':
        return <Clock className="w-5 h-5" />;
      case 'understock':
        return <TrendingDown className="w-5 h-5" />;
      case 'overstock':
        return <Package className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: WarningItem['type']) => {
    switch (type) {
      case 'stale':
        return '呆滞库存';
      case 'understock':
        return '库存不足';
      case 'overstock':
        return '库存积压';
      default:
        return '未知';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">异常预警</h3>
        <div className="flex items-center gap-4">
          {dangerCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded-full flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {dangerCount} 严重
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-600 text-sm rounded-full flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {warningCount} 一般
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {warnings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无预警信息</p>
          </div>
        ) : (
          warnings.map((warning) => (
            <div
              key={warning.id}
              className={`p-4 rounded-lg border-l-4 ${
                warning.level === 'danger'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${
                  warning.level === 'danger' ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {getIcon(warning.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      warning.level === 'danger'
                        ? 'bg-red-200 text-red-700'
                        : 'bg-yellow-200 text-yellow-700'
                    }`}>
                      {getTypeLabel(warning.type)}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {warning.materialCode}
                    </span>
                    <span className="text-sm text-gray-600 truncate">
                      {warning.materialName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{warning.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>当前库存: {warning.currentStock}</span>
                    <span>阈值: {warning.threshold}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};