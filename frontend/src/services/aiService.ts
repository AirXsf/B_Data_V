/**
 * 豆包 AI（火山引擎方舟）服务
 * 官方接入方式：https://ark.cn-beijing.volces.com/api/v3
 *
 * 支持两种认证方式（自动检测）：
 *   1. 方舟大模型专用 API Key（推荐）：
 *      Authorization: Bearer <api-key>
 *      环境变量：VITE_DOUBAO_API_KEY
 *
 *   2. AK/SK 签名（火山引擎通用 API 签名）：
 *      使用 HMAC-SHA256 计算签名，请求头携带 Authorization
 *      环境变量：VITE_DOUBAO_AK  +  VITE_DOUBAO_SK
 *
 * 模型名称：请根据你在方舟控制台创建的「推理接入点」填写
 *   例如：doubao-1-5-pro-32k-250115、doubao-1-5-pro-250115
 */

import { signVolcengineRequest, hasValidAkSk } from '../utils/volcengineSigner';

export interface AIResponse {
  content: string;
  tokens: number;
  source: 'ai' | 'local';
  authMethod?: 'api-key' | 'ak-sk';
  errorMessage?: string;
}

interface VolcengineResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
  ResponseMetadata?: {
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
  error?: {
    message?: string;
    code?: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_ENDPOINT = `${API_BASE_URL}/api/analyze`;

function getEnvKey(key: string): string | undefined {
  try {
    // Vite 需要静态匹配 import.meta.env，因此必须直接写明 import.meta.env
    // @ts-ignore
    const env = import.meta.env || {};

    console.log("env",env)
    const value = env[key];
    
    // 只在首次调用时 dump 所有 VITE_ 环境变量到 console
    const cacheKey = '_envLogged';
    const storage = getEnvKey as unknown as Record<string, boolean>;
    if (!storage[cacheKey]) {
      storage[cacheKey] = true;
      const allVars = env;
      const keys = Object.keys(allVars).filter((k) => k.startsWith('VITE_'));
      if (keys.length === 0) {
        console.log(
          '%c[AI] 🔑 import.meta.env: 没有检测到任何 VITE_ 开头的变量！',
          'color: #ef4444; font-weight: bold;'
        );
        console.log('%c[AI] 可能原因：1).env 不在项目根目录  2).env 没有 VITE_ 开头的变量  3) 必须重启开发服务器', 'color: #ef4444;');
      } else {
        console.log('%c[AI] 🔑 import.meta.env 中的 VITE_ 变量：', 'color: #3b82f6; font-weight: bold;');
        keys.forEach((k) => {
          const v = allVars[k];
          const masked = v && v.length > 8 ? v.slice(0, 8) + '...' + v.slice(-4) + ' (' + v.length + ')' : v || '(空)';
          console.log('%c[AI]   ' + k + ' = ' + masked, 'color: #3b82f6;');
        });
      }
    }

    return value;
  } catch {
    return undefined;
  }
}

function buildPrompt(
  totalRecords: number,
  materialCount: number,
  totalIn: number,
  totalOut: number,
  warningCount: number,
  lowStockCount: number,
  staleCount: number,
  topMaterials: string[],
  topDepartments: string[],
  trendSummary: string
): string {
  return `你是一位专业的企业存货管理分析专家，擅长从业务视角解读数据分析结果，给出可执行的管理建议。

请基于以下存货管理数据，生成一份结构清晰、内容详实的中文分析报告。

【数据概览】
- 出入库记录数：${totalRecords} 条
- 覆盖物料种类：${materialCount} 种
- 入库总金额：${totalIn.toLocaleString()} 元
- 出库总金额：${totalOut.toLocaleString()} 元
- 预警项数：${warningCount} 项（低库存 ${lowStockCount} 项，积压 ${staleCount} 项）

【重点物料 TOP5】
${topMaterials.map((m, i) => `${i + 1}. ${m}`).join('\n')}

【重点部门 TOP3】
${topDepartments.map((d, i) => `${i + 1}. ${d}`).join('\n')}

【趋势分析】
${trendSummary}

【报告格式要求】
1. 请使用中文输出
2. 使用 Markdown 格式，以 ## 为二级标题、- 为列表项
3. 内容控制在 500~800 字，分 6 个章节：
   ## 一、库存概况
   ## 二、趋势判断
   ## 三、重点物料
   ## 四、部门与项目分析
   ## 五、异常与预警
   ## 六、行动建议
4. 请用管理者视角给出具体、可执行的建议，避免空话套话
5. 对数据中的异常项（如缺口、积压）请具体指出并给出处理优先级
`.trim();
}

/**
 * 核心函数：生成分析报告
 * 优先尝试 API Key（Bearer），再尝试 AK/SK 签名，失败后降级为本地规则
 */
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

    return { content: fullContent.trim(), tokens, source: 'ai', authMethod: 'api-key' };

  } catch (error: any) {
    console.error('[AI] Backend SSE error:', error);
    return {
      ...generateLocalReport(dataSummary),
      errorMessage: `调用后端服务失败: ${error.message}`,
    };
  }
};

/**
 * 方式一：使用 API Key（Bearer Token）调用
 */
async function callWithBearer(apiKey: string, payload: string, onUpdate?: (text: string) => void): Promise<AIResponse | null> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: payload,
    });

    if (!response.ok) {
      let responseText = '';
      try {
        responseText = await response.text();
      } catch {
        // ignore
      }
      let errorMsg = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(responseText) as VolcengineResponse;
        const code = parsed.ResponseMetadata?.Error?.Code || parsed.error?.code;
        const msg = parsed.ResponseMetadata?.Error?.Message || parsed.error?.message;
        if (code || msg) errorMsg += `: [${code}] ${msg}`;
      } catch {
        errorMsg += `: ${response.statusText}`;
      }
      console.warn('[AI] [Bearer] 调用失败:', errorMsg);
      return null;
    }

    if (payload.includes('"stream":true') && onUpdate) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let tokens = 0;

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
            if (trimmedLine.startsWith('data:')) {
              // 处理有时候连着的一长串 json 或者带空格的情况
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.choices?.[0]?.delta?.content) {
                  fullContent += data.choices[0].delta.content;
                  onUpdate(fullContent);
                }
                if (data.usage?.total_tokens) {
                  tokens = data.usage.total_tokens;
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }
      return { content: fullContent.trim(), tokens, source: 'ai', authMethod: 'api-key' };
    } else {
      const responseText = await response.text();
      const data: VolcengineResponse = JSON.parse(responseText);
      if (data.ResponseMetadata?.Error?.Code || data.error?.code) {
        const code = data.ResponseMetadata?.Error?.Code || data.error?.code;
        const msg = data.ResponseMetadata?.Error?.Message || data.error?.message;
        console.warn(`[AI] [Bearer] 业务错误: ${code} - ${msg}`);
        return null;
      }

      const content = data.choices?.[0]?.message?.content || '';
      const tokens = data.usage?.total_tokens || 0;

      if (!content.trim()) {
        console.warn('[AI] [Bearer] 返回内容为空');
        return null;
      }

      console.log(`[AI] [Bearer] 调用成功，使用 ${tokens} tokens`);
      return { content: content.trim(), tokens, source: 'ai', authMethod: 'api-key' };
    }
  } catch (error) {
    console.warn('[AI] [Bearer] 网络异常:', error);
    return null;
  }
}

/**
 * 方式二：使用 AK/SK 签名调用
 */
async function callWithAkSk(ak: string, sk: string, payload: string, onUpdate?: (text: string) => void): Promise<AIResponse | null> {
  try {
    console.log('[AI] [AK/SK] 开始计算签名...');
    const { headers, query } = await signVolcengineRequest(ak, sk, payload);
    console.log('[AI] [AK/SK] 签名完成，签名头:', Object.keys(headers).join(', '));

    const requestUrl = `${API_ENDPOINT}?${query}`;
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: payload,
    });

    if (!response.ok) {
      let responseText = '';
      try {
        responseText = await response.text();
      } catch {
        // ignore
      }
      let errorMsg = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(responseText) as VolcengineResponse;
        const code = parsed.ResponseMetadata?.Error?.Code || parsed.error?.code;
        const msg = parsed.ResponseMetadata?.Error?.Message || parsed.error?.message;
        if (code || msg) errorMsg += `: [${code}] ${msg}`;
      } catch {
        errorMsg += `: ${response.statusText}`;
      }
      console.warn('[AI] [AK/SK] 调用失败:', errorMsg);
      return null;
    }

    if (payload.includes('"stream":true') && onUpdate) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let tokens = 0;

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
            if (trimmedLine.startsWith('data:')) {
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.choices?.[0]?.delta?.content) {
                  fullContent += data.choices[0].delta.content;
                  onUpdate(fullContent);
                }
                if (data.usage?.total_tokens) {
                  tokens = data.usage.total_tokens;
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }
      return { content: fullContent.trim(), tokens, source: 'ai', authMethod: 'ak-sk' };
    } else {
      const responseText = await response.text();
      const data: VolcengineResponse = JSON.parse(responseText);
      if (data.ResponseMetadata?.Error?.Code || data.error?.code) {
        const code = data.ResponseMetadata?.Error?.Code || data.error?.code;
        const msg = data.ResponseMetadata?.Error?.Message || data.error?.message;
        console.warn(`[AI] [AK/SK] 业务错误: ${code} - ${msg}`);
        return null;
      }

      const content = data.choices?.[0]?.message?.content || '';
      const tokens = data.usage?.total_tokens || 0;

      if (!content.trim()) {
        console.warn('[AI] [AK/SK] 返回内容为空');
        return null;
      }

      console.log(`[AI] [AK/SK] 调用成功，使用 ${tokens} tokens`);
      return { content: content.trim(), tokens, source: 'ai', authMethod: 'ak-sk' };
    }
  } catch (error) {
    console.warn('[AI] [AK/SK] 网络异常:', error);
    return null;
  }
}

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
