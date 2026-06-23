/**
 * AI 服务层
 * 负责向后端 /api/analyze 接口发送数据并接收流式分析报告
 */

export interface AIResponse {
  content: string;
  tokens: number;
  source: 'ai' | 'local';
  errorMessage?: string;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';
const API_ENDPOINT = `${API_BASE_URL}/api/analyze`;

export const generateAnalysisReport = async (
  dataSummary: {
    totalRecords: number;
    materialCount: number;
    totalIn: number;
    totalOut: number;
    warnings: { total: number; lowStock: number; stale: number };
    topMaterials: string[];
    topDepartments: string[];
    trendSummary: string;
  },
  onUpdate?: (text: string) => void,
  onReasoningStatus?: (isReasoning: boolean) => void
): Promise<AIResponse> => {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(dataSummary),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not yet supported in this browser.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let tokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (trimmedLine === 'data: [DONE]') {
            continue;
        }

        if (trimmedLine.startsWith('data:')) {
          try {
            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            // Extract normal content
            const content = data.choices?.[0]?.delta?.content;
            // Extract reasoning content (DeepSeek/Doubao Pro)
            const reasoningContent = data.choices?.[0]?.delta?.reasoning_content;
            
            let shouldUpdate = false;

            if (reasoningContent) {
                // If we receive reasoning content, trigger the reasoning status callback
                if (onReasoningStatus) {
                    onReasoningStatus(true);
                }
            }

            if (content) {
                // Once we start receiving normal content, reasoning is done
                if (onReasoningStatus) {
                    onReasoningStatus(false);
                }
                fullContent += content;
                shouldUpdate = true;
            }
            
            if (shouldUpdate && onUpdate) {
                onUpdate(fullContent);
            }
            
            // Usage might be sent in the final chunks
            if (data.usage?.total_tokens) {
                tokens = data.usage.total_tokens;
            }
          } catch (e) {
            console.warn('[AI] SSE JSON parse error:', e, trimmedLine);
          }
        }
      }
    }

    return { content: fullContent.trim(), tokens, source: 'ai' };

  } catch (error: any) {
    console.error('[AI] Backend SSE error:', error);
    return {
      ...generateLocalReport(dataSummary),
      errorMessage: `调用后端服务失败: ${error.message}`,
    };
  }
};

// 这里只保留 generateLocalReport 函数

function generateLocalReport(data: {
  totalRecords: number;
  materialCount: number;
  totalIn: number;
  totalOut: number;
  warnings: { total: number; lowStock: number; stale: number };
  topMaterials: string[];
  topDepartments: string[];
  trendSummary: string;
}): { content: string; tokens: number; source: 'local' } {
  const balance = data.totalIn - data.totalOut;
  const balanceText =
    balance > 0
      ? `库存净增 ${Math.abs(balance).toLocaleString()} 元，需关注积压风险`
      : balance < 0
      ? `库存净减 ${Math.abs(balance).toLocaleString()} 元，需关注补货节奏`
      : '出入库基本平衡';

  const report = `## 一、库存概况

基于 ${data.totalRecords} 条出入库记录，覆盖 ${data.materialCount} 种物料的数据分析：
- 入库总金额：**${data.totalIn.toLocaleString()} 元**
- 出库总金额：**${data.totalOut.toLocaleString()} 元**
- ${balanceText}
- 预警项：**${data.warnings.total} 项**（低库存 ${data.warnings.lowStock} 项 / 积压 ${data.warnings.stale} 项）

整体来看，当前数据覆盖度良好，具备进行趋势与构成分析的基础。

## 二、趋势判断

${data.trendSummary || '基于历史月份的出入库数据分析，整体出入库节奏稳定，建议维持现有采购策略并关注异常月份波动。'}

建议持续按月跟踪入库/出库金额曲线，当出现连续 2 个月同向趋势变化时，应及时调整采购计划。

## 三、重点物料

以下物料采购金额排名靠前，需重点关注：

${data.topMaterials.slice(0, 5).map((m) => `- **${m}**`).join('\n')}

对 TOP5 物料建议：
1. 建立专项安全库存模型，定期复核基础需求数量
2. 与供应商签订长期框架协议，锁定采购价格与交付周期
3. 定期盘点（建议每月一次），确保账实相符

## 四、部门与项目分析

主要领用部门 TOP3：
${data.topDepartments.slice(0, 3).map((d) => `- ${d}`).join('\n')}

分析建议：
- 对重点领用部门加强沟通，提前了解下月需求计划
- 对项目型领用，建议建立项目物料预算对比机制，超支项目需提前预警
- 跨部门调拨：优先将积压物料调拨到有需求的部门，减少新采购

## 五、异常与预警

${
  data.warnings.total === 0
    ? '✅ **无显著异常**：库存水平健康，出入库平衡，无需特别干预。'
    : `⚠️ **检测到 ${data.warnings.total} 项异常**：
${data.warnings.lowStock > 0 ? `- 低库存 ${data.warnings.lowStock} 项：当前库存低于基础需求数量，建议**立即启动补货流程**（优先级：高）` : ''}
${data.warnings.stale > 0 ? `- 积压库存 ${data.warnings.stale} 项：物料长期未领用，建议**优先调拨或折价处置**（优先级：中）` : ''}

处理优先级建议：
1. **第一优先级**（低库存且金额较大）：立即下单采购，避免影响生产/项目
2. **第二优先级**（积压 >6 个月）：内部调剂→折价处理→报废清理
3. **第三优先级**（积压 3~6 个月）：纳入月度重点关注清单，跟踪领用进展`
}

## 六、行动建议

📌 **短期（1~2 周）**
- ${data.warnings.lowStock > 0 ? `对 ${data.warnings.lowStock} 项低库存物料启动紧急补货流程，与供应商确认交期` : '低库存风险可控，维持现有库存策略'}
- ${data.warnings.stale > 0 ? `对 ${data.warnings.stale} 项积压物料评估内部调拨可能性，发布处置方案` : '无积压物料，状态良好'}
- 与主要领用部门沟通下月需求预测

📌 **中期（1~3 月）**
- 完善各物料「基础需求数量」维护机制，作为预警基线
- 建立部门/项目领用预算对比机制，超预算领用自动预警
- 引入月度库存健康度评分，持续追踪改进

📌 **长期（6 月+）**
- 引入 ERP 或专业库存管理系统，实现出入库实时监控
- 与核心供应商实现数据协同，推动 JIT 准时化采购
- 建立存货健康度 KPI，纳入部门绩效考核
`.trim();

  return { content: report, tokens: 0, source: 'local' };
}
