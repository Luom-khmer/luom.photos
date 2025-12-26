import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Search, Ban, CheckCircle, Shield, User as UserIcon, Clock, Mail } from 'lucide-react';
import { User } from 'firebase/auth';

interface UserData {
    email: string;
    photoURL?: string;
    displayName?: string;
    lastLogin?: any;
    banned?: boolean;
    addedByAdminAt?: any;
}

interface UserManagementProps {
    currentUser: User | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "allowed_users")); // Có thể thêm orderBy nếu cần, nhưng xử lý client sort linh hoạt hơn
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedUsers: UserData[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                // Merge ID as email if email field is missing
                loadedUsers.push({
                    email: docSnapshot.id,
                    ...data
                } as UserData);
            });

            // Sắp xếp: Mới đăng nhập lên đầu
            loadedUsers.sort((a, b) => {
                const timeA = a.lastLogin?.seconds || 0;
                const timeB = b.lastLogin?.seconds || 0;
                return timeB - timeA;
            });

            setUsers(loadedUsers);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleToggleBan = async (email: string, currentBanStatus: boolean) => {
        if (email === currentUser?.email) {
            alert("Không thể chặn chính mình.");
            return;
        }
        
        const confirmMsg = currentBanStatus 
            ? `Bỏ chặn người dùng ${email}?` 
            : `CHẶN người dùng ${email}? Họ sẽ không thể đăng nhập được nữa.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await updateDoc(doc(db, "allowed_users", email), {
                banned: !currentBanStatus
            });
        } catch (error) {
            console.error("Lỗi cập nhật trạng thái:", error);
            alert("Có lỗi xảy ra khi cập nhật.");
        }
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return 'Chưa đăng nhập';
        const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
        return date.toLocaleString('vi-VN');
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500 p-3 rounded-full shadow-lg shadow-blue-500/30">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Quản Lý Người Dùng</h2>
                            <p className="text-gray-400 text-sm">Danh sách tài khoản đã tương tác với hệ thống</p>
                        </div>
                    </div>
                    
                    <div className="relative w-full md:w-auto min-w-[300px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm email, tên..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border-none rounded-lg leading-5 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all sm:text-sm"
                        />
                    </div>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
                            Đang tải dữ liệu...
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            Không tìm thấy người dùng nào khớp với từ khóa "{searchTerm}".
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lần cuối online</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredUsers.map((u) => (
                                    <tr key={u.email} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    {u.photoURL ? (
                                                        <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={u.photoURL} alt="" />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">
                                                            <UserIcon className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{u.displayName || 'Không tên'}</div>
                                                    <div className="text-xs text-gray-500 md:hidden">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                            <div className="flex items-center">
                                                <Mail className="w-4 h-4 mr-1.5 text-gray-400" />
                                                {u.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center">
                                                <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                                {formatTime(u.lastLogin)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {u.banned ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                    Bị chặn
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Hoạt động
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {u.email !== currentUser?.email && (
                                                <button
                                                    onClick={() => handleToggleBan(u.email, !!u.banned)}
                                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                                                        u.banned 
                                                            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                                                            : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                                    }`}
                                                >
                                                    {u.banned ? (
                                                        <>
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Bỏ chặn
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Ban className="w-3 h-3 mr-1" /> Chặn
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                    <span>Tổng số: <strong>{users.length}</strong> user</span>
                    <span>Hiển thị: <strong>{filteredUsers.length}</strong> user</span>
                </div>
            </div>
        </div>
    );
};