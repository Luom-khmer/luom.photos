import React from 'react';
import { MessageCircle } from 'lucide-react';

export const ChatWidget: React.FC = () => {
  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col items-end">
        {/* Helper text bubble image simulation */}
        <div className="bg-white text-green-600 px-3 py-1 rounded-full shadow-lg mb-2 text-xs font-bold border border-green-100 whitespace-nowrap transform -rotate-6 origin-bottom-right">
             We Are Here!
             <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] text-white justify-center items-center">1</span>
            </span>
        </div>
        
        {/* Main button */}
        <button className="bg-[#4CAF50] hover:bg-[#43a047] text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center w-12 h-12">
            <MessageCircle className="w-6 h-6 fill-white" />
        </button>
    </div>
  );
};