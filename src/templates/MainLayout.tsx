import React, { useState } from 'react';
import { Navbar } from '../organisms/Navbar';
import { Sidebar } from '../organisms/Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="flex h-[calc(100vh-4rem)]">
        <div
          className={`
            ${isSidebarOpen ? 'block' : 'hidden lg:block'}
            fixed lg:static inset-y-0 left-0 z-40 pt-16 lg:pt-0
          `}
        >
          <Sidebar />
        </div>

        <main className="flex-1 overflow-y-auto p-6">
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
