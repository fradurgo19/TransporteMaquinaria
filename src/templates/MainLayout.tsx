import React, { useState, useEffect } from 'react';
import { Navbar } from '../organisms/Navbar';
import { Sidebar } from '../organisms/Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Sidebar cerrado por defecto en móvil, abierto en desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Estado para colapsar/expandir sidebar en desktop (persistido en localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="flex h-[calc(100vh-4rem)]">
        <div
          className={`
            ${isSidebarOpen ? 'block' : 'hidden lg:block'}
            fixed lg:static inset-y-0 left-0 z-40 pt-16 lg:pt-0
            transition-all duration-300 ease-in-out
          `}
        >
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          />
        </div>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
