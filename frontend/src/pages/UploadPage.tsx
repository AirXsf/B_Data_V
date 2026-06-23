import { UploadZone } from '@/components/UploadZone';
import { Database, FileSpreadsheet, Cpu } from 'lucide-react';

interface UploadPageProps {
  onComplete: () => void;
}

export const UploadPage = ({ onComplete }: UploadPageProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full mb-6">
            <Cpu className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            存货智能分析AI系统
          </h1>
          <p className="text-gray-600 text-lg">
            上传您的库存数据，AI将自动完成数据清洗、关联分析和业务洞察
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">数据上传</h3>
            <p className="text-sm text-gray-500">支持Excel文件导入，自动识别多种格式</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">智能分析</h3>
            <p className="text-sm text-gray-500">自动完成数据清洗、关联分析和异常检测</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">业务洞察</h3>
            <p className="text-sm text-gray-500">生成可视化图表和智能分析报告</p>
          </div>
        </div>

        <UploadZone onComplete={onComplete} />

        <div className="mt-12 p-6 bg-white rounded-xl shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">支持的数据格式</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>物料编码、物料名称、类别</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>部门、项目、数量、金额</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>日期、类型（入库/出库）</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>基础库存数量</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};