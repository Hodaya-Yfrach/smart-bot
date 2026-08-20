"use client";

// =============================================================================
// components/sideBar/sidBar.tsx — סרגל הצד
// מציג את היסטוריית השיחות, כפתור שיחה חדשה, ופרטי משתמש.
// ניתן לכווץ (collapsed = אייקונים בלבד) ולהרחיב.
// DEV NOTE: כל הלוגיקה של DB מועברת כ-callbacks מ-page.tsx — הקומפוננטה טהורה.
// =============================================================================

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatRecord {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  user: User | null;
  chatHistory: ChatRecord[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartNewChat: () => void;
  onLogout: () => void;
  onDeleteChat: (chatId: string) => void;
  onUpdateTitle: (chatId: string, title: string) => void;
  onOpenSummary: () => void;
  mainMessages: ChatMessageType[];
  userApiKey: string;
}

export default function Sidebar({
  user,
  chatHistory,
  currentChatId,
  onSelectChat,
  onStartNewChat,
  onLogout,
  onDeleteChat,
  onUpdateTitle,
  onOpenSummary,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside className={`${isOpen ? 'w-72 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:shadow-[0_0_50px_rgba(0,0,0,0.15)]' : 'w-16 max-md:w-0 max-md:border-none'} shrink-0 bg-white text-slate-800 border-l border-slate-100 transition-all duration-300 flex flex-col z-30 relative`}>
      
      {/* האדר הסרגל */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 min-h-[76px] bg-slate-50/50 shrink-0">
        {isOpen && <span className="font-extrabold text-slate-800 text-[15px] tracking-wide">השיחות שלי</span>}
        <button 
          onClick={() => setIsOpen((value) => !value)} 
          className={`w-10 h-10 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-white hover:shadow-sm flex items-center justify-center transition-all ${!isOpen ? 'mx-auto' : ''}`} 
          aria-label={isOpen ? 'סגירת סרגל' : 'פתיחת סרגל'}
        >
          {isOpen ? '‹' : '☰'}
        </button>
      </div>

      {/* אזור כפתור שיחה חדשה */}
      <div className={`p-4 shrink-0 ${!isOpen && 'hidden md:block'} border-b border-slate-50`}>
        <button 
          onClick={onStartNewChat} 
          className={`w-full bg-gradient-to-r from-teal-500 via-blue-500 to-teal-500 text-white font-bold text-sm shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 ${isOpen ? 'py-3.5 px-4 rounded-2xl' : 'aspect-square rounded-2xl p-0'}`}
          title="התחל שיחה חדשה"
          style={{ backgroundSize: '200% auto', transition: '0.5s' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundPosition = 'right center'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundPosition = 'left center'}
        >
          <span className={`${isOpen ? 'text-lg' : 'text-2xl'} leading-none`}>+</span>
          {isOpen && <span>שיחה חדשה</span>}
        </button>
      </div>

      {/* רשימת השיחות */}
      {isOpen && (
        <div className="max-h-[45vh] shrink-0 overflow-y-auto px-3 pt-3 space-y-1 pb-4 scroll-smooth">
          {chatHistory.map((chat) => (
            <div 
              key={chat.id} 
              className={`flex items-center justify-between rounded-xl p-2 transition-all duration-200 group ${
                currentChatId === chat.id 
                  ? 'bg-teal-50 border border-teal-100/50 shadow-sm' 
                  : 'bg-transparent border border-transparent hover:bg-slate-50'
              }`}
            >
              <button 
                onClick={() => onSelectChat(chat.id)} 
                className={`flex-1 text-right text-[11px] font-semibold truncate transition-colors px-1 ${
                  currentChatId === chat.id ? 'text-teal-800' : 'text-slate-600 hover:text-slate-800'
                }`}
                title={chat.title}
              >
                {chat.title}
              </button>
              
              {/* כפתורי פעולות בצד שמאל - מופיעים רק במעבר עכבר (או במסכים קטנים) */}
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                <button 
                  onClick={() => {
                    const title = window.prompt('כותרת חדשה', chat.title);
                    if (title?.trim()) onUpdateTitle(chat.id, title.trim());
                  }} 
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:border-teal-200 hover:text-teal-600 hover:bg-teal-50 transition-all shadow-sm"
                  title="ערוך שם שיחה"
                >
                  <span className="text-[10px]">✏️</span>
                </button>
                <button 
                  onClick={() => onDeleteChat(chat.id)} 
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                  title="מחק שיחה"
                >
                  <span className="text-[10px]">🗑️</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && user && currentChatId && (
        <div className="px-4 pb-4 shrink-0">
          <button data-tour-id="tour-btn-summary" onClick={onOpenSummary} className="w-full bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 font-medium transition-all duration-300 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow">
            <span>📄</span> תקציר
          </button>
        </div>
      )}

      {/* אזור המשתמש למטה */}
      {isOpen && user && (
        <div className="border-t border-slate-100 p-2.5 bg-slate-50/50 mt-auto shrink-0 relative z-10">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm shadow-teal-500/20">
              {user.email?.[0].toUpperCase() || 'U'}
            </div>
            <p className="text-[11px] font-bold text-slate-700 truncate" dir="ltr" style={{ textAlign: 'right' }}>
              {user.email}
            </p>
          </div>
          <button 
            onClick={onLogout} 
            className="w-full rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-800 hover:shadow-sm py-1.5 transition-all duration-200"
          >
            התנתקות מהחשבון
          </button>
        </div>
      )}
    </aside>
  );
}