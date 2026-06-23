import { useState } from 'react';
import { useInventoryStore } from '@/store/inventoryStore';
import { FileText, Brain, TrendingUp, AlertTriangle, Sparkles, BarChart3, Loader2, ShieldCheck } from 'lucide-react';
import { generateAnalysisReport } from '@/services/aiService';

export const Analysis = () => {
  const { inventoryData, analyticsResult, stockData } = useInventoryStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [source, setSource] = useState<'ai' | 'local' | ''>('');
  const [tokens, setTokens] = useState(0);

  // Markdown 解析渲染相关的简单组件或配置
  const formatMarkdown = (text: string) => {
    // 简单的 Markdown 解析，支持粗体、列表和段落
    if (!text) return null;

    const lines = text.split('\n');
    let inList = false;
    let listItems: JSX.Element[] = [];
    const elements: JSX.Element[] = [];

    const flushList = () => {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-6 mb-4 space-y-1">{[...listItems]}</ul>);
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      // 匹配二级标题 ##
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-xl font-bold text-gray-800 mt-6 mb-3 border-b border-gray-100 pb-2">
            {line.replace('## ', '')}
          </h2>
        );
      }
      // 匹配列表项 - 或 1.
      else if (line.trim().startsWith('- ') || /^\d+\.\s/.test(line.trim())) {
        inList = true;
        const content = line.trim().replace(/^- /, '').replace(/^\d+\.\s/, '');
        
        // 处理粗体 **text**
        const parts = content.split(/(\*\*.*?\*\*)/g);
        const formattedContent = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        listItems.push(<li key={index} className="text-gray-700 leading-relaxed">{formattedContent}</li>);
      }
      // 空行
      else if (line.trim() === '') {
        flushList();
        elements.push(<div key={index} className="h-2"></div>);
      }
      // 普通段落
      else {
        flushList();
        
        // 处理粗体 **text**
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedContent = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        elements.push(<p key={index} className="mb-3 text-gray-700 leading-relaxed">{formattedContent}</p>);
      }
    });

    flushList();
    return elements;
  };

  const totalIn = inventoryData.filter((d) => d.type === 'in').reduce((s, d) => s + d.amount, 0);
  const totalOut = inventoryData.filter((d) => d.type === 'out').reduce((s, d) => s + d.amount, 0);
  const materialCount = new Set(inventoryData.map((item) => item.materialCode)).size;
  const lowStockCount = analyticsResult?.warnings.filter((w) => w.type === 'low_stock').length || 0;
  const staleCount = analyticsResult?.warnings.filter((w) => w.type === 'stale').length || 0;
  const warningCount = (analyticsResult?.warnings.length || 0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedText('');
    setSource('');
    setTokens(0);

    // 准备摘要数据（用于本地 fallback 或 AI 提示词）
    const topMaterials = (analyticsResult?.topMaterials || []).slice(0, 5)
      .map((m) => `${m.materialCode}（${Math.round(m.amount).toLocaleString()} 元）`);

    const topDepartments = (analyticsResult?.departmentAnalysis || []).slice(0, 3)
      .map((d) => `${d.department}（入 ${Math.round(d.inAmount).toLocaleString()} / 出 ${Math.round(d.outAmount).toLocaleString()}）`);

    const trendData = analyticsResult?.trendData || [];
    const recentTrend = trendData.slice(-3);
    let trendSummary = '数据量充足，趋势分析有效。';
    if (recentTrend.length >= 2) {
      const avgIn = recentTrend.reduce((s, t) => s + t.inAmount, 0) / recentTrend.length;
      const avgOut = recentTrend.reduce((s, t) => s + t.outAmount, 0) / recentTrend.length;
      if (avgIn > avgOut * 1.1) {
        trendSummary = `近 ${recentTrend.length} 个月入库持续高于出库，库存呈上升趋势，需控制采购节奏，警惕积压。`;
      } else if (avgOut > avgIn * 1.1) {
        trendSummary = `近 ${recentTrend.length} 个月出库持续高于入库，库存呈下降趋势，需关注补货及时性，避免缺货。`;
      } else {
        trendSummary = `近 ${recentTrend.length} 个月出入库基本平衡，库存水平稳定，现有策略有效，可维持。`;
      }
    }

    try {
      const result = await generateAnalysisReport({
        totalRecords: inventoryData.length,
        materialCount,
        totalIn,
        totalOut,
        warnings: {
          total: warningCount,
          lowStock: lowStockCount,
          stale: staleCount,
        },
        topMaterials,
        topDepartments,
        trendSummary,
      }, (text) => {
        setGeneratedText(text);
        setSource('ai');
      }, (reasoningStatus) => {
        setIsReasoning(reasoningStatus);
      });

      setGeneratedText(result.content);
      setSource(result.source);
      setTokens(result.tokens);
    } catch (error) {
      console.error('[Analysis] 生成报告失败:', error);
      setGeneratedText('报告生成失败，请检查网络连接或稍后重试。');
      setSource('local');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText).then(() => {
      alert('分析报告已复制到剪贴板！');
    });
  };

  const handleDownload = () => {
    if (!generatedText) return;
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `存货智能分析报告_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 🔑 环境变量诊断卡片（始终显示）
  const renderConfigStatus = () => {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-green-600" />
          系统配置状态
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-2">已接入独立后端服务进行 AI 调用，无需在前端配置大模型密钥。</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI 智能文本分析报告</h2>
        <p className="text-gray-500">基于数据分析结果，自动生成可读、可执行的管理洞察与行动建议</p>
      </div>

      {/* 操作区域 */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">豆包 AI 智能分析引擎</span>
            </div>
            <p className="text-sm text-white/90">
              基于 {inventoryData.length} 条历史数据 + {stockData.length} 条结存数据，生成专业分析报告
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || inventoryData.length === 0}
              className="bg-white text-indigo-600 px-6 py-2.5 rounded-lg font-medium hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 分析中...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  生成智能分析报告
                </>
              )}
            </button>
            {generatedText && (
              <>
                <button
                  onClick={handleCopyText}
                  className="bg-white/20 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-white/30 transition flex items-center gap-2"
                >
                  📋 复制报告
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-white/20 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-white/30 transition flex items-center gap-2"
                >
                  📥 下载TXT
                </button>
              </>
            )}
          </div>
        </div>

        {/* 信息条 */}
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-white/80" />
            <span className="text-white/80">数据量：{inventoryData.length.toLocaleString()} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-white/80" />
            <span className="text-white/80">物料：{materialCount} 种</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white/80" />
            <span className="text-white/80">预警：{warningCount} 项</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white/80" />
            <span className="text-white/80">
              数据源：上传的原始数据
            </span>
          </div>
        </div>
      </div>

      {/* 分析结果区域 */}
      {isReasoning ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-indigo-200 rounded-full animate-ping opacity-75"></div>
            <div className="relative flex items-center justify-center w-full h-full bg-white rounded-full shadow-sm border border-indigo-100">
              <Brain className="w-8 h-8 text-indigo-500 animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            AI 深度思考中...
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            正在分析存货趋势、挖掘异常数据并构思专业管理建议，请稍候。
          </p>
        </div>
      ) : generatedText ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {source === 'ai' ? (
                <Brain className="w-5 h-5 text-indigo-500" />
              ) : (
                <FileText className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  存货智能分析报告
                  <span className="ml-2 text-sm font-normal">
                    {source === 'ai' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
                        <Brain className="w-3 h-3 mr-1" /> 豆包 AI 生成 · {tokens} tokens
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                        <FileText className="w-3 h-3 mr-1" /> 本地规则引擎
                      </span>
                    )}
                  </span>
                </h3>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="text-sm font-sans leading-relaxed">
              {formatMarkdown(generatedText)}
              {isGenerating && (
                <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse align-middle"></span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Brain className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {inventoryData.length > 0 ? '点击上方按钮生成分析报告' : '请先上传数据文件'}
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {inventoryData.length > 0
              ? '报告将包含库存概况、趋势判断、重点物料、部门分析、异常预警与行动建议六大模块。'
              : '上传出入库与结存数据后，将自动进行数据分析并生成智能报告。'}
          </p>
        </div>
      )}
    </div>
  );
};
