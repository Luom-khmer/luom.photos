import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, db, loginWithGoogle, logoutUser, ADMIN_EMAILS } from './firebaseConfig';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
            
            // QUAN TRỌNG: Loại bỏ khoảng trắng thừa để ID luôn nhất quán
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

    // 2. Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Kiểm tra loại user
        if (user.isAnonymous) {
            // Nếu là ẩn danh: Vẫn giữ currentUser là null để UI không hiện thông tin user
            // Nhưng Firebase SDK đã có token để ghi vào Firestore
            console.log("Silent Anonymous Auth Active");
            setCurrentUser(null);
        } else {
            // Nếu là user thật (Google Login)
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
      } else {
        // Không có user nào (kể cả ẩn danh) -> Kích hoạt đăng nhập ẩn danh ngầm
        // Điều này cần thiết để Firestore cho phép ghi dữ liệu (theo Rules mặc định)
        setCurrentUser(null);
        signInAnonymously(auth).catch((error) => {
            console.error("Lỗi kích hoạt chế độ khách:", error);
        });
      }
    });

    return () => {
        window.removeEventListener('popstate', handleUrlChange);
        window.removeEventListener('hashchange', handleUrlChange);
        unsubscribe(); 
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
    // Sau khi logout Google, Auth Listener sẽ chạy vào block 'else' và tự động sign in Anonymously lại
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