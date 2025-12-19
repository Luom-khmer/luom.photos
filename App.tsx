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
  const [albumRef, setAlbumRef] = useState<string | null>(null); // State lưu mã Ref (nếu có)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // 1. URL Parsing Logic
    const parseUrlParams = () => {
        try {
            if (typeof window === 'undefined') return { id: null, ref: null };
            let id = null;
            let ref = null;
            
            // Ưu tiên 1: Đọc từ Query Params chuẩn (?session=...)
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.has('session')) {
                id = searchParams.get('session')?.trim() || null;
            } else if (searchParams.has('album')) {
                id = searchParams.get('album')?.trim() || null;
            }

            // Ưu tiên 2: Fallback đọc từ Hash (cũ) (#?album=...)
            if (!id && window.location.hash) {
                const hash = window.location.hash;
                const parts = hash.includes('?') ? hash.split('?') : [hash];
                let hashParams = null;
                if (parts.length > 1) {
                    hashParams = new URLSearchParams(parts[1]);
                } else {
                     const cleanHash = hash.substring(1); 
                     hashParams = new URLSearchParams(cleanHash);
                }
                
                if (hashParams) {
                    if (hashParams.get('album')) id = hashParams.get('album')?.trim() || null;
                    if (hashParams.get('session')) id = hashParams.get('session')?.trim() || null;
                }
            }
            
            // Lấy thêm ref nếu có (từ search params hoặc hash params đều được)
            if (searchParams.get('ref')) {
                ref = searchParams.get('ref')?.trim() || null;
            } else if (!ref && window.location.hash) {
                 // Logic lặp lại chút để lấy ref từ hash nếu chưa có
                 const parts = window.location.hash.split('?');
                 if(parts.length > 1) {
                     const hp = new URLSearchParams(parts[1]);
                     if(hp.get('ref')) ref = hp.get('ref');
                 }
            }
            
            return { id, ref };
        } catch (error) {
            console.error("Error parsing URL:", error);
            return { id: null, ref: null };
        }
    };

    const handleUrlChange = () => {
        const { id, ref } = parseUrlParams();
        setAlbumId(id);
        setAlbumRef(ref); 
        // Không scroll top ngay lập tức để tránh giật nếu đang thao tác
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    // Vẫn lắng nghe hashchange để hỗ trợ link cũ
    window.addEventListener('hashchange', handleUrlChange);

    // --- SAFETY TIMEOUT ---
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
        if (user.isAnonymous) {
            console.log("Silent Anonymous Auth Active:", user.uid);
            setCurrentUser(user); 
        } else {
            setCurrentUser(user);
            
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
        clearTimeout(safetyTimer);
        setIsAuthReady(true); 
      } else {
        console.log("Initializing Anonymous Auth...");
        signInAnonymously(auth)
            .then(() => {
                // Thành công
            })
            .catch((error) => {
                console.error("Lỗi kích hoạt chế độ khách:", error);
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

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

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
          // Truyền currentUser vào AlbumView để dùng UID làm Session Scope
          <AlbumView albumId={albumId} albumRef={albumRef} user={currentUser} />
        ) : (
          <CreateAlbumForm user={currentUser} />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;