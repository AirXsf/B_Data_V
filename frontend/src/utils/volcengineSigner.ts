/**
 * 火山引擎 API V4 签名算法
 * 参考：https://www.volcengine.com/docs/6458/129810
 *
 * 流程：
 *   1. 构造规范请求 (Canonical Request)
 *   2. 构造待签名字符串 (String to Sign)
 *   3. 计算签名密钥 (Signing Key)
 *   4. 计算签名
 *   5. 将签名添加到请求头
 */

const CANONICAL_URI = '/api/v3/chat/completions';
const SERVICE = 'ark';
const REGION = 'cn-beijing';
const ALGORITHM = 'HMAC-SHA256';

/** 将字符串转换为 ArrayBuffer（UTF-8 编码） */
function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** 字节数组转十六进制字符串 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 使用 Web Crypto API 进行 HMAC-SHA256 */
async function hmacSHA256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, strToBytes(data));
  return new Uint8Array(signature);
}

/** 使用 Web Crypto API 进行 SHA-256 */
async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', strToBytes(data));
  return bytesToHex(new Uint8Array(hash));
}

/** 规范化 URI 路径编码 */
function uriEncode(str: string, encodeSlash = true): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charAt(i);
    if (
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '_' ||
      ch === '-' ||
      ch === '~' ||
      ch === '.'
    ) {
      result += ch;
    } else if (ch === '/') {
      result += encodeSlash ? '%2F' : ch;
    } else {
      result += encodeURIComponent(ch);
    }
  }
  return result;
}

/** 获取规范化日期字符串 */
function getDateStrings(): { xDate: string; shortDate: string } {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hours = pad(now.getUTCHours());
  const minutes = pad(now.getUTCMinutes());
  const seconds = pad(now.getUTCSeconds());
  return {
    xDate: `${year}${month}${day}T${hours}${minutes}${seconds}Z`,
    shortDate: `${year}${month}${day}`,
  };
}

/** 计算规范查询字符串 */
function getCanonicalQueryString(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join('&');
}

/** 计算规范请求头字符串 */
function getCanonicalHeaders(headers: Record<string, string>): {
  canonical: string;
  signed: string;
} {
  const lowercaseKeys = Object.keys(headers).map((k) => k.toLowerCase());
  const sortedKeys = lowercaseKeys.sort();
  const canonical = sortedKeys
    .map((k) => {
      const values = Object.entries(headers)
        .filter(([key]) => key.toLowerCase() === k)
        .map(([, v]) => v.trim().replace(/\s+/g, ' '))
        .join(',');
      return `${k}:${values}\n`;
    })
    .join('');
  const signed = sortedKeys.join(';');
  return { canonical, signed };
}

/**
 * 主函数：为给定请求生成签名头
 * @param ak Access Key ID
 * @param sk Secret Access Key
 * @param payload 请求体 JSON 字符串
 */
export async function signVolcengineRequest(
  ak: string,
  sk: string,
  payload: string
): Promise<{ headers: Record<string, string>; query: string }> {
  const { xDate, shortDate } = getDateStrings();
  const host = `${SERVICE}.${REGION}.volces.com`;

  // 构造请求头（需要参与签名的头）
  // 浏览器环境中，fetch 会自动添加或覆盖 Host 头为当前页面的 origin (localhost)
  // 如果签名的 Host 和实际发出的 Host 不一致，火山引擎会报错 401
  // 因此，纯前端直接请求火山引擎 API，如果使用 AK/SK 签名是非常容易因为浏览器安全机制而失败的
  const headersToSign: Record<string, string> = {
    // 移除 host 签名，或者强制指定
    // 'host': host, 
    'x-content-sha256': await sha256Hex(payload),
    'x-date': xDate,
  };

  // 构造查询字符串（需要参与签名的参数）
  const queryParams: Record<string, string> = {
    'X-Algorithm': ALGORITHM,
    'X-Credential': `${ak}/${shortDate}/${REGION}/${SERVICE}/request`,
    'X-Date': xDate,
    'X-SignedHeaders': 'x-content-sha256;x-date', // 移除了 host
  };

  // Step 1: 构造规范请求
  const { canonical: canonicalHeaders, signed: signedHeaders } = getCanonicalHeaders(headersToSign);
  const canonicalQueryString = getCanonicalQueryString(queryParams);
  const canonicalRequest = [
    'POST',
    CANONICAL_URI,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    headersToSign['x-content-sha256'],
  ].join('\n');

  // Step 2: 构造待签名字符串
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = [
    ALGORITHM,
    xDate,
    `${shortDate}/${REGION}/${SERVICE}/request`,
    hashedCanonicalRequest,
  ].join('\n');

  // Step 3: 计算签名密钥
  const kDate = await hmacSHA256(strToBytes(sk), shortDate);
  const kRegion = await hmacSHA256(kDate, REGION);
  const kService = await hmacSHA256(kRegion, SERVICE);
  const kSigning = await hmacSHA256(kService, 'request');

  // Step 4: 计算签名
  const signatureBytes = await hmacSHA256(kSigning, stringToSign);
  const signature = bytesToHex(signatureBytes);

  // Step 5: 组装最终请求头
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-content-sha256': headersToSign['x-content-sha256'],
    'x-date': xDate,
    Authorization: `${ALGORITHM} Credential=${ak}/${shortDate}/${REGION}/${SERVICE}/request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };

  return {
    headers: finalHeaders,
    query: canonicalQueryString,
  };
}

/**
 * 检查环境中是否配置了有效的 AK/SK
 * 返回具体哪一个缺失
 */
export function hasValidAkSk(ak: string | undefined, sk: string | undefined): {
  valid: boolean; reason?: string } {
  if (!ak || ak.trim().length < 8) return { valid: false, reason: 'AK 为空或长度不足' };
  if (!sk || sk.trim().length < 8) return { valid: false, reason: 'SK 为空或长度不足' };
  if (ak.includes('your-') || ak.includes('AK 示例') || ak.includes('示例')) return { valid: false, reason: 'AK 是占位符，请替换为真实的 AK' };
  if (sk.includes('your-') || sk.includes('SK 示例') || sk.includes('示例')) return { valid: false, reason: 'SK 是占位符，请替换为真实的 SK' };
  return { valid: true };
}
