import React, { useState, useEffect } from 'react';
import { Triangle, Key, Download, MessageSquare, List, Plus, Info, Loader2, CheckCircle, AlertCircle, FolderOpen, Settings, X, ExternalLink, HelpCircle, FileImage, Image as ImageIcon, Copy, Check, Share2, RefreshCw, Shield, Users, Trash2, UserPlus, History, Lock } from 'lucide-react';
import { Switch } from './ui/Switch';
import { User } from 'firebase/auth';
import { db, ADMIN_EMAILS } from '../firebaseConfig';
import { collection, doc, setDoc, updateDoc, onSnapshot, query } from 'firebase/firestore';

interface CreateAlbumFormProps {
  user: User | null;
}

export const CreateAlbumForm: React.FC<CreateAlbumFormProps> = ({ user }) => {
  const [driveLink, setDriveLink] = useState('');
  const [password, setPassword] = useState('');
  
  // Logic xác định quyền Admin
  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  // API Key State
  const [apiKey, setApiKey] = useState(() => {
    const defaultKey = 'AIzaSyD0swN9M4-VzVfA0h0mMTb3OSmD8CAcH1c';
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('google_api_key');
        return stored || defaultKey;
    }
    return defaultKey;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // User Management State (Only for Admin)
  const [activeUsers, setActiveUsers] = useState<{email: string, lastLogin?: any, photoURL?: string}[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Toggle states
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowDownloadOriginal, setAllowDownloadOriginal] = useState(true);
  const [allowDownloadRaw, setAllowDownloadRaw] = useState(false);
  
  const [allowComment, setAllowComment] = useState(false);
  
  const [limitPhotos, setLimitPhotos] = useState(false);
  const [maxPhotoCount, setMaxPhotoCount] = useState<number>(50);

  // Link checking states
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [folderMetadata, setFolderMetadata] = useState<{ id: string, name: string, count: number } | null>(null);

  // Creation Success State
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBlobUrl, setIsBlobUrl] = useState(false);

  // Guest limit state
  const [guestCount, setGuestCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('google_api_key', apiKey);
        setIsBlobUrl(window.location.protocol === 'blob:');
        
        // Load guest count
        const count = parseInt(localStorage.getItem('guest_album_count') || '0', 10);
        setGuestCount(count);
    }
    if (driveLink && driveLink.length > 10) {
        checkDriveLink(driveLink);
    }
  }, [apiKey]);

  // Realtime Listener for Users (Only fetch NOT BANNED users)
  useEffect(() => {
    if (isAdmin && showSettings) {
        setLoadingUsers(true);
        // Chỉ lấy những user chưa bị banned
        const q = query(collection(db, "allowed_users"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users: any[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                // Fix quan trọng: Nếu data.email không tồn tại, dùng doc.id làm email
                const email = data.email || docSnapshot.id;
                
                // Filter client-side cho đơn giản: Chỉ hiện những người chưa bị banned
                if (data.banned !== true) {
                    users.push({
                        ...data,
                        email: email // Đảm bảo trường email luôn có giá trị
                    });
                }
            });
            
            // Sắp xếp theo lần đăng nhập cuối
            const getTime = (t: any) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds * 1000; // Firestore Timestamp
                if (typeof t.getTime === 'function') return t.getTime(); // JS Date object
                return 0;
            };

            users.sort((a, b) => getTime(b.lastLogin) - getTime(a.lastLogin));
            
            setActiveUsers(users);
            setLoadingUsers(false);
        }, (error) => {
            console.error("Lỗi tải danh sách người dùng:", error);
            setLoadingUsers(false);
        });
        return () => unsubscribe();
    }
  }, [isAdmin, showSettings]);

  // Add/Unban User Logic
  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUserEmail || !newUserEmail.includes('@')) {
          alert("Email không hợp lệ");
          return;
      }
      try {
          // Khi admin thêm tay, ta cũng tạo document để lưu vĩnh viễn
          await setDoc(doc(db, "allowed_users", newUserEmail), {
              email: newUserEmail,
              banned: false,
              addedByAdminAt: new Date()
          }, { merge: true });
          
          setNewUserEmail('');
          alert(`Đã thêm/cấp quyền cho ${newUserEmail}`);
      } catch (error) {
          console.error("Lỗi thêm user:", error);
          alert("Lỗi kết nối Firestore.");
      }
  };

  // Block/Ban User Logic
  const handleBlockUser = async (emailToBlock: string) => {
      // Không cho phép Admin tự xóa chính mình trong giao diện này để tránh lỗi
      if (emailToBlock === user?.email) {
          alert("Bạn không thể chặn chính mình!");
          return;
      }

      if (window.confirm(`Bạn muốn CHẶN quyền truy cập của ${emailToBlock}?\n\nNgười dùng này sẽ biến mất khỏi danh sách và không thể đăng nhập nữa.`)) {
          try {
              // Soft delete: Chỉ đánh dấu banned = true, không xóa khỏi DB
              await updateDoc(doc(db, "allowed_users", emailToBlock), {
                  banned: true,
                  bannedAt: new Date()
              });
          } catch (error) {
              console.error("Lỗi chặn user:", error);
              alert("Không thể chặn người dùng này.");
          }
      }
  };

  const checkDriveLink = async (url: string) => {
    const driveRegex = /(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:drive\/folders\/|open\?id=)([-\w]+)/;
    const match = url.match(driveRegex);

    if (!match || !match[1]) {
        if (url.length > 10) {
            setStatus('error');
            setErrorMessage('Đường dẫn không đúng định dạng Google Drive.');
            setFolderMetadata(null);
        } else {
            setStatus('idle');
            setErrorMessage('');
            setFolderMetadata(null);
        }
        return;
    }

    const folderId = match[1];

    if (!apiKey) {
        setStatus('error');
        setErrorMessage(isAdmin 
            ? 'Yêu cầu Google API Key. Admin vui lòng cài đặt.'
            : 'Hệ thống chưa cấu hình API Key. Vui lòng liên hệ Admin.'
        );
        setFolderMetadata(null);
        return;
    }

    setStatus('checking');
    setErrorMessage('');
    setFolderMetadata(null);

    try {
      const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&key=${apiKey}`);
      
      if (!folderRes.ok) {
          const errData = await folderRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'Không thể truy cập thư mục. Kiểm tra API Key hoặc quyền truy cập.');
      }
      
      const folderData = await folderRes.json();

      const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false&fields=files(id)&pageSize=1000&key=${apiKey}`);
      
      if (!filesRes.ok) {
         throw new Error('Không thể lấy danh sách ảnh.');
      }
      
      const filesData = await filesRes.json();
      const count = filesData.files ? filesData.files.length : 0;

      setStatus('success');
      setFolderMetadata({
        id: folderData.id,
        name: folderData.name,
        count: count
      });

    } catch (error: any) {
        console.error("Drive API Error:", error);
        setStatus('error');
        setErrorMessage(error.message || 'Lỗi kết nối đến Google Drive');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (driveLink && !createdLink) { 
        checkDriveLink(driveLink);
      } else if (!driveLink) {
        setStatus('idle');
        setFolderMetadata(null);
        setErrorMessage('');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [driveLink]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. KIỂM TRA GIỚI HẠN KHÁCH (GUEST LIMIT CHECK)
    if (!user) {
        const currentCount = parseInt(localStorage.getItem('guest_album_count') || '0', 10);
        if (currentCount >= 3) {
            alert("Bạn đã hết 3 lượt tạo miễn phí.\n\nVui lòng đăng nhập bằng Google để tiếp tục tạo album không giới hạn!");
            return;
        }
    }

    if (status === 'success' && folderMetadata) {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://luomphotos.com';
      const baseUrl = currentUrl.split('?')[0].split('#')[0];
      
      // TẠO URL KÈM THAM SỐ
      let finalUrl = `${baseUrl}#?album=${folderMetadata.id}`;
      
      // Tham số Limit
      if (limitPhotos && maxPhotoCount > 0) {
          finalUrl += `&limit=${maxPhotoCount}`;
      }

      // Tham số Comments
      if (allowComment) {
          finalUrl += `&comments=1`;
      }
      
      // 2. CẬP NHẬT SỐ LƯỢT CỦA KHÁCH
      if (!user) {
          const newCount = (parseInt(localStorage.getItem('guest_album_count') || '0', 10) + 1);
          localStorage.setItem('guest_album_count', newCount.toString());
          setGuestCount(newCount);
      }

      setCreatedLink(finalUrl);
    } else {
      if (status === 'error') {
        alert(errorMessage || 'Vui lòng kiểm tra lại đường dẫn.');
      } else if (!apiKey) {
        if (isAdmin) {
            setShowSettings(true);
            alert('Vui lòng nhập Google API Key để tiếp tục.');
        } else {
            alert('Hệ thống thiếu API Key. Chỉ Admin mới có quyền cấu hình.');
        }
      } else {
         alert('Vui lòng nhập đường dẫn thư mục Google Drive hợp lệ.');
      }
    }
  };

  const handleCopyLink = () => {
    if (createdLink) {
        navigator.clipboard.writeText(createdLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleReset = () => {
      setCreatedLink(null);
      setDriveLink('');
      setPassword('');
      setFolderMetadata(null);
      setStatus('idle');
  };

  // --- RENDER SUCCESS VIEW ---
  if (createdLink && folderMetadata) {
      return (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-6 md:p-8 w-full border border-gray-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
             
             <div className="relative z-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Tạo Album Thành Công!</h2>
                <p className="text-gray-500 text-sm mb-6">Album của bạn đã sẵn sàng để chia sẻ.</p>

                {/* Folder Info Card */}
                <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex items-start text-left">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{folderMetadata.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {folderMetadata.count} ảnh • {allowComment ? 'Cho phép bình luận' : 'Không bình luận'} • {limitPhotos ? `Giới hạn ${maxPhotoCount} ảnh` : 'Không giới hạn'}
                        </p>
                    </div>
                </div>

                {/* Copy Link Section */}
                <div className="w-full space-y-2 mb-8">
                    <label className="block text-sm font-medium text-gray-700 text-left pl-1">Link gửi cho khách hàng</label>
                    <div className="flex shadow-sm rounded-md transition-all duration-200 ring-1 ring-gray-300 focus-within:ring-2 focus-within:ring-green-500">
                        <div className="flex-grow relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Share2 className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                readOnly
                                value={createdLink}
                                className="block w-full pl-10 sm:text-sm border-none rounded-l-md bg-white text-gray-600 py-3 focus:ring-0"
                            />
                        </div>
                        <button
                            onClick={handleCopyLink}
                            className={`relative -ml-px inline-flex items-center space-x-2 px-6 py-2 border border-transparent text-sm font-medium rounded-r-md text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all duration-200 ${isCopied ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {isCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                            <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 text-left pl-1">
                        {isBlobUrl ? (
                            <span className="text-amber-600 font-medium">Lưu ý: Bạn đang chạy trên môi trường xem trước (Blob). Link này chỉ hoạt động trên tab hiện tại.</span>
                        ) : (
                            <span>Khách hàng truy cập link này để chọn ảnh. {password && 'Yêu cầu mật khẩu khi truy cập.'}</span>
                        )}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 w-full">
                     <button
                        onClick={handleReset}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tạo Album Khác
                    </button>
                    <a
                        href={createdLink}
                        target={isBlobUrl ? "_self" : "_blank"} // Fix for Blob URL: Prevent new tab opening which causes ERR_FILE_NOT_FOUND
                        rel="noreferrer"
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Mở Album Ngay
                    </a>
                </div>
             </div>
        </div>
      );
  }

  // --- RENDER FORM ---
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-6 md:p-8 w-full border border-gray-100 relative overflow-hidden">
      {/* Subtle texture for the card background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
            <div className="w-8"></div> {/* Spacer for centering */}
            <h2 className="text-2xl md:text-3xl font-light text-center text-gray-700 tracking-wide uppercase flex-1">
            Bắt Đầu Tạo Album Ảnh
            </h2>
            {/* LOGIC: CHỈ ADMIN MỚI THẤY NÚT SETTINGS */}
            {isAdmin && (
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full transition-colors text-xs font-bold uppercase tracking-wider border border-gray-200 shadow-sm"
                    title="Mở bảng điều khiển Admin"
                >
                    <Settings className={`w-4 h-4 ${!apiKey ? 'text-red-500 animate-pulse' : ''}`} />
                    Quản Lý Admin
                </button>
            )}
        </div>

        {/* API Key & User Management Panel - Only for Admin */}
        {isAdmin && showSettings && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                <div className="flex justify-between items-center p-3 bg-gray-100/50 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                         <div className="bg-red-100 p-1 rounded text-red-600">
                            <Shield className="w-4 h-4" />
                         </div>
                         <label className="text-xs font-bold text-gray-600 uppercase">
                            Admin Control Panel
                         </label>
                    </div>
                    <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Admin User Info */}
                    <div className="text-xs text-gray-500 pb-2 border-b border-gray-200">
                        <div className="flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            Admin đang đăng nhập: <strong className="ml-1 text-gray-700">{user?.email}</strong>
                        </div>
                    </div>

                    {/* SECTION 1: GOOGLE API KEY */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase flex items-center mb-1">
                            Google API Key
                            <button 
                                onClick={(e) => { e.preventDefault(); setShowGuide(true); }}
                                className="ml-2 text-blue-600 hover:text-blue-800 text-[10px] normal-case flex items-center font-normal"
                            >
                                <HelpCircle className="w-3 h-3 mr-0.5" />
                                Cách lấy Key?
                            </button>
                        </label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="AIza..."
                                className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none pr-8 font-mono"
                            />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">
                        API Key này sẽ được dùng cho toàn bộ hệ thống trên trình duyệt này.
                        </p>
                    </div>

                    {/* SECTION 2: USER MANAGEMENT (ACTIVE USERS) */}
                    <div className="pt-2 border-t border-gray-200">
                        <label className="text-xs font-bold text-gray-600 uppercase flex items-center mb-2">
                            <Users className="w-3.5 h-3.5 mr-1" />
                            Danh sách người dùng
                        </label>
                        <p className="text-[10px] text-gray-500 mb-3">
                            Tất cả người dùng đã từng đăng nhập vào hệ thống.
                        </p>

                        {/* Add/Unban User Form */}
                        <form onSubmit={handleAddUser} className="flex gap-2 mb-3">
                            <input 
                                type="email" 
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder="Thêm/gỡ chặn email..." 
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-green-500 outline-none"
                            />
                            <button 
                                type="submit"
                                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 flex items-center whitespace-nowrap"
                                disabled={!newUserEmail}
                            >
                                <UserPlus className="w-3.5 h-3.5 mr-1" /> Thêm/Gỡ chặn
                            </button>
                        </form>

                        {/* User List */}
                        <div className="bg-white border border-gray-200 rounded max-h-48 overflow-y-auto custom-scrollbar">
                            {loadingUsers ? (
                                <div className="p-3 text-center text-xs text-gray-400">Đang tải danh sách...</div>
                            ) : activeUsers.length === 0 ? (
                                <div className="p-3 text-center text-xs text-gray-400">Chưa có dữ liệu người dùng.</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {activeUsers.map((u) => (
                                        <li key={u.email} className={`px-3 py-2 flex justify-between items-center hover:bg-gray-50 text-sm group ${u.email === user?.email ? 'bg-blue-50/50' : ''}`}>
                                            <div className="flex items-center overflow-hidden mr-2">
                                                {/* Avatar (if available) */}
                                                {u.photoURL ? (
                                                    <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full mr-2 border border-gray-200" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-2 text-xs font-bold">
                                                        {u.email.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col overflow-hidden">
                                                    <div className="flex items-center">
                                                        <span className="text-gray-700 truncate font-medium">{u.email}</span>
                                                        {u.email === user?.email && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">Bạn</span>}
                                                    </div>
                                                    {u.lastLogin && (
                                                        <span className="text-[10px] text-gray-400 flex items-center">
                                                            <History className="w-3 h-3 mr-0.5 inline" />
                                                            {/* Check if lastLogin is Timestamp or Date */}
                                                            {u.lastLogin.seconds 
                                                                ? new Date(u.lastLogin.seconds * 1000).toLocaleString('vi-VN') 
                                                                : new Date(u.lastLogin).toLocaleString('vi-VN')
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Delete Button (Disable if it's the current admin user) */}
                                            {u.email !== user?.email && (
                                                <button 
                                                    onClick={() => handleBlockUser(u.email)}
                                                    className="text-gray-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                    title="Xóa & Chặn truy cập"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Google Drive Link Input */}
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end text-sm gap-1">
               <label className="text-gray-700 font-medium">
                 Link Google Drive
                 <span className="block text-xs text-gray-500 font-normal mt-0.5">Hỗ trợ link từ thư mục Google Drive, có thể đọc file từ ảnh Drive công khai</span>
               </label>
               {isAdmin && (
                   <a href="#" onClick={(e) => { e.preventDefault(); setShowGuide(true); }} className="text-blue-600 hover:text-blue-800 hover:underline text-xs flex-shrink-0 flex items-center">
                     Xem hướng dẫn <ExternalLink className="w-3 h-3 ml-1" />
                   </a>
               )}
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <div className="w-5 h-5 flex items-center justify-center">
                   <Triangle className="w-4 h-4 text-green-600 fill-current rotate-0" /> 
                </div>
              </div>
              <input
                type="text"
                className={`block w-full pl-10 pr-10 py-3 border rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 transition-all duration-200 sm:text-sm shadow-sm group-hover:border-gray-400
                  ${status === 'error' ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-green-500 focus:border-green-500'}
                `}
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
              />
              {/* Status Indicator Icon */}
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {status === 'checking' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                {status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              </div>
            </div>

            {/* Metadata Display */}
            {status === 'success' && folderMetadata && (
              <div className="mt-2 bg-green-50 border border-green-100 rounded-md p-3 flex items-start text-sm text-green-800 animate-fadeIn">
                <FolderOpen className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-green-900">{folderMetadata.name}</div>
                  <div className="text-xs text-green-700 mt-1 flex flex-col gap-0.5">
                      <span>ID: <span className="font-mono bg-green-100 px-1 rounded">{folderMetadata.id}</span></span>
                      <span>Tìm thấy: <strong>{folderMetadata.count}</strong> ảnh</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {status === 'error' && errorMessage && (
              <div className="mt-2 bg-red-50 border border-red-100 rounded-md p-3 flex items-start text-sm text-red-800 animate-fadeIn">
                <AlertCircle className="w-5 h-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Lỗi kết nối</div>
                  <div className="text-xs text-red-700 mt-0.5">{errorMessage}</div>
                </div>
              </div>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Mật Khẩu (Tùy chọn)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="password"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 sm:text-sm shadow-sm group-hover:border-gray-400"
                placeholder="Nhập mật khẩu để bảo vệ album..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Options Switches */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            {/* DOWNLOAD OPTION */}
            <div>
              <div className="flex items-center justify-between group cursor-pointer" onClick={() => setAllowDownload(!allowDownload)}>
                <div className="flex items-center text-gray-700 group-hover:text-green-700 transition-colors">
                  <div className="bg-gray-100 p-2 rounded-full mr-3 group-hover:bg-green-50 transition-colors">
                    <Download className="w-4 h-4 text-gray-600 group-hover:text-green-600" />
                  </div>
                  <span className="text-sm font-medium">Cho phép tải xuống</span>
                </div>
                <Switch checked={allowDownload} onChange={setAllowDownload} />
              </div>
              
              {/* SUB OPTIONS FOR DOWNLOAD */}
              {allowDownload && (
                <div className="mt-3 ml-12 space-y-3 animate-in fade-in slide-in-from-top-1">
                   {/* Info Notification */}
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start">
                      <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span>Thông báo: Bạn đang cho phép người xem tải về file RAW và ảnh chất lượng gốc.</span>
                   </div>

                   <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                       <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="opt-original"
                            checked={allowDownloadOriginal}
                            onChange={(e) => setAllowDownloadOriginal(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                          />
                          <label htmlFor="opt-original" className="ml-2 flex items-center text-sm text-gray-600 cursor-pointer select-none group">
                            <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 group-hover:text-green-600" />
                            Chất lượng ảnh gốc (Original)
                          </label>
                       </div>
                       <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="opt-raw"
                            checked={allowDownloadRaw}
                            onChange={(e) => setAllowDownloadRaw(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                          />
                          <label htmlFor="opt-raw" className="ml-2 flex items-center text-sm text-gray-600 cursor-pointer select-none group">
                            <FileImage className="w-3.5 h-3.5 mr-1.5 text-gray-400 group-hover:text-green-600" />
                            Cho phép tải file RAW
                          </label>
                       </div>
                   </div>
                </div>
              )}
            </div>

            {/* COMMENT OPTION */}
            <div>
              <div className="flex items-center justify-between group cursor-pointer" onClick={() => setAllowComment(!allowComment)}>
                <div className="flex items-center text-gray-700 group-hover:text-green-700 transition-colors">
                  <div className="bg-gray-100 p-2 rounded-full mr-3 group-hover:bg-green-50 transition-colors">
                    <MessageSquare className="w-4 h-4 text-gray-600 group-hover:text-green-600" />
                  </div>
                  <span className="text-sm font-medium">Cho phép bình luận</span>
                </div>
                <Switch checked={allowComment} onChange={setAllowComment} />
              </div>
              
              {allowComment && (
                <div className="mt-3 ml-12 animate-in fade-in slide-in-from-top-1">
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start">
                      <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span>Thông báo: Cho phép người xem thêm bình luận cho từng ảnh.</span>
                   </div>
                </div>
              )}
            </div>

            {/* LIMIT PHOTOS OPTION */}
            <div>
              <div className="flex items-center justify-between group cursor-pointer" onClick={() => setLimitPhotos(!limitPhotos)}>
                <div className="flex items-center text-gray-700 group-hover:text-green-700 transition-colors">
                  <div className="bg-gray-100 p-2 rounded-full mr-3 group-hover:bg-green-50 transition-colors">
                    <List className="w-4 h-4 text-gray-600 group-hover:text-green-600" />
                  </div>
                  <span className="text-sm font-medium">Giới hạn số ảnh được chọn</span>
                </div>
                <Switch checked={limitPhotos} onChange={setLimitPhotos} />
              </div>

              {limitPhotos && (
                <div className="mt-3 ml-12 animate-in fade-in slide-in-from-top-1 space-y-3">
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start">
                      <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span>Thông báo: Giới hạn số lượng ảnh người xem có thể chọn trong album này.</span>
                   </div>
                   <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Số lượng ảnh tối đa</label>
                      <input
                          type="number"
                          min="1"
                          value={maxPhotoCount}
                          onChange={(e) => setMaxPhotoCount(parseInt(e.target.value) || 0)}
                          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-white"
                      />
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col items-center justify-center pt-6">
            <button
              type="submit"
              disabled={status === 'checking' || (status === 'error' && driveLink.length > 0)}
              className={`inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-lg text-white transform transition-all duration-200
                ${status === 'checking' || (status === 'error' && driveLink.length > 0)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }
              `}
            >
              {status === 'checking' ? (
                <>
                   <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                   ĐANG KIỂM TRA...
                </>
              ) : (
                <>
                   <Plus className="w-5 h-5 mr-2" />
                   TẠO ALBUM ẢNH
                </>
              )}
            </button>
            
            {/* Guest Limit Hint */}
            {!user && (
                <div className="mt-3 flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    <Lock className="w-3 h-3 mr-1 text-gray-400" />
                    <span>Miễn phí: {Math.max(0, 3 - guestCount)}/3 lượt tạo</span>
                </div>
            )}
          </div>

          {/* Info Alert */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start justify-center text-blue-800 text-xs mt-4">
             <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
             <span>Lưu ý: Hệ thống đọc file trực tiếp từ Google Drive API. Đảm bảo thư mục ở chế độ "Công khai" (Anyone with the link).</span>
          </div>

        </form>

        {/* Modal Hướng Dẫn - Sử dụng biến showGuide để fix lỗi TS6133 */}
        {showGuide && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Hướng Dẫn Cấu Hình</h3>
                    <div className="space-y-3 text-sm text-gray-600">
                        <p>1. Truy cập <strong>Google Cloud Console</strong>.</p>
                        <p>2. Tạo Project mới hoặc chọn Project hiện có.</p>
                        <p>3. Kích hoạt <strong>Google Drive API</strong>.</p>
                        <p>4. Tạo <strong>API Key</strong> trong mục Credentials.</p>
                        <p>5. Copy Key và dán vào ô nhập liệu.</p>
                    </div>
                    <button 
                        onClick={() => setShowGuide(false)}
                        className="mt-6 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                    >
                        Đã Hiểu
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};