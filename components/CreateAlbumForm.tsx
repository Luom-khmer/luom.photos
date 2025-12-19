import React, { useState, useEffect } from 'react';
import { Triangle, Download, MessageSquare, List, Plus, Info, Loader2, CheckCircle, AlertCircle, FolderOpen, Settings, X, ExternalLink, HelpCircle, FileImage, Image as ImageIcon, Copy, Check, RefreshCw, Shield, Users, Trash2, UserPlus, Link as LinkIcon } from 'lucide-react';
import { Switch } from './ui/Switch';
import { User } from 'firebase/auth';
import { db, ADMIN_EMAILS } from '../firebaseConfig';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, Timestamp } from 'firebase/firestore';

interface CreateAlbumFormProps {
  user: User | null;
}

export const CreateAlbumForm: React.FC<CreateAlbumFormProps> = ({ user }) => {
  const [driveLink, setDriveLink] = useState('');
  
  // Logic xác định quyền Admin
  const isRealUser = user && !user.isAnonymous;
  const isAdmin = isRealUser && user.email && ADMIN_EMAILS.includes(user.email);

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

  // User Management State
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
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBlobUrl, setIsBlobUrl] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('google_api_key', apiKey);
        setIsBlobUrl(window.location.protocol === 'blob:');
    }
    if (driveLink && driveLink.length > 10) {
        checkDriveLink(driveLink);
    }
  }, [apiKey]);

  // Realtime Listener for Users
  useEffect(() => {
    if (isAdmin && showSettings) {
        setLoadingUsers(true);
        const q = query(collection(db, "allowed_users"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users: any[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                const email = data.email || docSnapshot.id;
                if (data.banned !== true) {
                    users.push({
                        ...data,
                        email: email
                    });
                }
            });
            
            const getTime = (t: any) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds * 1000;
                if (typeof t.getTime === 'function') return t.getTime();
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

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUserEmail || !newUserEmail.includes('@')) {
          alert("Email không hợp lệ");
          return;
      }
      try {
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

  const handleBlockUser = async (emailToBlock: string) => {
      if (emailToBlock === user?.email) {
          alert("Bạn không thể chặn chính mình!");
          return;
      }

      if (window.confirm(`Bạn muốn CHẶN quyền truy cập của ${emailToBlock}?\n\nNgười dùng này sẽ biến mất khỏi danh sách và không thể đăng nhập nữa.`)) {
          try {
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

  const generateSessionId = () => {
      // Tạo mã ngẫu nhiên 6 ký tự (VD: A7X2M9)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Bỏ các ký tự dễ nhầm (I, O, 1, 0)
      let result = '';
      for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status === 'success' && folderMetadata) {
      setIsCreating(true);
      
      // 1. Tạo Session ID
      const sessionId = generateSessionId();
      
      // 2. Lưu Mapping vào Firestore (Bảng 'sessions' thay vì 'albums')
      try {
          await setDoc(doc(db, "sessions", sessionId), {
              sessionId: sessionId,
              driveFolderId: folderMetadata.id,
              albumName: folderMetadata.name,
              createdAt: Timestamp.now(),
              createdBy: user?.email || 'anonymous',
              settings: {
                  allowDownload,
                  allowDownloadOriginal,
                  allowDownloadRaw,
                  allowComment,
                  limitPhotos: limitPhotos ? maxPhotoCount : null
              }
          });

          // 3. Tạo Link
          const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://luomphotos.com';
          const baseUrl = currentUrl.split('?')[0].split('#')[0];
          const finalUrl = `${baseUrl}?session=${sessionId}`;
          
          setCreatedSessionId(sessionId);
          setCreatedLink(finalUrl);
      } catch (error) {
          console.error("Lỗi khi tạo phiên trên Firestore:", error);
          alert("Lỗi: Không thể lưu thông tin phiên vào hệ thống.");
      } finally {
          setIsCreating(false);
      }

    } else {
      if (status === 'error') {
        alert(errorMessage || 'Vui lòng kiểm tra lại đường dẫn.');
      } else if (!apiKey) {
        alert('Thiếu API Key.');
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
      setCreatedSessionId(null);
      setDriveLink('');
      setFolderMetadata(null);
      setStatus('idle');
  };

  // --- RENDER SUCCESS VIEW ---
  if (createdLink && folderMetadata && createdSessionId) {
      return (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-6 md:p-8 w-full border border-gray-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
             
             <div className="relative z-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Session Đã Được Tạo!</h2>
                <p className="text-gray-500 text-sm mb-6">Mã phiên (Session ID) được lưu trữ trên hệ thống.</p>

                {/* Folder Info Card */}
                <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex items-start text-left">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{folderMetadata.name}</h3>
                        <div className="flex flex-col mt-1 gap-1">
                            <span className="text-xs text-gray-500">Mã Drive gốc: {folderMetadata.id.substring(0, 8)}...</span>
                            <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded w-fit">
                                MÃ PHIÊN: {createdSessionId}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Copy Link Section */}
                <div className="w-full space-y-2 mb-8">
                    <label className="block text-sm font-medium text-gray-700 text-left pl-1">Link Chia Sẻ Cho Khách</label>
                    <div className="flex shadow-sm rounded-md transition-all duration-200 ring-1 ring-gray-300 focus-within:ring-2 focus-within:ring-green-500">
                        <div className="flex-grow relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LinkIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                readOnly
                                value={createdLink}
                                className="block w-full pl-10 sm:text-sm border-none rounded-l-md bg-white text-gray-600 py-3 focus:ring-0 font-mono text-lg md:text-xl font-bold tracking-tight text-center md:text-left"
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
                        Dữ liệu chọn ảnh sẽ được lưu vào bảng <strong>selections</strong> với Session ID này.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 w-full">
                     <button
                        onClick={handleReset}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tạo Session Khác
                    </button>
                    <a
                        href={createdLink}
                        target={isBlobUrl ? "_self" : "_blank"} 
                        rel="noreferrer"
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Vào Xem Album
                    </a>
                </div>
             </div>
        </div>
      );
  }

  // --- RENDER FORM ---
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-6 md:p-8 w-full border border-gray-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
            <div className="w-8"></div>
            <h2 className="text-2xl md:text-3xl font-light text-center text-gray-700 tracking-wide uppercase flex-1">
            Bắt Đầu Tạo Album Ảnh
            </h2>
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

                    <div className="pt-2 border-t border-gray-200">
                        <label className="text-xs font-bold text-gray-600 uppercase flex items-center mb-2">
                            <Users className="w-3.5 h-3.5 mr-1" />
                            Danh sách người dùng
                        </label>
                        
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
                                                </div>
                                            </div>
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
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {status === 'checking' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                {status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              </div>
            </div>

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

          <div className="space-y-4 pt-4 border-t border-gray-100">
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
              
              {allowDownload && (
                <div className="mt-3 ml-12 space-y-3 animate-in fade-in slide-in-from-top-1">
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

          <div className="flex flex-col items-center justify-center pt-6">
            <button
              type="submit"
              disabled={status === 'checking' || (status === 'error' && driveLink.length > 0) || isCreating}
              className={`inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-lg text-white transform transition-all duration-200
                ${status === 'checking' || (status === 'error' && driveLink.length > 0) || isCreating
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }
              `}
            >
              {(status === 'checking' || isCreating) ? (
                <>
                   <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                   {isCreating ? 'ĐANG TẠO SESSION...' : 'ĐANG KIỂM TRA...'}
                </>
              ) : (
                <>
                   <Plus className="w-5 h-5 mr-2" />
                   TẠO ALBUM ẢNH
                </>
              )}
            </button>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start justify-center text-blue-800 text-xs mt-4">
             <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
             <span>Lưu ý: Hệ thống đọc file trực tiếp từ Google Drive API. Đảm bảo thư mục ở chế độ "Công khai" (Anyone with the link).</span>
          </div>

        </form>

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