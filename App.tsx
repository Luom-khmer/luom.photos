import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, db, loginWithGoogle, logoutUser, ADMIN_EMAILS } from './firebaseConfig';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // Trạng thái chờ Auth

  useEffect(() => {
    // 1. URL Parsing Logic
    const getAlbumIdFromUrl = () => {
        try {
            if (typeof window === 'undefined') return null;
            let id = null;

            if (window.location.hash && window.location.hash.includes('album=')) {
                const hash = window.location.hash;
                const parts = hash.includes('?') ? hash.split('?') : [hash];
                if (parts.length > 1) {
                    const params = new URLSearchParams(parts[1]);
                    if (params.get('album')) id = params.get('album');
                } else {
                     const cleanHash = hash.substring(1); 
                     const params = new URLSearchParams(cleanHash);
                     if (params.get('album')) id = params.get('album');
                }
            } else {
                const params = new URLSearchParams(window.location.search);
                const idFromSearch = params.get('album');
                if (idFromSearch) id = idFromSearch;
            }
            
            return id ? id.trim() : null;
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

    // --- SAFETY TIMEOUT ---
    // Fix lỗi treo: Nếu sau 2.5 giây mà Auth chưa xong (do mạng lag hoặc lỗi), 
    // ép buộc vào app luôn để khách không phải chờ.
    const safetyTimer = setTimeout(() => {
        setIsAuthReady((prev) => {
            if (!prev) {
                console.warn("Auth initialization timed out, forcing render.");
                return true;
            }
            return prev;
        });
    }, 2500);

    // 2. Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Có user (kể cả User thật hoặc Ẩn danh)
        if (user.isAnonymous) {
            console.log("Silent Anonymous Auth Active:", user.uid);
            setCurrentUser(null); // UI vẫn hiện là khách
        } else {
            setCurrentUser(user);
            
            // Logic lưu user admin/google
            if (user.email) {
                const email = user.email;
                const userDocRef = doc(db, 'allowed_users', email);

                try {
                    const userDocSnapshot = await getDoc(userDocRef);
                    const userData = userDocSnapshot.exists() ? userDocSnapshot.data() : null;

                    if (!ADMIN_EMAILS.includes(email) && userData && userData.banned === true) {
                        await logoutUser();
                        setCurrentUser(null);
                        alert(`Tài khoản "${email}" đã bị Admin chặn quyền truy cập.`);
                        return;
                    }

                    const payload: any = { 
                        email: email,
                        lastLogin: new Date(),
                        photoURL: user.photoURL || '',
                        displayName: user.displayName || '',
                    };

                    if (!userDocSnapshot.exists()) {
                        payload.createdAt = new Date();
                        payload.banned = false;
                    }

                    await setDoc(userDocRef, payload, { merge: true });

                } catch (error) {
                    console.error("Lỗi lưu dữ liệu người dùng vào Firestore:", error);
                }
            }
        }
        clearTimeout(safetyTimer); // Hủy timeout nếu load thành công
        setIsAuthReady(true); 
      } else {
        // Chưa có user -> Kích hoạt đăng nhập ẩn danh ngay lập tức
        console.log("Initializing Anonymous Auth...");
        signInAnonymously(auth)
            .then(() => {
                // Thành công -> onAuthStateChanged sẽ chạy lại vào block 'if (user)'
            })
            .catch((error) => {
                console.error("Lỗi kích hoạt chế độ khách:", error);
                // Nếu lỗi, force load luôn để không treo màn hình
                setIsAuthReady(true); 
            });
      }
    });

    return () => {
        window.removeEventListener('popstate', handleUrlChange);
        window.removeEventListener('hashchange', handleUrlChange);
        clearTimeout(safetyTimer);
        unsubscribe(); 
    };
  }, []);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      // Alert handled in loginWithGoogle
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  // Màn hình chờ khi đang xác thực ngầm
  if (!isAuthReady) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
              <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Đang khởi tạo hệ thống...</p>
          </div>
      );
  }

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