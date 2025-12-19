import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, db, loginWithGoogle, logoutUser, ADMIN_EMAILS } from './firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. URL Parsing Logic
    const getAlbumIdFromUrl = () => {
        try {
            if (typeof window === 'undefined') return null;
            if (window.location.hash && window.location.hash.includes('album=')) {
                const hash = window.location.hash;
                const parts = hash.includes('?') ? hash.split('?') : [hash];
                if (parts.length > 1) {
                    const params = new URLSearchParams(parts[1]);
                    if (params.get('album')) return params.get('album');
                } else {
                     const cleanHash = hash.substring(1); 
                     const params = new URLSearchParams(cleanHash);
                     if (params.get('album')) return params.get('album');
                }
            }
            const params = new URLSearchParams(window.location.search);
            const idFromSearch = params.get('album');
            if (idFromSearch) return idFromSearch;
        } catch (error) {
            console.error("Error parsing URL for album ID:", error);
        }
        return null;
    };

    const handleUrlChange = () => {
        const id = getAlbumIdFromUrl();
        setAlbumId(id);
        window.scrollTo(0, 0);
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // 2. Firebase Auth Listener with Security Check
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email || '';
        
        // 2a. Nếu là Super Admin (Hardcoded) -> Cho phép
        if (ADMIN_EMAILS.includes(email)) {
             setCurrentUser(user);
             return;
        }

        // 2b. Nếu không phải Admin, kiểm tra trong Firestore (Allowlist)
        try {
            const userDocRef = doc(db, 'allowed_users', email);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                setCurrentUser(user);
            } else {
                // Không có trong danh sách -> Kick out
                await logoutUser();
                alert(`Tài khoản "${email}" chưa được cấp quyền sử dụng hệ thống. Vui lòng liên hệ Admin.`);
            }
        } catch (error) {
            console.error("Lỗi kiểm tra quyền truy cập:", error);
            // Fallback an toàn: Nếu lỗi DB, không cho đăng nhập để bảo mật
            await logoutUser();
            alert("Không thể kết nối đến hệ thống phân quyền. Vui lòng thử lại sau.");
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
        window.removeEventListener('popstate', handleUrlChange);
        window.removeEventListener('hashchange', handleUrlChange);
        unsubscribe(); // Cleanup auth listener
    };
  }, []);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      // Alert đã được xử lý trong loginWithGoogle
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header 
        user={currentUser} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
        {albumId ? (
          <AlbumView albumId={albumId} />
        ) : (
          <CreateAlbumForm user={currentUser} />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;