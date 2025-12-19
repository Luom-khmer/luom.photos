import React from 'react';
import { Home, LogIn, Copy, Mail, Globe, LogOut, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout }) => {
  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <header className="bg-[#1b5e20] text-white py-3 px-4 shadow-md z-20">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
        
        {/* Logo Section */}
        <div className="flex items-center space-x-2">
          <div className="flex flex-col cursor-pointer" onClick={handleHomeClick}>
            <h1 className="text-2xl font-bold tracking-tight text-yellow-400 drop-shadow-sm flex items-center">
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100" 
                alt="Luom Photos Logo" 
                className="w-10 h-10 rounded-full mr-3 object-cover border-2 border-white/30 shadow-sm"
              />
              LUOM PHOTOS
            </h1>
            <span className="text-[10px] text-gray-200 uppercase tracking-wider ml-14 -mt-1">Chọn ảnh nhanh từ thư mục Google Drive</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav>
          <ul className="flex flex-wrap justify-center items-center gap-4 text-sm font-medium">
            <li>
              <a 
                href="/" 
                onClick={handleHomeClick}
                className="flex items-center hover:text-yellow-300 transition-colors"
              >
                <Home className="w-4 h-4 mr-1" />
                Trang Chủ
              </a>
            </li>
            
            {/* User Login/Logout Logic */}
            {user ? (
              <li className="flex items-center space-x-3 bg-green-800/50 px-3 py-1 rounded-full border border-green-700">
                <div className="flex items-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full border border-white/50 mr-2" />
                  ) : (
                    <UserIcon className="w-5 h-5 mr-1" />
                  )}
                  <span className="text-xs md:text-sm truncate max-w-[100px] md:max-w-none text-yellow-100">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button 
                  onClick={onLogout}
                  className="flex items-center text-gray-300 hover:text-white transition-colors border-l border-green-600 pl-3"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </li>
            ) : (
              <li>
                <button 
                  onClick={onLogin} 
                  className="flex items-center hover:text-yellow-300 transition-colors"
                >
                  <LogIn className="w-4 h-4 mr-1" />
                  Đăng Nhập
                </button>
              </li>
            )}

            <li>
              <a href="#" className="flex items-center hover:text-yellow-300 transition-colors">
                <Copy className="w-4 h-4 mr-1" />
                Sao Chép Ảnh
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center hover:text-yellow-300 transition-colors">
                <Mail className="w-4 h-4 mr-1" />
                Liên Hệ
              </a>
            </li>
            <li className="flex items-center">
              <button className="flex items-center hover:text-yellow-300 transition-colors">
                <Globe className="w-4 h-4 mr-1" />
                <span className="ml-0.5 text-xs">▼</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};