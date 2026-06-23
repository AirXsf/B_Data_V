import { useState, useEffect } from 'react';
import { Brain, Database, BarChart3, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface AnalysisProgressProps {
  onComplete: () => void;
}

const analysisSteps = [
  { id: 'parse', icon: Database, title: '数据解析', desc: '正在解析Excel文件...' },
  { id: 'clean', icon: Database, title: '数据清洗', desc: '正在清洗和标准化数据...' },
  { id: 'validate', icon: CheckCircle, title: '数据校验', desc: '正在校验数据完整性...' },
  { id: 'analyze', icon: Brain, title: 'AI分析', desc: '正在进行智能分析...', isAI: true },
  { id: 'trend', icon: BarChart3, title: '趋势分析', desc: '正在分析采购入库趋势...' },
  { id: 'structure', icon: BarChart3, title: '构成分析', desc: '正在分析库存构成...' },
  { id: 'warning', icon: AlertTriangle, title: '异常检测', desc: '正在检测异常数据...' },
  { id: 'ai_report', icon: Brain, title: 'AI报告', desc: '正在调用AI生成分析报告...', isAI: true },
];

export const AnalysisProgress = ({ onComplete }: AnalysisProgressProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isCompleted) return;

    const totalDuration = 3000;
    const stepDuration = totalDuration / analysisSteps.length;
    
    const runStep = (stepIndex: number) => {
      if (stepIndex >= analysisSteps.length) {
        setIsCompleted(true);
        setTimeout(onComplete, 500);
        return;
      }

      setCurrentStep(stepIndex);
      setProgress(((stepIndex + 1) / analysisSteps.length) * 100);

      setTimeout(() => runStep(stepIndex + 1), stepDuration);
    };

    const timer = setTimeout(() => runStep(0), 500);
    return () => clearTimeout(timer);
  }, [onComplete, isCompleted]);

  return (
    <div className="fixed inset-0 bg-white/95 flex items-center justify-center z-50">
      <div className="max-w-2xl w-full px-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            {isCompleted ? (
              <CheckCircle className="w-10 h-10 text-green-500" />
            ) : (
              <Brain className="w-10 h-10 text-blue-500 animate-pulse" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {isCompleted ? '分析完成' : 'AI智能分析中'}
          </h2>
          <p className="text-gray-500">
            {isCompleted ? '数据分析已完成，正在跳转...' : '正在对您的存货数据进行深度分析'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {analysisSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isActive ? 'bg-blue-500 text-white animate-pulse' :
                    isCompleted ? 'bg-green-100 text-green-600' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {isActive && !isCompleted ? (
                      <Loader2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-blue-600' :
                    isCompleted ? 'text-green-600' :
                    'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
            currentStep >= 3 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {analysisSteps[currentStep]?.desc}
          </div>
        </div>

        {currentStep >= 3 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">AI</div>
              <div className="text-xs text-blue-500">智能分析引擎</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">ML</div>
              <div className="text-xs text-purple-500">机器学习模型</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">BI</div>
              <div className="text-xs text-green-500">商业智能分析</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
