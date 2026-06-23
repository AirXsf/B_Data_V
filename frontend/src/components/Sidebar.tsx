/*
 * @Date: 2026-06-12 14:48:52
 * @LastEditors: wangbiao
 * @Description: 
 * @LastEditTime: 2026-06-23 10:10:07
 */
import { 
  Upload, 
  LayoutDashboard, 
  BarChart3, 
  AlertTriangle, 
  FileText,
  LogOut,
  Package
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  hasData: boolean;
}

export const Sidebar = ({ currentPage, onNavigate, hasData }: SidebarProps) => {
  const navItems = [
    { id: 'upload', label: '数据上传', icon: Upload },
    { id: 'dashboard', label: '存货仪表板', icon: LayoutDashboard },
    { id: 'consumption', label: '领用消耗分析', icon: BarChart3 },
    { id: 'warnings', label: '采购决策预警', icon: AlertTriangle },
    { id: 'analysis', label: '智能文字分析', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white h-screen flex-shrink-0 flex flex-col">
      <div className="p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">存货智能分析AI</h1>
            <p className="text-xs text-slate-400">Inventory Analytics</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.id !== 'upload' && !hasData;

            return (
              <li key={item.id}>
                <button
                  onClick={() => !isDisabled && onNavigate(item.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    currentPage === item.id
                      ? 'bg-blue-500 text-white'
                      : isDisabled
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* <div className="p-4 border-t border-slate-700 flex-shrink-0">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
          <LogOut className="w-5 h-5" />
          <span>退出登录</span>
        </button>
      </div> */}
    </aside>
  );
};