import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { UploadPage } from '@/pages/UploadPage';
import { Dashboard } from '@/pages/Dashboard';
import { Consumption } from '@/pages/Consumption';
import { Warnings } from '@/pages/Warnings';
import { Analysis } from '@/pages/Analysis';
import { useInventoryStore } from '@/store/inventoryStore';

function App() {
  const [currentPage, setCurrentPage] = useState('upload');
  const { hasData } = useInventoryStore();

  const handleUploadComplete = () => {
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  if (currentPage === 'upload') {
    return <UploadPage onComplete={handleUploadComplete} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        hasData={hasData}
      />
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'consumption' && <Consumption />}
        {currentPage === 'warnings' && <Warnings />}
        {currentPage === 'analysis' && <Analysis />}
      </main>
    </div>
  );
}

export default App;