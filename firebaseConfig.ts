import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDdk8nZCyJUi5yYnk2IlUqGc0nmf65Fmvk",
  authDomain: "gen-lang-client-0082195972.firebaseapp.com",
  projectId: "gen-lang-client-0082195972",
  storageBucket: "gen-lang-client-0082195972.firebasestorage.app",
  messagingSenderId: "389932945616",
  appId: "1:389932945616:web:2a6a0d4752e03f225a4ed5",
  measurementId: "G-DKC1KELKR9"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Hàm đăng nhập Google
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Lỗi đăng nhập:", error);
    // Xử lý lỗi thường gặp khi deploy
    if (error.code === 'auth/unauthorized-domain') {
        alert(`Lỗi tên miền (Domain Error):\n\nTrang web này (${window.location.hostname}) chưa được cho phép đăng nhập bằng Google.\n\nHãy vào Firebase Console > Authentication > Settings > Authorized domains và thêm tên miền: ${window.location.hostname}`);
    } else if (error.code === 'auth/popup-closed-by-user') {
        // Người dùng tự tắt popup, không cần alert lỗi
        console.log("Người dùng đã đóng popup đăng nhập.");
    } else {
        alert("Đăng nhập thất bại: " + error.message);
    }
    throw error;
  }
};

// Hàm đăng xuất
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
  }
};

export { auth };