import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CreateAlbumForm } from './components/CreateAlbumForm';
import { AlbumView } from './components/AlbumView';
import { auth, loginWithGoogle, logoutUser } from './firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';

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

    // 2. Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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
      alert("Đăng nhập thất bại. Vui lòng kiểm tra console hoặc cấu hình Firebase.");
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