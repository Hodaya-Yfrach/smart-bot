"use client";
import { useState } from 'react';

// הגדרת המבנה של אובייקט שיחה
interface ChatRecord {
  id: string;
  title: string;
  created_at: string;
}

// כאן אנחנו מגדירים ל-TypeScript אילו פונקציות ומשתנים הקומפוננטה הזו מקבלת מהדף הראשי
interface SidebarProps {
  user: any;
  chatHistory: ChatRecord[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartNewChat: () => void;
  onLogout: () => void;
  onDeleteChat: (chatId: string) => void;
  onUpdateTitle: (chatId: string, newTitle: string) => void;
}

export default function Sidebar({
  user,
  chatHistory,
  currentChatId,
  onSelectChat,
  onStartNewChat,
  onLogout,
  onDeleteChat,
  onUpdateTitle
}: SidebarProps) {
  // ניהול מצב (State) לעריכת שם השיחה ולטעינה
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [chatActionLoadingId, setChatActionLoadingId] = useState<string | null>(null);

  const startEditingChat = (chat: ChatRecord) => {
    setEditingChatId(chat.id);
    setEditChatTitle(chat.title);
  };

  const handleSaveChatTitle = async (chatId: string) => {
    if (!editChatTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    setChatActionLoadingId(chatId);
    await onUpdateTitle(chatId, editChatTitle);
    setEditingChatId(null);
    setChatActionLoadingId(null);
  };

  const handleDelete = async (chatId: string) => {
    setChatActionLoadingId(chatId);
    await onDeleteChat(chatId);
    setChatActionLoadingId(null);
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex shrink-0">
      <div className="p-4 border-b border-slate-800">
        {/* כפתור שיחה חדשה - שונה לוורוד */}
        <button 
          onClick={onStartNewChat} 
          className="w-full flex items-center justify-center gap-2 bg-[#ec4899] hover:bg-[#db2777] text-white py-3 px-4 rounded-xl font-medium transition-colors"
        >
          <span>+</span> שיחה חדשה
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {user ? (
          <>
            <h3 className="text-xs font-semibold text-slate-500 mb-3 px-2 uppercase tracking-wider">היסטוריית שיחות ({chatHistory.length}/10)</h3>
            <ul className="space-y-1">
              {chatHistory.map((chat) => (
                <li
                  key={chat.id}
                  className={`group rounded-lg transition-colors ${currentChatId === chat.id ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
                >
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="text"
                        value={editChatTitle}
                        onChange={(e) => setEditChatTitle(e.target.value)}
                        // מסגרת פוקוס שונתה לוורוד
                        className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#ec4899]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveChatTitle(chat.id);
                          if (e.key === 'Escape') setEditingChatId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveChatTitle(chat.id)}
                        // כיתוב כפתור שמירה שונה לוורוד
                        className="text-[#ec4899] hover:text-[#db2777] text-xs font-medium shrink-0"
                      >
                        שמור
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onSelectChat(chat.id)}
                        className={`flex-1 text-right p-3 truncate text-sm ${currentChatId === chat.id ? 'text-white' : 'text-slate-400'}`}
                      >
                        {chat.title}
                      </button>
                      <div className="flex gap-2 pl-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditingChat(chat)}
                          disabled={chatActionLoadingId === chat.id}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                          title="ערוך כותרת"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(chat.id)}
                          disabled={chatActionLoadingId === chat.id}
                          className="text-red-400 hover:text-red-300 text-xs"
                          title="מחק שיחה"
                        >
                          {chatActionLoadingId === chat.id ? '...' : '🗑'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-center mt-10 text-slate-500 text-sm px-4">
            את/ה מחובר/ת כאורח.<br />השיחות לא נשמרות.
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button onClick={onLogout} className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors">התנתק / החלף משתמש</button>
      </div>
    </aside>
  );
}