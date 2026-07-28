/*
 * @Date: 2026-06-23 14:40:34
 * @LastEditors: wangbiao
 * @Description: 
 * @LastEditTime: 2026-07-28 17:20:31
 */
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

      </div>
    </div>
  );
};