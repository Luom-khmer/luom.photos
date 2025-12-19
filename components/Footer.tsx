import React from 'react';
import { Home, Facebook, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <footer className="bg-[#1b5e20] text-white py-4 border-t border-green-800 z-20">
      <div className="container mx-auto flex flex-col items-center justify-center text-sm space-y-2">
        
        {/* Footer Links */}
        <div className="flex items-center space-x-6">
          <a 
            href="/" 
            onClick={handleHomeClick}
            className="flex items-center hover:text-yellow-300 transition-colors"
          >
            <Home className="w-4 h-4 mr-1" />
            Trang Chủ
          </a>
          <a href="#" className="flex items-center hover:text-yellow-300 transition-colors">
            <Facebook className="w-4 h-4 mr-1" />
            Liên Hệ
          </a>
          <a href="#" className="flex items-center hover:text-yellow-300 transition-colors">
            <ShieldCheck className="w-4 h-4 mr-1" />
            Chính Sách Bảo Mật
          </a>
        </div>

        {/* Copyright */}
        <div className="text-gray-300 text-xs mt-2">
          © 2025 1Touch Pro. Tất cả các quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
};