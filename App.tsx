import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, db, loginWithGoogle, logoutUser, ADMIN_EMAILS } from './firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
      if (user && user.email) {
        // CẬP NHẬT UI NGAY LẬP TỨC
        setCurrentUser(user);

        const email = user.email;
        const userDocRef = doc(db, 'allowed_users', email);

        // XỬ LÝ DATABASE (QUAN TRỌNG: Dùng setDoc merge để đảm bảo luôn lưu)
        try {
            // 1. Kiểm tra trạng thái Ban trước
            const userDocSnapshot = await getDoc(userDocRef);
            const userData = userDocSnapshot.exists() ? userDocSnapshot.data() : null;

            // Nếu bị ban và không phải Admin -> Logout và ngừng xử lý
            if (!ADMIN_EMAILS.includes(email) && userData && userData.banned === true) {
                await logoutUser();
                setCurrentUser(null);
                alert(`Tài khoản "${email}" đã bị Admin chặn quyền truy cập.`);
                return;
            }

            // 2. LƯU THÔNG TIN USER (Persistence)
            // Sử dụng setDoc với { merge: true } để:
            // - Tạo document mới nếu chưa có (lưu mãi mãi)
            // - Cập nhật lastLogin nếu đã có
            // - Không ghi đè trường 'banned' nếu nó đang tồn tại
            await setDoc(userDocRef, { 
                email: email,
                lastLogin: new Date(),
                photoURL: user.photoURL || '',
                displayName: user.displayName || '',
                // Chúng ta không set 'banned' ở đây để tránh bỏ chặn nhầm
            }, { merge: true });

            // Nếu document chưa từng tồn tại (user mới), set mặc định banned = false
            if (!userDocSnapshot.exists()) {
                 await setDoc(userDocRef, { banned: false }, { merge: true });
            }

        } catch (error) {
            console.error("Lỗi đồng bộ dữ liệu người dùng:", error);
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