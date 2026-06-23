import { useState, useCallback, DragEvent } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Brain } from 'lucide-react';
import { generateMockData } from '@/utils/excelParser';
import { analyzeInventoryData } from '@/utils/analytics';
import { useInventoryStore } from '@/store/inventoryStore';
import { AnalysisProgress } from './AnalysisProgress';
import type { InventoryData } from '@/types';

interface UploadZoneProps {
  onComplete: () => void;
}

export const UploadZone = ({ onComplete }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<InventoryData[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { setInventoryData, setStockData, setAnalyticsResult, setLoading, setError: setStoreError } =
    useInventoryStore();

  const handleAnalysisComplete = useCallback(() => {
    setShowAnalysis(false);
    onComplete();
  }, [onComplete]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('请上传Excel文件(.xlsx或.xls格式)');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || '上传失败');
        }

        const result = await response.json();
        
        setPreviewData(result.inventoryData.slice(0, 10));
        setInventoryData(result.inventoryData);
        setStockData(result.stockData || []);
        
        // Ensure warnings array exists to prevent UI crash
        if (result.analyticsResult && !result.analyticsResult.warnings) {
          result.analyticsResult.warnings = [];
        }
        
        setAnalyticsResult(result.analyticsResult);
        setStoreError(null);
        setShowAnalysis(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [setInventoryData, setStockData, setAnalyticsResult, setStoreError]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleMockData = () => {
    setIsLoading(true);
    setError(null);
    setLoading(true);

    try {
      const mockResult = generateMockData();
      setPreviewData(mockResult.data.slice(0, 10));
      setInventoryData(mockResult.data);
      setStockData(mockResult.stockData);
      setAnalyticsResult(analyzeInventoryData(mockResult.data, mockResult.stockData));
      setStoreError(null);
      setShowAnalysis(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {showAnalysis && <AnalysisProgress onComplete={handleAnalysisComplete} />}

      <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div className="text-white">
            <h2 className="text-xl font-bold">存货智能分析AI</h2>
            <p className="text-white/80 text-sm">基于机器学习算法，自动完成数据清洗、关联分析与业务洞察</p>
          </div>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-gray-600">正在解析文件...</p>
          </div>
        ) : (
          <>
            <div
              className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isDragging ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">拖拽Excel文件到此处</h3>
            <p className="text-gray-500 mb-4">支持 .xlsx 和 .xls 格式文件</p>
            <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              选择文件
            </button>
          </>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMockData();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          使用示例数据体验
        </button>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">AI</div>
          <div className="text-xs text-gray-500">智能分析引擎</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">ML</div>
          <div className="text-xs text-gray-500">机器学习模型</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">BI</div>
          <div className="text-xs text-gray-500">商业智能分析</div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <p className="font-medium mb-2">📋 支持的Excel表头字段（自动识别）：</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <span>• 入库日期 / 出库日期</span>
          <span>• 入库类别 / 出库类别</span>
          <span>• 需求部门 / 供应商</span>
          <span>• 需求项目</span>
          <span>• 存货编码 / 物料编码</span>
          <span>• 数量 / 本币无税金额</span>
          <span>• 结存数量 / 结存金额</span>
          <span>• 基础需求数量</span>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {previewData.length > 0 && !isLoading && !showAnalysis && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-700 font-medium">数据导入成功</span>
          </div>
          <p className="text-green-600 text-sm">
            已成功导入 {previewData.length} 条记录（显示前10条预览）
          </p>
        </div>
      )}
    </div>
  );
};
