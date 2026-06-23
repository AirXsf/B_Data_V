import * as XLSX from 'xlsx';
import type { InventoryData, StockData } from '../types';

interface ParsedExcelResult {
  data: InventoryData[];
  stockData: StockData[];
}

const safeString = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim();
};

const safeNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? 0 : num;
};

const parseDate = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  const str = String(value).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length >= 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  if (str.includes('-')) {
    return str;
  }
  return str;
};

const findColumnIndex = (headers: string[], ...candidates: string[]): number => {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => safeString(h).includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
};

export const parseExcelFile = async (file: File): Promise<ParsedExcelResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);

  let inData: InventoryData[] = [];
  let outData: InventoryData[] = [];
  let stockData: StockData[] = [];

  // 查找三个工作表
  const inSheetName =
    workbook.SheetNames.find((name) => /入|采购|purchase|in/i.test(name)) || workbook.SheetNames[0];
  const outSheetName =
    workbook.SheetNames.find((name) => /出|领|issue|out/i.test(name)) || workbook.SheetNames[1] || workbook.SheetNames[0];
  const stockSheetName =
    workbook.SheetNames.find((name) => /结存|库存|stock|summary|汇总/i.test(name)) || workbook.SheetNames[2] || workbook.SheetNames[0];

  // 解析入库表
  if (inSheetName) {
    const inSheet = workbook.Sheets[inSheetName];
    if (inSheet) {
      const inRawData = XLSX.utils.sheet_to_json<any[]>(inSheet, { header: 1 });
      if (inRawData.length >= 2) {
        const headers = inRawData[0].map((h) => safeString(h));
        const dataRows = inRawData.slice(1);

        const dateIdx = findColumnIndex(headers, '日期', '单据', 'date');
        const materialCodeIdx = findColumnIndex(headers, '存货编码', '物料编码', '编码', 'code');
        const materialNameIdx = findColumnIndex(headers, '存货名称', '物料名称', '名称', 'material');
        const quantityIdx = findColumnIndex(headers, '数量', '入库数量', 'qty');
        const amountIdx = findColumnIndex(headers, '金额', '本币无税金额', '总价', 'amount');
        const categoryIdx = findColumnIndex(headers, '入库类别', '类别', 'category');
        const departmentIdx = findColumnIndex(headers, '需求部门', '部门', 'department');
        const projectIdx = findColumnIndex(headers, '需求项目', '项目', 'project');
        const supplierIdx = findColumnIndex(headers, '供应商', 'supplier');
        const unitPriceIdx = findColumnIndex(headers, '单价', '本币无税单价', 'unit');
        const baseStockIdx = findColumnIndex(headers, '基础需求数量', '基础库存', 'base');

        const parsed: InventoryData[] = [];
        for (const row of dataRows) {
          if (!row || row.every((cell) => !cell)) continue;
          const qty = safeNumber(quantityIdx >= 0 ? row[quantityIdx] : 0);
          if (qty <= 0) continue;

          const amt = safeNumber(amountIdx >= 0 ? row[amountIdx] : 0);
          const materialCode = safeString(materialCodeIdx >= 0 ? row[materialCodeIdx] : '');
          if (!materialCode) continue;

          parsed.push({
            id: `in-${parsed.length + 1}`,
            materialCode,
            materialName: safeString(materialNameIdx >= 0 ? row[materialNameIdx] : materialCode),
            category: safeString(categoryIdx >= 0 ? row[categoryIdx] : '采购入库'),
            department: safeString(departmentIdx >= 0 ? row[departmentIdx] : '待分配'),
            project: safeString(projectIdx >= 0 ? row[projectIdx] : '待分配'),
            quantity: qty,
            amount: amt > 0 ? amt : qty * 100,
            date: parseDate(dateIdx >= 0 ? row[dateIdx] : new Date()),
            type: 'in',
            baseStock: safeNumber(baseStockIdx >= 0 ? row[baseStockIdx] : 0),
            unitPrice: safeNumber(unitPriceIdx >= 0 ? row[unitPriceIdx] : 0),
            supplier: safeString(supplierIdx >= 0 ? row[supplierIdx] : '未指定'),
          });
        }
        inData = parsed;
      }
    }
  }

  // 解析出库表
  if (outSheetName && outSheetName !== inSheetName) {
    const outSheet = workbook.Sheets[outSheetName];
    if (outSheet) {
      const outRawData = XLSX.utils.sheet_to_json<any[]>(outSheet, { header: 1 });
      if (outRawData.length >= 2) {
        const headers = outRawData[0].map((h) => safeString(h));
        const dataRows = outRawData.slice(1);

        const dateIdx = findColumnIndex(headers, '日期', '单据', 'date');
        const materialCodeIdx = findColumnIndex(headers, '存货编码', '物料编码', '编码', 'code');
        const materialNameIdx = findColumnIndex(headers, '存货名称', '物料名称', '名称', 'material');
        const quantityIdx = findColumnIndex(headers, '数量', '出库数量', 'qty');
        const amountIdx = findColumnIndex(headers, '金额', '本币无税金额', '总价', 'amount');
        const categoryIdx = findColumnIndex(headers, '出库类别', '类别', 'category');
        const departmentIdx = findColumnIndex(headers, '需求部门', '部门', 'department');
        const projectIdx = findColumnIndex(headers, '需求项目', '项目', 'project');
        const unitPriceIdx = findColumnIndex(headers, '单价', '本币无税单价', 'unit');

        const parsed: InventoryData[] = [];
        for (const row of dataRows) {
          if (!row || row.every((cell) => !cell)) continue;
          const qty = safeNumber(quantityIdx >= 0 ? row[quantityIdx] : 0);
          if (qty <= 0) continue;

          const amt = safeNumber(amountIdx >= 0 ? row[amountIdx] : 0);
          const materialCode = safeString(materialCodeIdx >= 0 ? row[materialCodeIdx] : '');
          if (!materialCode) continue;

          parsed.push({
            id: `out-${parsed.length + 1}`,
            materialCode,
            materialName: safeString(materialNameIdx >= 0 ? row[materialNameIdx] : materialCode),
            category: safeString(categoryIdx >= 0 ? row[categoryIdx] : '生产领用'),
            department: safeString(departmentIdx >= 0 ? row[departmentIdx] : '待分配'),
            project: safeString(projectIdx >= 0 ? row[projectIdx] : '待分配'),
            quantity: qty,
            amount: amt > 0 ? amt : qty * 100,
            date: parseDate(dateIdx >= 0 ? row[dateIdx] : new Date()),
            type: 'out',
            baseStock: 0,
            unitPrice: safeNumber(unitPriceIdx >= 0 ? row[unitPriceIdx] : 0),
            supplier: '领用',
          });
        }
        outData = parsed;
      }
    }
  }

  // 解析库存汇总表
  if (stockSheetName && stockSheetName !== inSheetName && stockSheetName !== outSheetName) {
    const stockSheet = workbook.Sheets[stockSheetName];
    if (stockSheet) {
      const stockRawData = XLSX.utils.sheet_to_json<any[]>(stockSheet, { header: 1 });
      if (stockRawData.length >= 2) {
        const headers = stockRawData[0].map((h) => safeString(h));
        const dataRows = stockRawData.slice(1);

        const materialCodeIdx = findColumnIndex(headers, '存货编码', '物料编码', '编码', 'code');
        const materialNameIdx = findColumnIndex(headers, '存货名称', '物料名称', '名称', 'material');
        const balanceQtyIdx = findColumnIndex(headers, '结存数量', '库存数量', '数量', 'quantity');
        const balanceAmtIdx = findColumnIndex(headers, '结存金额', '库存金额', '金额', 'amount');
        const baseDemandIdx = findColumnIndex(headers, '基础需求数量', '基础需求', '需求数量', 'base');

        const parsed: StockData[] = [];
        for (const row of dataRows) {
          if (!row || row.every((cell) => !cell)) continue;
          const materialCode = safeString(materialCodeIdx >= 0 ? row[materialCodeIdx] : '');
          if (!materialCode) continue;

          parsed.push({
            materialCode,
            materialName: safeString(materialNameIdx >= 0 ? row[materialNameIdx] : materialCode),
            balanceQuantity: safeNumber(balanceQtyIdx >= 0 ? row[balanceQtyIdx] : 0),
            balanceAmount: safeNumber(balanceAmtIdx >= 0 ? row[balanceAmtIdx] : 0),
            baseDemandQuantity: safeNumber(baseDemandIdx >= 0 ? row[baseDemandIdx] : 0),
          });
        }
        stockData = parsed;
      }
    }
  }

  return {
    data: [...inData, ...outData],
    stockData,
  };
};

export const generateMockData = (): ParsedExcelResult => {
  const categoriesIn = ['采购入库', '调拨入库', '盘盈入库'];
  const categoriesOut = ['生产领用', '部门消耗', '项目领用'];
  const departments = ['生产部', '研发部', '销售部', '行政部', '财务部'];
  const projects = ['项目A', '项目B', '项目C', '常规采购'];

  const materials = [
    { code: 'MT-001', name: '钢板1mm', price: 120 },
    { code: 'MT-002', name: '钢板2mm', price: 220 },
    { code: 'MT-003', name: '钢管直径50', price: 85 },
    { code: 'MT-004', name: '螺栓M10', price: 1.2 },
    { code: 'MT-005', name: '螺母M10', price: 0.8 },
    { code: 'MT-006', name: '轴承6205', price: 35 },
    { code: 'MT-007', name: '电机5kw', price: 2800 },
    { code: 'MT-008', name: '减速机', price: 4500 },
    { code: 'MT-009', name: '铝材2mm', price: 95 },
    { code: 'MT-010', name: '塑料外壳', price: 48 },
  ];

  const data: InventoryData[] = [];
  const stockData: StockData[] = [];

  for (let i = 0; i < 6; i++) {
    const month = new Date(2024, i, 1);
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

    materials.forEach((mat, idx) => {
      const inQty = Math.floor(Math.random() * 200 + 50);
      const inRow: InventoryData = {
        id: `in-${i}-${idx}`,
        materialCode: mat.code,
        materialName: mat.name,
        category: categoriesIn[idx % categoriesIn.length],
        department: departments[idx % departments.length],
        project: projects[idx % projects.length],
        quantity: inQty,
        amount: inQty * mat.price,
        date: `${monthStr}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        type: 'in',
        baseStock: 100,
        unitPrice: mat.price,
        supplier: '供应商' + ((idx % 3) + 1),
      };
      data.push(inRow);

      const outQty = Math.floor(Math.random() * 120 + 20);
      const outRow: InventoryData = {
        id: `out-${i}-${idx}`,
        materialCode: mat.code,
        materialName: mat.name,
        category: categoriesOut[idx % categoriesOut.length],
        department: departments[(idx + 1) % departments.length],
        project: projects[(idx + 1) % projects.length],
        quantity: outQty,
        amount: outQty * mat.price,
        date: `${monthStr}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        type: 'out',
        baseStock: 0,
        unitPrice: mat.price,
        supplier: '领用',
      };
      data.push(outRow);
    });
  }

  materials.forEach((mat, idx) => {
    stockData.push({
      materialCode: mat.code,
      materialName: mat.name,
      balanceQuantity: Math.floor(Math.random() * 150 + 50),
      balanceAmount: 0,
      baseDemandQuantity: 100 + idx * 10,
    });
  });

  return {
    data,
    stockData,
  };
};

export const exportToExcel = (data: InventoryData[]): void => {
  const inData = data.filter((d) => d.type === 'in');
  const outData = data.filter((d) => d.type === 'out');

  const wb = XLSX.utils.book_new();
  const inWs = XLSX.utils.json_to_sheet(
    inData.map((item) => ({
      入库日期: item.date,
      存货编码: item.materialCode,
      存货名称: item.materialName,
      入库类别: item.category,
      需求部门: item.department,
      需求项目: item.project,
      数量: item.quantity,
      本币无税金额: item.amount,
      基础需求数量: item.baseStock,
    }))
  );
  XLSX.utils.book_append_sheet(wb, inWs, '入库明细');

  const outWs = XLSX.utils.json_to_sheet(
    outData.map((item) => ({
      出库日期: item.date,
      存货编码: item.materialCode,
      存货名称: item.materialName,
      出库类别: item.category,
      需求部门: item.department,
      需求项目: item.project,
      数量: item.quantity,
      本币无税金额: item.amount,
    }))
  );
  XLSX.utils.book_append_sheet(wb, outWs, '出库明细');

  XLSX.writeFile(wb, `库存数据_${new Date().toISOString().split('T')[0]}.xlsx`);
};
