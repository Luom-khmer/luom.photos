import React, { useState, useEffect } from 'react';
import { Triangle, Key, Download, MessageSquare, List, Plus, Info, Loader2, CheckCircle, AlertCircle, FolderOpen, Settings, X, ExternalLink, HelpCircle, FileImage, Image as ImageIcon, Copy, Check, Share2, RefreshCw } from 'lucide-react';
import { Switch } from './ui/Switch';

export const CreateAlbumForm: React.FC = () => {
  const [driveLink, setDriveLink] = useState('');
  const [password, setPassword] = useState('');
  
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('google_api_key', apiKey);
        setIsBlobUrl(window.location.protocol === 'blob:');
    }
    if (driveLink && driveLink.length > 10) {
        checkDriveLink(driveLink);
    }
  }, [apiKey]);

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
        setErrorMessage('Yêu cầu Google API Key để kiểm tra link thật. Vui lòng nhấn vào icon bánh răng để cài đặt.');
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
    if (status === 'success' && folderMetadata) {
      // Safer URL generation using string manipulation to avoid Blob URL object issues
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://luomphotos.com';
      
      // Strip everything after ? or # to get clean base
      const baseUrl = currentUrl.split('?')[0].split('#')[0];
      
      // Construct Hash-based URL: baseUrl + #?album=ID
      // This pattern is compatible with most static/blob hosting
      const finalUrl = `${baseUrl}#?album=${folderMetadata.id}`;
      
      setCreatedLink(finalUrl);
    } else {
      if (status === 'error') {
        alert(errorMessage || 'Vui lòng kiểm tra lại đường dẫn.');
      } else if (!apiKey) {
        setShowSettings(true);
        alert('Vui lòng nhập Google API Key để tiếp tục.');
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
                            {folderMetadata.count} ảnh • {allowDownload ? 'Cho phép tải' : 'Xem online'} • {limitPhotos ? `Giới hạn ${maxPhotoCount}` : 'Không giới hạn'}
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
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                title="Cài đặt API Key"
            >
                <Settings className={`w-5 h-5 ${!apiKey ? 'text-red-400 animate-pulse' : ''}`} />
            </button>
        </div>

        {/* API Key Settings Panel */}
        {showSettings && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-in fade-in slide-in-from-top-2 relative">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-600 uppercase flex items-center">
                        Google API Key
                        <button 
                            onClick={(e) => { e.preventDefault(); setShowGuide(true); }}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-[10px] normal-case flex items-center font-normal"
                        >
                            <HelpCircle className="w-3 h-3 mr-0.5" />
                            Cách lấy Key?
                        </button>
                    </label>
                    <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Dán API Key của bạn vào đây (bắt đầu bằng AIza...)"
                        className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none pr-8"
                    />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                   API Key được lưu trên trình duyệt của bạn để sử dụng cho lần sau.
                </p>
            </div>
        )}

        {/* GUIDE MODAL */}
        {showGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-green-600 text-white p-4 flex justify-between items-center">
                        <h3 className="font-bold flex items-center"><Key className="w-4 h-4 mr-2"/> Hướng dẫn lấy API Key</h3>
                        <button onClick={() => setShowGuide(false)} className="hover:bg-green-700 p-1 rounded"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto text-sm space-y-4 text-gray-700">
                        <p>Để web đọc được thư mục công khai, bạn cần <strong>Google Drive API Key</strong> miễn phí từ Google:</p>
                        
                        <ol className="list-decimal pl-5 space-y-3 marker:font-bold marker:text-green-600">
                            <li>
                                Truy cập <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium hover:text-blue-800">Google Cloud Console</a>.
                            </li>
                            <li>
                                Tạo một <strong>Project</strong> mới (hoặc chọn project có sẵn).
                            </li>
                            <li>
                                Vào menu <strong>APIs & Services &gt; Library</strong>. Tìm kiếm từ khóa <code>Google Drive API</code> và nhấn <strong>Enable</strong>.
                            </li>
                            <li>
                                Sau khi bật xong, vào tab <strong>Credentials</strong> (Bên trái).
                            </li>
                            <li>
                                Nhấn <strong>Create Credentials</strong> &gt; chọn <strong>API Key</strong>.
                            </li>
                            <li>
                                Copy đoạn mã bắt đầu bằng <code>AIza...</code> và dán vào ô nhập liệu trên web này.
                            </li>
                        </ol>

                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800 mt-4">
                            <strong>Lưu ý:</strong> API Key này là miễn phí và có giới hạn quota (đủ dùng cá nhân). Không chia sẻ Key của bạn cho người lạ.
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button 
                            onClick={() => setShowGuide(false)}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                        >
                            Đã hiểu
                        </button>
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
               <a href="#" onClick={(e) => { e.preventDefault(); setShowGuide(true); }} className="text-blue-600 hover:text-blue-800 hover:underline text-xs flex-shrink-0 flex items-center">
                 Xem hướng dẫn <ExternalLink className="w-3 h-3 ml-1" />
               </a>
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
          <div className="flex justify-center pt-6">
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
          </div>

          {/* Info Alert */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start justify-center text-blue-800 text-xs mt-4">
             <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
             <span>Lưu ý: Hệ thống đọc file trực tiếp từ Google Drive API. Đảm bảo thư mục ở chế độ "Công khai" (Anyone with the link).</span>
          </div>

        </form>
      </div>
    </div>
  );
};