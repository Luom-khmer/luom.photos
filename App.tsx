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
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Logic URL mới: Hỗ trợ cả /album/ID và ?session=ID
    const getSessionId = () => {
        if (typeof window === 'undefined') return null;

        // 1. Ưu tiên đọc từ đường dẫn (Path): /album/XYZ
        const path = window.location.pathname;
        const match = path.match(/\/album\/([^\/]+)/);
        if (match && match[1]) {
            return match[1];
        }

        // 2. Fallback: Đọc từ Query Params (?session= hoặc ?album=)
        const params = new URLSearchParams(window.location.search);
        return params.get('session') || params.get('album') || null;
    };

    setAlbumId(getSessionId());

    const handlePopState = () => {
        setAlbumId(getSessionId());
    };
    window.addEventListener('popstate', handlePopState);

    const safetyTimer = setTimeout(() => {
        setIsAuthReady(true);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        if (!user.isAnonymous && user.email) {
            const email = user.email;
            const userDocRef = doc(db, 'allowed_users', email);
            try {
                const userDocSnapshot = await getDoc(userDocRef);
                const userData = userDocSnapshot.exists() ? userDocSnapshot.data() : null;

                if (!ADMIN_EMAILS.includes(email) && userData && userData.banned === true) {
                    await logoutUser();
                    setCurrentUser(null);
                    alert(`Tài khoản "${email}" đã bị chặn.`);
                    return;
                }

                await setDoc(userDocRef, { 
                    email: email,
                    lastLogin: new Date(),
                    photoURL: user.photoURL || '',
                    displayName: user.displayName || '',
                }, { merge: true });
            } catch (error) {
                console.error("Firestore user sync error:", error);
            }
        }
        setIsAuthReady(true);
        clearTimeout(safetyTimer);
      } else {
        signInAnonymously(auth).catch(() => setIsAuthReady(true));
      }
    });

    return () => {
        window.removeEventListener('popstate', handlePopState);
        clearTimeout(safetyTimer);
        unsubscribe(); 
    };
  }, []);

  const handleLogin = async () => {
    try { await loginWithGoogle(); } catch (e) { console.error(e); }
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
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
        {albumId ? (
          <AlbumView albumId={albumId} albumRef={null} user={currentUser} />
        ) : (
          <CreateAlbumForm user={currentUser} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;