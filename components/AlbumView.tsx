import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, Download, Check, FileSpreadsheet, Copy, X, AlertTriangle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageCircle, Send, User as UserIcon, Grid, Image as ImageIcon, Cloud, Activity, Globe, Save, FileText, RefreshCw, List, WifiOff } from 'lucide-react';
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from 'firebase/auth';

interface AlbumViewProps {
  albumId: string; // Đây là SessionID
  albumRef: string | null;
  user: User | null; 
}

interface Photo {
  id: string;
  url: string;
  name: string;
  isFavorite: boolean;
  isSelected: boolean;
  lastUpdatedBy?: string;
  selectedAt?: any; // Thêm trường timestamp
}

interface Comment {
    id: string;
    text: string;
    userName: string;
    userAvatar?: string;
    createdAt: any;
    photoId: string;
    albumId: string;
}

// Helper format ngày giờ
const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    let date;
    if (timestamp instanceof Date) {
        date = timestamp;
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return '';
    }
    return date.toLocaleString('vi-VN', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
};

export const AlbumView: React.FC<AlbumViewProps> = ({ albumId, user }) => {
  const [drivePhotos, setDrivePhotos] = useState<Photo[]>([]);
  
  // Map lưu trạng thái từ Server (Key: fileId)
  const [photoStates, setPhotoStates] = useState<Map<string, {
      isSelected: boolean, 
      isFavorite: boolean, 
      updatedBy?: string,
      selectedAt?: any 
  }>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [albumName, setAlbumName] = useState('Đang tải...');
  const [error, setError] = useState<string | null>(null);
  const [maxSelection, setMaxSelection] = useState<number | null>(null);
  
  // State lưu Folder ID thực sau khi tra cứu Session ID
  const [resolvedDriveFolderId, setResolvedDriveFolderId] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'selected' | 'favorite'>('all');

  const [allowComments, setAllowComments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  // State cho Modal xem danh sách
  const [showSelectionList, setShowSelectionList] = useState(false);
  const [isCopyingList, setIsCopyingList] = useState(false);
  
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [isZoomed, setIsZoomed] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50; 

  // --- KẾT HỢP DỮ LIỆU (DRIVE + FIRESTORE) ---
  const photos = useMemo(() => {
      return drivePhotos.map(p => {
          const state = photoStates.get(p.id);
          return {
              ...p,
              isSelected: state?.isSelected || false,
              isFavorite: state?.isFavorite || false,
              lastUpdatedBy: state?.updatedBy,
              selectedAt: state?.selectedAt
          };
      });
  }, [drivePhotos, photoStates]);

  const filteredPhotos = useMemo(() => {
      if (filterMode === 'selected') return photos.filter(p => p.isSelected);
      if (filterMode === 'favorite') return photos.filter(p => p.isFavorite);
      return photos;
  }, [photos, filterMode]);

  const selectedCount = useMemo(() => photos.filter(p => p.isSelected).length, [photos]);
  const favoriteCount = useMemo(() => photos.filter(p => p.isFavorite).length, [photos]);

  // List chỉ chứa ảnh đã chọn để hiển thị trong Modal
  const selectedPhotosList = useMemo(() => {
      return photos.filter(p => p.isSelected);
  }, [photos]);

  // 1. Resolve Session ID -> Drive ID (Từ bảng 'sessions')
  useEffect(() => {
      const resolveSession = async () => {
          if (!albumId) return;
          
          setLoading(true);
          
          try {
              // Đọc từ bảng 'sessions'
              const docRef = doc(db, "sessions", albumId);
              let docSnap = await getDoc(docRef);
              
              // Fallback: Kiểm tra bảng 'albums' cũ nếu không thấy trong 'sessions'
              if (!docSnap.exists()) {
                  const legacyRef = doc(db, "albums", albumId);
                  const legacySnap = await getDoc(legacyRef);
                  if (legacySnap.exists()) {
                      docSnap = legacySnap;
                  }
              }

              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setResolvedDriveFolderId(data.driveFolderId);
                  setAlbumName(data.albumName || "Album");
                  
                  if (data.settings) {
                      if (data.settings.limitPhotos) setMaxSelection(data.settings.limitPhotos);
                      if (data.settings.allowComment) setAllowComments(true);
                  }
              } else {
                  if (albumId.length > 20) {
                      setResolvedDriveFolderId(albumId);
                  } else {
                      setError("Album không tồn tại hoặc mã phiên không hợp lệ.");
                      setLoading(false);
                  }
              }
          } catch (e) {
              console.error("Lỗi resolve session:", e);
              setError("Lỗi kết nối hệ thống.");
              setLoading(false);
          }
      };

      resolveSession();
  }, [albumId]);

  // 2. Fetch Photos from Drive
  const fetchPhotosFromDrive = async () => {
      if (!resolvedDriveFolderId) return;

      setLoading(true);
      setError(null);
      setDrivePhotos([]);
      
      let apiKey = localStorage.getItem('google_api_key');
      if (!apiKey) {
          apiKey = 'AIzaSyD0swN9M4-VzVfA0h0mMTb3OSmD8CAcH1c';
      }
      
      if (!apiKey) {
          setError("Chưa cấu hình Google API Key.");
          setLoading(false);
          return;
      }

      try {
           const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${resolvedDriveFolderId}?fields=name&key=${apiKey}`);
           if (folderRes.ok) {
             const folderData = await folderRes.json();
             setAlbumName(folderData.name);
           }

           // Tải 1000 ảnh
           const imagesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${resolvedDriveFolderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false&fields=files(id,name,thumbnailLink,webContentLink)&pageSize=1000&key=${apiKey}`);
           
           if (imagesRes.ok) {
             const imagesData = await imagesRes.json();
             if (imagesData.files && imagesData.files.length > 0) {
               const mappedPhotos = imagesData.files.map((f: any) => ({
                   id: f.id,
                   url: `https://lh3.googleusercontent.com/d/${f.id}`,
                   name: f.name,
                   isFavorite: false, 
                   isSelected: false,
                   lastUpdatedBy: undefined
               }));
               setDrivePhotos(mappedPhotos);
             } else {
               setError("Thư mục này trống.");
             }
           } else {
              throw new Error("Không thể lấy danh sách ảnh.");
           }
      } catch (e: any) {
          console.error("Error fetching from Drive", e);
          setError(e.message || "Đã xảy ra lỗi khi tải album.");
      } finally {
          setLoading(false);
      }
    };

  useEffect(() => {
    if (resolvedDriveFolderId) {
        fetchPhotosFromDrive();
    }
  }, [resolvedDriveFolderId]);

  // 3. Firestore Listener (Đọc từ bảng 'selections')
  useEffect(() => {
      if (!albumId) return;

      setIsSyncing(true);
      
      // Query bảng 'selections'
      const q = query(
          collection(db, "selections"), 
          where("sessionId", "==", albumId) 
      );
      // Fallback query bảng cũ để hiển thị dữ liệu cũ nếu có
      const qLegacy = query(
          collection(db, "global_photo_selection"),
          where("sessionId", "==", albumId)
      );

      // Hàm xử lý dữ liệu snapshot
      const handleSnapshot = (snapshot: any) => {
          setIsSyncing(false);
          setLastSyncTime(new Date());

          const nextMap = new Map<string, {isSelected: boolean, isFavorite: boolean, updatedBy?: string, selectedAt?: any}>();
          
          snapshot.forEach((doc: any) => {
              const data = doc.data();
              const pid = data.fileId || data.photoId; // Hỗ trợ cả fileId mới và photoId cũ
              
              if (pid) {
                  // Logic đọc trạng thái
                  const isSelected = (data.selected !== undefined) ? data.selected : (data.isSelected || false);
                  
                  nextMap.set(pid, {
                      isSelected: isSelected,
                      isFavorite: data.isFavorite || false,
                      updatedBy: data.updatedByName || 'Khách',
                      selectedAt: data.selectedAt || data.updatedAt
                  });
              }
          });
          setPhotoStates(nextMap);
      };

      // Thử nghe bảng mới 'selections' trước
      const unsubscribe = onSnapshot(q, handleSnapshot, (_error) => {
          // Nếu lỗi hoặc không có quyền (do rule), thử nghe bảng cũ
          console.log("Listening to legacy collection...");
          onSnapshot(qLegacy, handleSnapshot);
      });

      return () => unsubscribe();
  }, [albumId]);

  // Comments Listener
  useEffect(() => {
      if (!allowComments || lightboxIndex === -1 || !showComments) return;
      const currentPhotoId = filteredPhotos[lightboxIndex]?.id;
      if (!currentPhotoId) return;

      const q = query(collection(db, "album_comments"), where("photoId", "==", currentPhotoId), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const loadedComments: Comment[] = [];
          snapshot.forEach((doc) => { loadedComments.push({ id: doc.id, ...doc.data() } as Comment); });
          setComments(loadedComments);
          setTimeout(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
      });
      return () => unsubscribe();
  }, [allowComments, lightboxIndex, showComments, filteredPhotos]);

  useEffect(() => { setIsZoomed(false); }, [lightboxIndex]);

  const nextPhoto = (e?: any) => { e?.stopPropagation(); setLightboxIndex(prev => (prev + 1) % filteredPhotos.length); };
  const prevPhoto = (e?: any) => { e?.stopPropagation(); setLightboxIndex(prev => (prev - 1 + filteredPhotos.length) % filteredPhotos.length); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (lightboxIndex === -1) return;
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        switch(e.key) {
            case 'ArrowLeft': prevPhoto(); break;
            case 'ArrowRight': nextPhoto(); break;
            case 'Escape': setLightboxIndex(-1); setShowComments(false); break;
            case ' ': e.preventDefault(); const currentP = filteredPhotos[lightboxIndex]; if(currentP) toggleSelect(currentP.id); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredPhotos]);

  useEffect(() => {
    if (lightboxIndex !== -1 && filmstripRef.current) {
        const activeThumb = filmstripRef.current.children[lightboxIndex] as HTMLElement;
        if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [lightboxIndex]);

  const getUserDisplayName = () => {
      if (user?.isAnonymous) return "Khách";
      if (user?.displayName) return user.displayName;
      if (user?.email) return user.email.split('@')[0];
      return "Khách";
  }

  // --- HÀM LƯU DỮ LIỆU (QUAN TRỌNG) ---
  // Khóa logic: sessionId + fileId (Dùng ID document để đảm bảo mỗi ảnh có 1 trạng thái)
  const getDocId = (fileId: string) => `${albumId}_${fileId}`;

  const toggleFavorite = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    
    const newState = !photo.isFavorite;
    const userName = getUserDisplayName();
    const currentState = photoStates.get(id) || { isSelected: false, isFavorite: false };

    const tempMap = new Map(photoStates);
    tempMap.set(id, { ...currentState, isFavorite: newState, updatedBy: userName });
    setPhotoStates(tempMap);
    
    setIsSyncing(true);
    setSaveError(null);

    try {
        // Lưu vào bảng 'selections'
        const docRef = doc(db, "selections", getDocId(id));
        await setDoc(docRef, {
            sessionId: albumId, 
            fileId: id,
            fileName: photo.name,
            isFavorite: newState,
            updatedAt: Timestamp.now(),
            updatedByName: userName
        }, { merge: true });
    } catch (e: any) {
        console.error("Lỗi lưu tim:", e);
        const revertMap = new Map(photoStates);
        revertMap.set(id, currentState);
        setPhotoStates(revertMap);
        setIsSyncing(false);
        setSaveError("Lỗi lưu! Kiểm tra mạng");
        alert("Không thể lưu thay đổi. Vui lòng kiểm tra kết nối internet.");
    }
  };

  const toggleSelect = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    if (!photo.isSelected && maxSelection !== null && selectedCount >= maxSelection) {
         alert(`Album này giới hạn chỉ được chọn tối đa ${maxSelection} ảnh.`);
         return;
    }
    
    const newState = !photo.isSelected;
    const userName = getUserDisplayName();
    const currentState = photoStates.get(id) || { isSelected: false, isFavorite: false };
    const now = Timestamp.now();

    // Optimistic Update
    const tempMap = new Map(photoStates);
    tempMap.set(id, { ...currentState, isSelected: newState, updatedBy: userName, selectedAt: newState ? now : undefined });
    setPhotoStates(tempMap);
    
    setIsSyncing(true);
    setSaveError(null);

    try {
        // Lưu vào bảng 'selections'
        // Logic: sessionId + fileId (duy nhất)
        const docRef = doc(db, "selections", getDocId(id));
        
        // PAYLOAD API: Tuân thủ nghiêm ngặt yêu cầu backend
        const payload = {
            sessionId: albumId,     
            fileId: id,             
            fileName: photo.name,   
            selected: newState, // TRUE/FALSE
            selectedAt: newState ? now : null, // Timestamp
            
            // Các field phụ trợ (Audit)
            updatedAt: now,
            updatedByName: userName
        };

        await setDoc(docRef, payload, { merge: true });
    } catch (e: any) {
        console.error("Lỗi lưu chọn:", e);
        const revertMap = new Map(photoStates);
        revertMap.set(id, currentState);
        setPhotoStates(revertMap);
        setIsSyncing(false);
        setSaveError("Lỗi lưu! Kiểm tra mạng");
        alert("Không thể lưu lựa chọn. Vui lòng kiểm tra kết nối internet.");
    }
  };

  const handleDownload = (id: string, name?: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const url = `https://drive.google.com/uc?export=download&id=${id}`;
      const link = document.createElement('a');
      link.href = url;
      if (name) link.setAttribute('download', name);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleOpenSelectionList = () => {
      if (selectedCount === 0) { alert("Chưa có ảnh nào được chọn!"); return; }
      setShowSelectionList(true);
  };
  
  // Logic Copy Tên File
  const handleCopyListText = () => {
      const text = selectedPhotosList.map(p => p.name).join('\n');
      navigator.clipboard.writeText(text).then(() => {
          setIsCopyingList(true);
          setTimeout(() => setIsCopyingList(false), 2000);
      }).catch(() => { alert('Không thể sao chép vào bộ nhớ tạm.'); });
  };

  // Logic Export CSV
  const handleExportCSV = () => {
    const header = "File Name,File ID,Selected At,Status\n";
    const rows = selectedPhotosList.map(p => {
        const timeStr = formatTimestamp(p.selectedAt);
        return `"${p.name}","${p.id}","${timeStr}","Selected"`;
    }).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `selection_${albumId}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleZoom = (e?: React.MouseEvent) => { e?.stopPropagation(); setIsZoomed(!isZoomed); };

  const handleAddComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim()) return;
      const userName = getUserDisplayName();
      const userAvatar = user?.photoURL || "";
      try {
          await addDoc(collection(db, "album_comments"), {
              albumId: albumId, photoId: filteredPhotos[lightboxIndex].id, text: newComment.trim(),
              userName: userName, userAvatar: userAvatar, createdAt: Timestamp.now(), userId: user?.uid || "guest"
          });
          setNewComment("");
      } catch (e: any) { console.error("Lỗi gửi bình luận:", e); alert("Không thể gửi bình luận."); }
  };

  const onTouchStart = (e: React.TouchEvent) => { if (isZoomed) return; touchEndX.current = 0; touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { if (isZoomed) return; touchEndX.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => { if (isZoomed || !touchStartX.current || !touchEndX.current) return; const distance = touchStartX.current - touchEndX.current; if (distance > minSwipeDistance) nextPhoto(); if (distance < -minSwipeDistance) prevPhoto(); };

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-300 animate-pulse">{resolvedDriveFolderId ? 'Đang tải ảnh từ Google Drive...' : 'Đang kết nối tới Session...'}</p>
        </div>
    );
  }

  if (error) {
      return (
          <div className="flex items-center justify-center min-h-[60vh] p-4">
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center border-t-4 border-red-500">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Lỗi tải Album</h3>
                  <p className="text-gray-600 mb-6">{error}</p>
                  <a href="/" className="px-6 py-2 bg-green-600 text-white rounded-full hover:bg-green-700">Trang chủ</a>
              </div>
          </div>
      );
  }

  const currentPhoto = lightboxIndex >= 0 ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="bg-white rounded-md shadow-2xl overflow-hidden min-h-screen pb-20 border border-gray-200">
      
      {/* MODAL DANH SÁCH & EXPORT */}
      {showSelectionList && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSelectionList(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <List className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-gray-800">Danh sách đã chọn ({selectedCount})</h3>
                    </div>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-mono">
                        Session: {albumId}
                    </div>
                    <button onClick={() => setShowSelectionList(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-6 h-6" /></button>
                </div>
                
                {/* TABLE VIEW */}
                <div className="flex-1 overflow-auto bg-gray-50 p-2">
                    <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden text-sm">
                        <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-4 py-3 text-left w-12">#</th>
                                <th className="px-4 py-3 text-left">Tên File</th>
                                <th className="px-4 py-3 text-left hidden sm:table-cell">File ID</th>
                                <th className="px-4 py-3 text-right">Thời Gian Chọn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {selectedPhotosList.map((p, index) => (
                                <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-4 py-2 text-gray-500 text-center font-mono">{index + 1}</td>
                                    <td className="px-4 py-2 font-medium text-gray-800 break-all">{p.name}</td>
                                    <td className="px-4 py-2 text-gray-500 font-mono text-xs hidden sm:table-cell">{p.id}</td>
                                    <td className="px-4 py-2 text-right text-gray-600 text-xs whitespace-nowrap">
                                        {formatTimestamp(p.selectedAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row gap-3">
                    <button onClick={handleCopyListText} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-white transition-all ${isCopyingList ? 'bg-green-700 scale-95' : 'bg-green-600 hover:bg-green-700 hover:scale-[1.02] shadow-lg'}`}>
                        {isCopyingList ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} {isCopyingList ? 'Đã Sao Chép Tên!' : 'Copy Danh Sách Tên'}
                    </button>
                    <button onClick={handleExportCSV} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] shadow-lg transition-all">
                        <FileSpreadsheet className="w-5 h-5" /> Export Excel/CSV
                    </button>
                    <button onClick={() => setShowSelectionList(false)} className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100">Đóng</button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-[#2e7d32] text-white py-3 px-4 md:px-6 shadow-md relative z-20 border-b-4 border-[#1b5e20]">
        <div className="flex justify-between items-start absolute top-3 right-3 z-30">
             <button onClick={fetchPhotosFromDrive} className="p-1.5 bg-green-800/50 hover:bg-green-700 rounded-full text-green-100 transition-colors" title="Làm mới dữ liệu"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <h1 className="text-lg md:text-2xl font-medium tracking-wide uppercase shadow-black drop-shadow-md text-center pr-8 pl-8">
            {albumName} ({photos.length} ảnh)
            {maxSelection !== null && <span className="block text-xs md:text-sm font-normal text-yellow-300 mt-1 bg-black/20 rounded-full py-0.5 px-3 w-fit mx-auto">Giới hạn: {selectedCount}/{maxSelection} ảnh</span>}
        </h1>
        
        {/* TRẠNG THÁI SERVER */}
        <div className="flex flex-col items-center justify-center mt-2 space-y-1">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border shadow-sm bg-blue-50 text-blue-800 border-blue-200">
                <Globe className="w-3.5 h-3.5" /> <span>PHIÊN ONLINE: {albumId}</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-green-100 min-h-[20px]">
                 {saveError ? (
                     <span className="flex items-center text-red-300 font-bold animate-pulse">
                         <WifiOff className="w-3 h-3 mr-1" /> {saveError}
                     </span>
                 ) : isSyncing ? (
                     <span className="flex items-center animate-pulse text-yellow-300 font-bold">
                         <Save className="w-3 h-3 mr-1" /> Đang lưu lên Server...
                     </span>
                 ) : (
                     <span className="flex items-center opacity-80">
                         <Cloud className="w-3 h-3 mr-1" /> Đã lưu an toàn {lastSyncTime ? `lúc ${lastSyncTime.toLocaleTimeString()}` : ''}
                     </span>
                 )}
            </div>
        </div>

        <div className="flex justify-center mt-3 space-x-2 md:space-x-4">
            <button onClick={() => setFilterMode('all')} className={`flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${filterMode === 'all' ? 'bg-white text-green-700 font-bold shadow-lg' : 'bg-green-800/50 text-green-100 hover:bg-green-700'}`}>
                <Grid className="w-3 h-3 md:w-4 md:h-4 mr-1.5" /> Tất cả ({photos.length})
            </button>
            <button onClick={() => setFilterMode('selected')} className={`flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${filterMode === 'selected' ? 'bg-white text-green-700 font-bold shadow-lg ring-2 ring-yellow-400' : 'bg-green-800/50 text-green-100 hover:bg-green-700'}`}>
                <Check className="w-3 h-3 md:w-4 md:h-4 mr-1.5" /> Đã chọn ({selectedCount})
            </button>
            <button onClick={() => setFilterMode('favorite')} className={`flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm transition-all ${filterMode === 'favorite' ? 'bg-white text-red-600 font-bold shadow-lg' : 'bg-green-800/50 text-green-100 hover:bg-green-700'}`}>
                <Heart className={`w-3 h-3 md:w-4 md:h-4 mr-1.5 ${filterMode === 'favorite' ? 'fill-current' : ''}`} /> Yêu thích ({favoriteCount})
            </button>
        </div>
      </div>

      <div className="p-2 md:p-3 bg-white min-h-[600px]">
        {filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <ImageIcon className="w-16 h-16 mb-2 opacity-20" />
                <p>Không có ảnh nào trong mục này.</p>
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2">
                {filteredPhotos.map((photo, index) => (
                    <div key={photo.id} className={`relative group aspect-[3/2] overflow-hidden rounded-sm bg-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer ${photo.isSelected ? 'ring-4 ring-green-500' : ''}`} onClick={() => setLightboxIndex(index)}>
                        <img src={photo.url} alt={photo.name} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${photo.isSelected ? 'scale-95' : ''}`} loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${photo.id}&sz=w600`; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {photo.lastUpdatedBy && (photo.isSelected || photo.isFavorite) && (
                            <div className="absolute bottom-1 left-1 z-20 bg-black/40 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded flex items-center">
                                <Activity className="w-2.5 h-2.5 mr-1" /> {photo.lastUpdatedBy}
                            </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(photo.id); }} className="absolute top-2 right-2 p-2 rounded-full hover:bg-black/20 transition-colors z-20">
                            <Heart className={`w-6 h-6 drop-shadow-lg ${photo.isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                        </button>
                        <button onClick={(e) => handleDownload(photo.id, photo.name, e)} className="absolute bottom-2 right-2 p-1.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-20" title="Tải ảnh gốc"><Download className="w-4 h-4" /></button>
                        {photo.isSelected ? (
                            <div className="absolute top-2 left-2 z-20" onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}>
                                <div className="bg-green-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"><Check className="w-4 h-4" /></div>
                            </div>
                        ) : (
                            <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}>
                                <div className="w-6 h-6 rounded-full border-2 border-white hover:bg-white/20 transition-colors shadow-sm"></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>

      {lightboxIndex !== -1 && currentPhoto && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
            <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-start p-4 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm text-[#4CAF50] px-3 py-1 rounded-full text-sm font-mono font-bold pointer-events-auto border border-white/10">
                    {lightboxIndex + 1} / {filteredPhotos.length} {filterMode !== 'all' && <span className="text-xs font-normal text-gray-300 ml-1">({filterMode === 'selected' ? 'Đã chọn' : 'Yêu thích'})</span>}
                </div>
                <div className="flex items-center gap-4 pointer-events-auto">
                    <button onClick={toggleZoom} className="text-[#4CAF50] hover:text-green-400 transition-transform hover:scale-110 p-2 bg-black/20 rounded-full" title={isZoomed ? "Thu nhỏ" : "Phóng to"}>{isZoomed ? <ZoomOut className="w-6 h-6" /> : <ZoomIn className="w-6 h-6" />}</button>
                    <button onClick={() => { setLightboxIndex(-1); setShowComments(false); }} className="text-[#4CAF50] hover:text-green-400 transition-transform hover:scale-110 p-2 bg-black/20 rounded-full"><X className="w-8 h-8" /></button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden group touch-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-between px-2 md:px-4">
                    <button onClick={prevPhoto} className="p-3 text-white/50 hover:text-white transition-colors hover:bg-black/40 rounded-full pointer-events-auto"><ChevronLeft className="w-10 h-10 md:w-16 md:h-16" /></button>
                    <button onClick={nextPhoto} className="p-3 text-white/50 hover:text-white transition-colors hover:bg-black/40 rounded-full pointer-events-auto"><ChevronRight className="w-10 h-10 md:w-16 md:h-16" /></button>
                </div>
                <div className="absolute bottom-4 right-4 flex flex-col gap-4 z-30 pointer-events-auto">
                     <button onClick={(e) => { e.stopPropagation(); toggleSelect(currentPhoto.id); }} className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl transition-all hover:scale-110 border-2 ${currentPhoto.isSelected ? 'bg-green-600 border-green-500' : 'bg-black/40 border-white/30 hover:bg-white/20'}`} title={currentPhoto.isSelected ? "Bỏ chọn" : "Chọn ảnh"}><Check className="w-6 h-6" /></button>
                     <button onClick={(e) => { e.stopPropagation(); toggleFavorite(currentPhoto.id); }} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 border-2 ${currentPhoto.isFavorite ? 'bg-red-500 border-red-500 text-white' : 'bg-black/40 border-white/30 text-white hover:bg-white/20'}`} title={currentPhoto.isFavorite ? "Bỏ thích" : "Yêu thích"}><Heart className={`w-6 h-6 ${currentPhoto.isFavorite ? 'fill-current' : ''}`} /></button>
                     <button onClick={(e) => handleDownload(currentPhoto.id, currentPhoto.name, e)} className="w-12 h-12 bg-[#4CAF50] rounded-full flex items-center justify-center text-white shadow-xl hover:bg-green-600 transition-all hover:scale-110 border-2 border-green-400" title="Tải ảnh gốc"><Download className="w-6 h-6" /></button>
                     {allowComments && <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl transition-all hover:scale-110 border-2 ${showComments ? 'bg-[#5d4037] border-white' : 'bg-[#5d4037] border-[#8d6e63]'}`}><MessageCircle className="w-6 h-6" /></button>}
                </div>
                {showComments && (
                    <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-white/95 backdrop-blur-md shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center"><MessageCircle className="w-4 h-4 mr-2" /> Bình Luận</h3>
                            <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {comments.length === 0 ? <div className="text-center text-gray-400 py-10 text-sm">Chưa có bình luận nào.<br/>Hãy là người đầu tiên!</div> : comments.map((comment) => (
                                <div key={comment.id} className="flex items-start space-x-2">
                                    <div className="flex-shrink-0">{comment.userAvatar ? <img src={comment.userAvatar} alt="" className="w-8 h-8 rounded-full border border-gray-200" /> : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><UserIcon className="w-4 h-4" /></div>}</div>
                                    <div className="bg-gray-100 rounded-lg p-2.5 flex-1 text-sm">
                                        <div className="flex justify-between items-baseline mb-0.5"><strong className="text-gray-800 text-xs">{comment.userName}</strong><span className="text-[10px] text-gray-400 ml-2">{comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : ''}</span></div>
                                        <p className="text-gray-700 break-words">{comment.text}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={commentsEndRef} />
                        </div>
                        <div className="p-3 border-t border-gray-200 bg-white">
                            <form onSubmit={handleAddComment} className="flex gap-2">
                                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Viết bình luận..." className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" onKeyDown={(e) => e.stopPropagation()} />
                                <button type="submit" className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 transition-colors flex-shrink-0" disabled={!newComment.trim()}><Send className="w-4 h-4" /></button>
                            </form>
                        </div>
                    </div>
                )}
                <div className={`w-full h-full flex items-center justify-center ${isZoomed ? 'overflow-auto items-start' : 'overflow-hidden'}`} onClick={(e) => { if(isZoomed) toggleZoom(e); }}>
                    <img src={currentPhoto.url} alt={currentPhoto.name} className={`transition-all duration-300 ${isZoomed ? 'min-h-[150vh] min-w-[150vw] object-contain cursor-zoom-out' : 'max-h-[calc(100vh-140px)] max-w-full object-contain cursor-zoom-in'}`} onClick={toggleZoom} referrerPolicy="no-referrer" />
                </div>
            </div>

            <div className="bg-black z-20 flex flex-col pb-2">
                <div className="text-center text-gray-300 py-1 text-sm font-medium">{currentPhoto.name}</div>
                <div className="relative h-16 md:h-20 bg-[#111] w-full flex items-center">
                    <div ref={filmstripRef} className="flex overflow-x-auto gap-1 px-2 h-full items-center w-full scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
                        {filteredPhotos.map((photo, idx) => (
                            <div key={photo.id} onClick={() => setLightboxIndex(idx)} className={`relative flex-shrink-0 cursor-pointer h-14 w-20 md:h-16 md:w-24 transition-all duration-200 ${idx === lightboxIndex ? 'ring-2 ring-[#4CAF50] opacity-100 scale-105 z-10' : 'opacity-60 hover:opacity-100'}`}>
                                <img src={photo.url} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                {photo.isSelected && <div className="absolute top-0 right-0 bg-green-500 p-0.5"><Check className="w-3 h-3 text-white" /></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {lightboxIndex === -1 && (
        <div className="fixed bottom-10 right-4 flex flex-col gap-3 z-50 items-center">
             <button onClick={handleExportCSV} className="w-10 h-10 md:w-11 md:h-11 bg-[#0F9D58] text-white rounded-full shadow-xl flex items-center justify-center hover:bg-[#0B8043] transition-transform hover:scale-110 tooltip-left" title="Xuất Excel/CSV"><FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6" /></button>
             <button className="w-10 h-10 md:w-11 md:h-11 bg-[#4CAF50] text-white rounded-full shadow-xl flex items-center justify-center hover:bg-[#43A047] transition-transform hover:scale-110" title="Xác nhận chọn"><Check className="w-6 h-6 md:w-7 md:h-7 stroke-[3]" /></button>
             <button onClick={handleOpenSelectionList} className="w-10 h-10 md:w-11 md:h-11 bg-[#2979FF] text-white rounded-full shadow-xl flex items-center justify-center hover:bg-[#2962FF] transition-transform hover:scale-110" title="Xem & Sao chép danh sách"><FileText className="w-5 h-5 md:w-6 md:h-6" /></button>
             <div className="pt-1">
                <button onClick={() => setFilterMode('selected')} className={`w-10 h-10 md:w-11 md:h-11 text-white shadow-xl flex items-center justify-center transform rotate-45 hover:scale-110 transition-transform cursor-pointer border-2 border-white ${maxSelection !== null && selectedCount >= maxSelection ? 'bg-gray-500' : 'bg-[#FF0000]'}`}>
                    <span className="transform -rotate-45 font-bold text-sm md:text-base">{selectedCount}{maxSelection ? `/${maxSelection}` : ''}</span>
                </button>
             </div>
        </div>
      )}
    </div>
  );
};