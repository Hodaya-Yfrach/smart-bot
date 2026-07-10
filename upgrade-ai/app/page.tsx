"use client";
import { useState, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { askGemini } from '@/services/gemini';
import { supabase } from '@/services/supabase';

export default function Home() {
  // 1. נעילת אתר
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(false);
  const [sitePasswordInput, setSitePasswordInput] = useState('');

  // 2. משתמשים
  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // 3. צ'אט והיסטוריה
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]); 
  const [input, setInput] = useState('');
  
  // 4. מודלים (Modals) וזיכרון
  const [isSideModalOpen, setIsSideModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false); // חלון הזיכרון החדש
  
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const [chatRules, setChatRules] = useState<any[]>([]);
  const [newGlobalRule, setNewGlobalRule] = useState('');
  const [newChatRule, setNewChatRule] = useState('');

  // 5. מצבי AI והמתנה
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentModelName, setCurrentModelName] = useState('Gemini (ראשי)');

  // בדיקה אם האורח ניצל את השאלה היחידה שלו
  const guestLimitReached = isGuest && mainMessages.some(msg => msg.role === 'user');

  // --- Effects ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadChatHistory();
      loadRules();
    } else {
      setChatHistory([]);
      setGlobalRules([]);
    }
  }, [user]);

  useEffect(() => {
    if (currentChatId) {
      loadRules();
    } else {
      setChatRules([]);
    }
  }, [currentChatId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && countdown > 0) {
      interval = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isWaiting, countdown]);

  // --- פונקציות זיכרון וכללים ---
  const loadRules = async () => {
    if (!user) return;
    
    // שליפת כללים גלובליים
    const { data: gRules } = await supabase.from('global_rules').select('*').eq('user_id', user.id);
    if (gRules) setGlobalRules(gRules);

    // שליפת כללים לשיחה הנוכחית
    if (currentChatId) {
      const { data: cRules } = await supabase.from('chat_rules').select('*').eq('chat_id', currentChatId);
      if (cRules) setChatRules(cRules);
    }
  };

  const addGlobalRule = async () => {
    if (!newGlobalRule.trim() || !user) return;
    const { data, error } = await supabase.from('global_rules').insert([{ user_id: user.id, rule_text: newGlobalRule }]).select();
    if (!error && data) {
      setGlobalRules([...globalRules, data[0]]);
      setNewGlobalRule('');
    }
  };

  const deleteGlobalRule = async (id: string) => {
    await supabase.from('global_rules').delete().eq('id', id);
    setGlobalRules(globalRules.filter(r => r.id !== id));
  };

  const addChatRule = async () => {
    if (!newChatRule.trim() || !currentChatId) return alert("יש להתחיל שיחה כדי להוסיף לה כלל");
    const { data, error } = await supabase.from('chat_rules').insert([{ chat_id: currentChatId, rule_text: newChatRule }]).select();
    if (!error && data) {
      setChatRules([...chatRules, data[0]]);
      setNewChatRule('');
    }
  };

  const deleteChatRule = async (id: string) => {
    await supabase.from('chat_rules').delete().eq('id', id);
    setChatRules(chatRules.filter(r => r.id !== id));
  };

  // --- פונקציות היסטוריה ומסד נתונים ---
  const loadChatHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('chats').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setChatHistory(data);
  };

  const loadSingleChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) {
      const formattedMessages: ChatMessageType[] = data.map((msg: any) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      setMainMessages(formattedMessages);
      setCurrentModelName('Gemini (ראשי)');
    }
  };

  const ensureChatExists = async (firstMessageText: string) => {
    if (currentChatId) return currentChatId;
    if (!user) return null;

    const { data: chats } = await supabase.from('chats').select('id').eq('user_id', user.id).order('created_at', { ascending: true });
    if (chats && chats.length >= 10) {
      await supabase.from('chats').delete().eq('id', chats[0].id);
    }

    const title = firstMessageText.substring(0, 25) + "...";
    const { data: newChat, error } = await supabase.from('chats').insert([{ user_id: user.id, title }]).select().single();
    if (error) return null;

    setCurrentChatId(newChat.id);
    await loadChatHistory(); 
    return newChat.id;
  };

  // --- פעולות התחברות ---
  const unlockSite = () => {
    if (sitePasswordInput === process.env.NEXT_PUBLIC_APP_PASSWORD) setIsSiteUnlocked(true);
    else alert("סיסמת אתר שגויה");
  };

  const handleLogin = async () => {
    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    if (error) alert("שגיאה בהתחברות: " + error.message);
    else setUser(data.user);
    setIsLoadingAuth(false);
  };

  const handleSignUp = async () => {
    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signUp({ email, password: authPassword });
    if (error) alert("שגיאה בהרשמה: " + error.message);
    else {
      alert("הרשמה בוצעה בהצלחה! מתחבר כעת...");
      setUser(data.user);
    }
    setIsLoadingAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
    setMainMessages([]);
    setCurrentChatId(null);
    setCurrentModelName('Gemini (ראשי)');
  };

  const startNewChat = () => {
    setMainMessages([]);
    setCurrentChatId(null);
    setChatRules([]); // מנקה כללים של השיחה הקודמת
    setCurrentModelName('Gemini (ראשי)');
  };

  // --- שליחת הודעה בצ'אט ---
  const handleMainSend = async () => {
    // הגבלת אורח
    if (guestLimitReached) {
      alert("אורחים יכולים לשאול רק שאלה אחת. כדי להמשיך, אנא התחברו או צרו פרופיל חדש 💙");
      return;
    }

    if (!input.trim() || isWaiting) return;

    const userText = input;
    const userMessage: ChatMessageType = { role: 'user', parts: [{ text: userText }] };
    
    setMainMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsWaiting(true);
    setCountdown(15);

    try {
      let activeChatId = currentChatId;
      if (user) {
        activeChatId = await ensureChatExists(userText);
        if (activeChatId) {
          await supabase.from('messages').insert([{ chat_id: activeChatId, role: 'user', content: userText }]);
        }
      }

      // איחוד הכללים להוראת מערכת אחת
      let combinedSystemInstructions = "";
      if (globalRules.length > 0) {
        combinedSystemInstructions += "הוראות קבועות למערכת (חובה תמיד לציית):\n" + globalRules.map(r => "- " + r.rule_text).join("\n") + "\n\n";
      }
      if (chatRules.length > 0) {
        combinedSystemInstructions += "הוראות לשיחה הנוכחית בלבד:\n" + chatRules.map(r => "- " + r.rule_text).join("\n");
      }

      // שולחים ל-AI גם את הכללים המאוחדים
      const response = await askGemini(userText, mainMessages, combinedSystemInstructions);
      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: response.text }] };
      setMainMessages(prev => [...prev, modelMessage]);

      if (user && activeChatId) {
        await supabase.from('messages').insert([{ chat_id: activeChatId, role: 'model', content: response.text }]);
      }

      if (response.fallbackModelName) {
        setCurrentModelName(`${response.fallbackModelName} (גיבוי)`);
        setToastMessage(`המגבלה הסתיימה, הועברת למודל ${response.fallbackModelName}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
      
    } catch (error) {
      console.error("שגיאה בצ'אט הראשי:", error);
      alert("הייתה בעיה בתקשורת עם ה-AI.");
    } finally {
      setIsWaiting(false);
    }
  };

  // --- רינדור מסכים ---
  if (!isSiteUnlocked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#efeae2] dir-rtl">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
          <div className="w-16 h-16 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">🔒</div>
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">כניסה למערכת המשפחתית</h1>
          <input 
            type="password" 
            className="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#00a884] text-center"
            placeholder="הזיני סיסמת אתר..."
            value={sitePasswordInput}
            onChange={(e) => setSitePasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlockSite()}
          />
          <button onClick={unlockSite} className="w-full bg-[#00a884] text-white py-3 rounded-xl font-bold hover:bg-[#008f6f] transition-all">כניסה</button>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#efeae2] dir-rtl">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm text-white">👤</div>
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">מי מתחבר/ת?</h1>
          <input 
            type="email" 
            placeholder="אימייל (אישי)" 
            className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-slate-800"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="סיסמה (לפחות 6 תווים)" 
            className="w-full p-3 border border-gray-300 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-slate-800"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} disabled={isLoadingAuth} className="w-full bg-[#00a884] text-white py-3 rounded-xl font-bold hover:bg-[#008f6f] mb-3 transition-all disabled:opacity-50">התחברות פרופיל קיים</button>
          <button onClick={handleSignUp} disabled={isLoadingAuth} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 mb-6 transition-all disabled:opacity-50">יצירת פרופיל חדש</button>
          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">או</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          <button onClick={() => setIsGuest(true)} className="w-full bg-transparent border-2 border-gray-300 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">המשך כאורח (ללא היסטוריה)</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#efeae2] dir-rtl relative">
      
      {/* תפריט צד (Sidebar) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex">
        <div className="p-4 border-b border-slate-800">
          <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#008f6f] text-white py-3 px-4 rounded-xl font-medium transition-colors">
            <span>+</span> שיחה חדשה
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {user ? (
            <>
              <h3 className="text-xs font-semibold text-slate-500 mb-3 px-2 uppercase tracking-wider">היסטוריית שיחות ({chatHistory.length}/10)</h3>
              <div className="space-y-1">
                {chatHistory.map((chat) => (
                  <button 
                    key={chat.id}
                    onClick={() => loadSingleChat(chat.id)}
                    className={`w-full text-right p-3 rounded-lg hover:bg-slate-800 transition-colors truncate text-sm ${currentChatId === chat.id ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center mt-10 text-slate-500 text-sm px-4">
              את/ה מחובר/ת כאורח.<br/>השיחות לא נשמרות.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors">התנתק / החלף משתמש</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        <header className="bg-[#f0f2f5] p-4 shadow-sm z-10 flex justify-between items-center border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Workspace</h1>
            {user && <span className="text-xs text-gray-500">{user.email}</span>}
          </div>
          <div className="flex gap-2">
            {/* כפתור הזיכרון החדש */}
            {user && (
              <button onClick={() => setIsMemoryModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
                <span className="text-lg">🧠</span> כללים וזיכרון
              </button>
            )}
            <button onClick={() => setIsSideModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
              <span className="text-lg">💡</span> התייעצות צדדית
            </button>
          </div>
        </header>

        {toastMessage && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium border border-slate-700">{toastMessage}</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            {mainMessages.length === 0 ? (
              <div className="text-center mt-20 text-gray-400">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">👋</div>
                <p className="text-xl font-medium text-gray-600 mb-1">איך אפשר לעזור היום?</p>
              </div>
            ) : (
              mainMessages.map((msg, index) => <ChatMessage key={index} message={msg} />)
            )}
            
            {isWaiting && (
              <div className="flex w-full mb-4 justify-start animate-fade-in">
                <div className="bg-white border border-gray-200 text-gray-600 rounded-2xl rounded-tr-none p-3 px-5 text-sm shadow-sm flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#00a884] rounded-full"></div>
                  <span>ממתין לתשובה... {countdown > 0 ? `(${countdown} שניות)` : '(מעבד...)'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#f0f2f5] p-3 md:p-4 border-t border-gray-200 flex flex-col items-center">
          <div className="w-full max-w-3xl flex gap-3 mb-2">
            <input 
              className="flex-1 p-3 bg-white border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-sm text-base disabled:opacity-50 disabled:bg-gray-100"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMainSend()}
              placeholder={guestLimitReached ? "הגעת למגבלת השאלות לאורח 🔒" : "הקלידי הודעה..."}
              disabled={isWaiting || guestLimitReached}
            />
            <button 
              onClick={handleMainSend} 
              disabled={isWaiting || guestLimitReached} 
              className="bg-[#00a884] text-white px-8 rounded-xl hover:bg-[#008f6f] font-bold transition-colors shadow-sm disabled:bg-gray-400"
            >
              שלח
            </button>
          </div>
          <div className="w-full max-w-3xl text-xs text-gray-400 text-right px-2 flex justify-between">
            <span>מודל פעיל כעת: <span className="font-medium text-gray-500">{currentModelName}</span></span>
            {isGuest && <span className="text-amber-600 font-medium">{guestLimitReached ? "נגמרו השאלות לאורח" : "שאלה 1 מתוך 1"}</span>}
          </div>
        </div>

        <SideModal isOpen={isSideModalOpen} onClose={() => setIsSideModalOpen(false)} mainContext={mainMessages} />

        {/* --- חלון ניהול הכללים והזיכרון --- */}
        {isMemoryModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
              <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold flex items-center gap-2"><span className="text-2xl">🧠</span> ניהול זיכרון וכללים</h2>
                <button onClick={() => setIsMemoryModalOpen(false)} className="text-gray-500 hover:text-gray-800 bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
              </header>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* אזור הכללים הקבועים */}
                <section>
                  <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">כללים תמידיים (חלים על כל השיחות)</h3>
                  <div className="space-y-2 mb-4">
                    {globalRules.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">אין כללים קבועים עדיין.</p>
                    ) : (
                      globalRules.map(rule => (
                        <div key={rule.id} className="flex justify-between items-start bg-blue-50 p-3 rounded-lg text-sm text-blue-900 border border-blue-100">
                          <span className="whitespace-pre-wrap flex-1">{rule.rule_text}</span>
                          <button onClick={() => deleteGlobalRule(rule.id)} className="text-red-500 hover:text-red-700 ml-2 bg-white p-1 rounded shadow-sm text-xs">מחק</button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea 
                      value={newGlobalRule} onChange={(e) => setNewGlobalRule(e.target.value)}
                      placeholder="הגדירי כלל שתקף תמיד (למשל הפרומפט של נטפרי...)" 
                      className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#00a884] text-sm resize-none h-16"
                    />
                    <button onClick={addGlobalRule} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-sm font-medium">הוסף כלל</button>
                  </div>
                </section>

                {/* אזור הכללים לשיחה הנוכחית */}
                <section>
                  <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">כללים מקומיים (לשיחה הנוכחית בלבד)</h3>
                  {!currentChatId ? (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">יש להתחיל שיחה חדשה (לשלוח הודעה ראשונה) כדי להגדיר לה כללים.</p>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4">
                        {chatRules.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">אין כללים ספציפיים לשיחה זו.</p>
                        ) : (
                          chatRules.map(rule => (
                            <div key={rule.id} className="flex justify-between items-start bg-green-50 p-3 rounded-lg text-sm text-green-900 border border-green-100">
                              <span className="whitespace-pre-wrap flex-1">{rule.rule_text}</span>
                              <button onClick={() => deleteChatRule(rule.id)} className="text-red-500 hover:text-red-700 ml-2 bg-white p-1 rounded shadow-sm text-xs">מחק</button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <textarea 
                          value={newChatRule} onChange={(e) => setNewChatRule(e.target.value)}
                          placeholder="הגדירי כלל ספציפי לשיחה זו..." 
                          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#00a884] text-sm resize-none h-16"
                        />
                        <button onClick={addChatRule} className="bg-[#00a884] hover:bg-[#008f6f] text-white px-4 rounded-lg text-sm font-medium">הוסף לשיחה</button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}