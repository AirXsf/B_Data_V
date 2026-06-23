import type { InventoryData } from '@/types';

export const cleanInventoryData = (data: InventoryData[]): InventoryData[] => {
  return data.filter((item) => {
    if (!item.materialCode || item.materialCode.trim() === '') {
      return false;
    }
    return true;
  }).map((item) => ({
    ...item,
    materialCode: item.materialCode.trim(),
    materialName: item.materialName.trim() || '未命名物料',
    category: item.category.trim() || '未分类',
    department: item.department.trim() || '未知部门',
    project: item.project.trim() || '未分配项目',
    date: item.date ? formatDate(item.date) : new Date().toISOString().split('T')[0],
    quantity: isNaN(item.quantity) || item.quantity <= 0 ? 0 : item.quantity,
    amount: isNaN(item.amount) || item.amount <= 0 ? 0 : item.amount,
  }));
};

const formatDate = (dateStr: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return dateStr.replace(/\//g, '-');
  }
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
};

export const validateData = (data: InventoryData[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (data.length === 0) {
    errors.push('数据为空');
    return { valid: false, errors };
  }
  
  const missingCode = data.filter((item) => !item.materialCode || item.materialCode.trim() === '').length;
  if (missingCode > 0) {
    errors.push(`有 ${missingCode} 条记录缺少物料编码`);
  }
  
  const invalidQuantity = data.filter((item) => isNaN(item.quantity)).length;
  if (invalidQuantity > 0) {
    errors.push(`有 ${invalidQuantity} 条记录数量无效`);
  }
  
  const invalidAmount = data.filter((item) => isNaN(item.amount)).length;
  if (invalidAmount > 0) {
    errors.push(`有 ${invalidAmount} 条记录金额无效`);
  }
  
  const warningCount = data.filter((item) => item.quantity === 0 || item.amount === 0).length;
  if (warningCount > 0 && errors.length === 0) {
    errors.push(`有 ${warningCount} 条记录数量或金额为0（已自动处理）`);
    return { valid: true, errors };
  }
  
  return { valid: errors.length === 0, errors };
};