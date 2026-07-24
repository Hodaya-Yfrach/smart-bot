
'use client'

import { useState } from 'react'

// הגדרת המבנה של אובייקט שיחה
type Chat = {
  id: string
  title: string
}

type ActionResult = { success: boolean; message?: string }

interface ChatHistoryListProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => Promise<ActionResult>
  onUpdateTitle: (chatId: string, newTitle: string) => Promise<ActionResult>
}

export default function ChatHistoryList({
  chats,
  currentChatId,
  onSelectChat,
  onDeleteChat,
  onUpdateTitle,
}: ChatHistoryListProps) {
  // ניהול מצב (State) לעריכת שם השיחה
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // פונקציית מחיקה
  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation() // כדי שהלחיצה על מחק לא תפעיל גם בחירת שיחה
    const isConfirmed = window.confirm('האם את בטוחה שברצונך למחוק שיחה זו? פעולה זו בלתי הפיכה.')
    if (!isConfirmed) return

    setLoadingId(chatId)
    const result = await onDeleteChat(chatId)

    if (!result.success) {
      alert(result.message || 'אירעה שגיאה במחיקת השיחה')
    }
    setLoadingId(null)
  }

  // פונקציות לעריכת כותרת
  const startEditing = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditTitle(chat.title)
  }

  const handleSaveTitle = async (chatId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }

    setLoadingId(chatId)
    const result = await onUpdateTitle(chatId, editTitle)

    if (result.success) {
      setEditingId(null)
    } else {
      alert(result.message || 'אירעה שגיאה בעדכון השם')
    }
    setLoadingId(null)
  }

  if (chats.length === 0) {
    return <p className="text-sm text-slate-500 px-2">אין שיחות קודמות.</p>
  }

  return (
    <div className="space-y-1">
      {chats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => editingId !== chat.id && onSelectChat(chat.id)}
          className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg transition-colors cursor-pointer text-sm truncate ${
            currentChatId === chat.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          {/* אזור טקסט/עריכה */}
          {editingId === chat.id ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 min-w-0 border border-slate-600 bg-slate-900 text-white rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#00a884]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle(chat.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
              <button
                onClick={() => handleSaveTitle(chat.id)}
                className="text-[#00a884] hover:text-[#00c89c] text-xs font-medium shrink-0"
              >
                שמור
              </button>
            </div>
          ) : (
            <>
              <span className="truncate flex-1">{chat.title}</span>

              {/* כפתורי פעולות (עריכה ומחיקה) */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={(e) => startEditing(e, chat)}
                  disabled={loadingId === chat.id}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                  title="ערוך כותרת"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleDelete(e, chat.id)}
                  disabled={loadingId === chat.id}
                  className="text-red-400 hover:text-red-300 text-xs"
                  title="מחק שיחה"
                >
                  {loadingId === chat.id ? '...' : '🗑'}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}