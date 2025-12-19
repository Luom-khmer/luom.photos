import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, db, loginWithGoogle, logoutUser, ADMIN_EMAILS } from './firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

    // 2. Firebase Auth Listener with Auto-Register & Ban Check
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // CẬP NHẬT UI NGAY LẬP TỨC ĐỂ TRÁNH ĐỘ TRỄ
        setCurrentUser(user);

        const email = user.email || '';
        const userDocRef = doc(db, 'allowed_users', email);

        // XỬ LÝ DATABASE DƯỚI NỀN (BACKGROUND)
        try {
            const userDoc = await getDoc(userDocRef);
            
            // Logic kiểm tra BAN (Chặn)
            // Nếu bị ban và không phải Admin -> Logout ngược lại
            if (!ADMIN_EMAILS.includes(email) && userDoc.exists() && userDoc.data().banned === true) {
                await logoutUser();
                setCurrentUser(null); // Cập nhật lại UI sau khi logout
                alert(`Tài khoản "${email}" đã bị Admin chặn quyền truy cập.`);
                return;
            }

            // Logic Lưu/Cập nhật User vào DB
            if (userDoc.exists()) {
                await updateDoc(userDocRef, { 
                    lastLogin: new Date(),
                    photoURL: user.photoURL || '',
                    displayName: user.displayName || ''
                });
            } else {
                await setDoc(userDocRef, { 
                    email: email, 
                    banned: false,
                    createdAt: new Date(),
                    lastLogin: new Date(),
                    photoURL: user.photoURL || '',
                    displayName: user.displayName || ''
                });
            }

        } catch (error) {
            console.error("Lỗi đồng bộ dữ liệu người dùng:", error);
            // Nếu lỗi DB nhưng user đã đăng nhập auth thành công, ta vẫn giữ trạng thái đăng nhập ở UI (đã set ở trên)
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