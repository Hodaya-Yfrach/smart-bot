"use client";
import { verifySitePassword } from './actions';
import { useState, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import { ChatMessage as ChatMessageType, GeminiResponse } from '@/types/chat';
import { askGemini, ChatApiError } from '@/services/gemini';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';

// --- הגדרות טיפוסים מקומיות למניעת שגיאות TS ---
interface RuleRecord {
  id: string;
  rule_text: string;
}

interface ChatRecord {
  id: string;
  title: string;
  created_at: string;
}

interface DbMessage {
  role: 'user' | 'model';
  content: string;
}

const AVAILABLE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview"
];
// פונקציית עזר לתרגום שגיאות Supabase לעברית מובנת
const getHebrewAuthError = (errorMsg: string) => {
  const msg = errorMsg.toLowerCase();
  
  if (msg.includes('user already registered')) {
    return "כתובת האימייל הזו כבר רשומה במערכת. אנא לחצו על 'התחברות פרופיל קיים'.";
  }
  if (msg.includes('invalid login credentials')) {
    return "כתובת האימייל או הסיסמה שהזנתם שגויים. אנא נסו שוב.";
  }
  if (msg.includes('email not confirmed')) {
    return "טרם אימתם את כתובת האימייל. אנא בדקו את תיבת הדואר הנכנס שלכם (או הספאם).";
  }
  if (msg.includes('password should be at least 6 characters')) {
    return "הסיסמה חלשה מדי. היא חייבת להכיל לפחות 6 תווים.";
  }
  if (msg.includes('valid email')) {
    return "אנא הזינו כתובת אימייל תקינה.";
  }
  
  // שגיאת גיבוי כללית כדי שהלקוח לעולם לא יראה שגיאת שרת באנגלית
  return "אירעה שגיאה בתקשורת. אנא ודאו שכל הפרטים נכונים ונסו שוב.";
};
export default function Home() {
  // 1. נעילת אתר
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(false);
  const [sitePasswordInput, setSitePasswordInput] = useState('');

  // 2. משתמשים
 // 2. משתמשים
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // מעבר בין התחברות להרשמה
  const [fullName, setFullName] = useState(''); // שם
  const [phone, setPhone] = useState('');       // טלפון
  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  // 3. צ'אט והיסטוריה
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatRecord[]>([]);
  const [input, setInput] = useState('');

  // 3.1 עריכה/מחיקה של שיחות בהיסטוריה
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [chatActionLoadingId, setChatActionLoadingId] = useState<string | null>(null);

  // 4. מודלים (Modals) וזיכרון
  const [isSideModalOpen, setIsSideModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [globalRules, setGlobalRules] = useState<RuleRecord[]>([]);
  const [chatRules, setChatRules] = useState<RuleRecord[]>([]);
  const [newGlobalRule, setNewGlobalRule] = useState('');
  const [newChatRule, setNewChatRule] = useState('');

  // 5. מצבי AI וחיבור (BYOK + Fallback)
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);
  const [userApiKey, setUserApiKey] = useState('');
  const [currentModelName, setCurrentModelName] = useState(AVAILABLE_MODELS[0]);
   const [isApiKeyLocked, setIsApiKeyLocked] = useState(false); // ניהול מצב נעילת המפתח

  // טעינת המפתח מהדפדפן המקומי כשהאתר עולה
  useEffect(() => {
    const savedKey = localStorage.getItem('local_gemini_api_key');
    if (savedKey) {
      setUserApiKey(savedKey);
      setIsApiKeyLocked(true); // אם יש מפתח שמור, ננעל אותו אוטומטית
    }
  }, []);
  // בדיקה אם האורח ניצל את השאלה היחידה שלו
  const guestLimitReached = isGuest && mainMessages.some(msg => msg.role === 'user');

  // פונקציית עזר לבניית הוראות המערכת המאוחדות
  const getCombinedSystemInstructions = () => {
    let combined = "";
    if (globalRules.length > 0) {
      combined += "הוראות קבועות למערכת (חובה תמיד לציית):\n" + globalRules.map(r => "- " + r.rule_text).join("\n") + "\n\n";
    }
    if (chatRules.length > 0) {
      combined += "הוראות לשיחה הנוכחית בלבד:\n" + chatRules.map(r => "- " + r.rule_text).join("\n");
    }
    return combined;
  };

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
    const { data: gRules } = await supabase.from('global_rules').select('id, rule_text').eq('user_id', user.id);
    if (gRules) setGlobalRules(gRules as RuleRecord[]);

    if (currentChatId) {
      const { data: cRules } = await supabase.from('chat_rules').select('id, rule_text').eq('chat_id', currentChatId);
      if (cRules) setChatRules(cRules as RuleRecord[]);
    }
  };

  const addGlobalRule = async () => {
    if (!newGlobalRule.trim() || !user) return;
    const { data, error } = await supabase.from('global_rules').insert([{ user_id: user.id, rule_text: newGlobalRule }]).select('id, rule_text');
    if (!error && data) {
      setGlobalRules([...globalRules, data[0] as RuleRecord]);
      setNewGlobalRule('');
    }
  };

  const deleteGlobalRule = async (id: string) => {
    await supabase.from('global_rules').delete().eq('id', id);
    setGlobalRules(globalRules.filter(r => r.id !== id));
  };

  const addChatRule = async () => {
    if (!newChatRule.trim() || !currentChatId) return alert("יש להתחיל שיחה כדי להוסיף לה כלל");
    const { data, error } = await supabase.from('chat_rules').insert([{ chat_id: currentChatId, rule_text: newChatRule }]).select('id, rule_text');
    if (!error && data) {
      setChatRules([...chatRules, data[0] as RuleRecord]);
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
    const { data } = await supabase.from('chats').select('id, title, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setChatHistory(data as ChatRecord[]);
  };

  const loadSingleChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    const { data } = await supabase.from('messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) {
      const formattedMessages: ChatMessageType[] = (data as DbMessage[]).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      setMainMessages(formattedMessages);
      setCurrentModelName(selectedModel);
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
    const { data: newChat, error } = await supabase.from('chats').insert([{ user_id: user.id, title }]).select('id').single();
    if (error || !newChat) return null;

    setCurrentChatId(newChat.id);
    await loadChatHistory();
    return newChat.id;
  };

  // --- ניהול שיחות בהיסטוריה: מחיקה ועריכת שם ---
  const handleDeleteChat = async (chatId: string) => {
    const isConfirmed = window.confirm('האם את בטוחה שברצונך למחוק שיחה זו? פעולה זו בלתי הפיכה.');
    if (!isConfirmed) return;

    setChatActionLoadingId(chatId);
    const { error } = await supabase.from('chats').delete().eq('id', chatId);

    if (!error) {
      if (currentChatId === chatId) {
        startNewChat();
      }
      await loadChatHistory();
    } else {
      alert('אירעה שגיאה במחיקת השיחה');
    }
    setChatActionLoadingId(null);
  };

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
    const { error } = await supabase.from('chats').update({ title: editChatTitle }).eq('id', chatId);

    if (!error) {
      setEditingChatId(null);
      await loadChatHistory();
    } else {
      alert('אירעה שגיאה בעדכון השם');
    }
    setChatActionLoadingId(null);
  };

  // --- פעולות התחברות ---
  const unlockSite = async () => {
    // שולחים את הסיסמה לבדיקה בשרת המאובטח
    const isCorrect = await verifySitePassword(sitePasswordInput);
    
    if (isCorrect) {
      setIsSiteUnlocked(true);
    } else {
      alert("סיסמת אתר שגויה");
    }
  };

 const handleLogin = async () => {
    if (!email || !authPassword) {
      alert("אנא מלאו אימייל וסיסמה.");
      return;
    }
    
    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    
    if (error) {
      // כאן אנחנו משתמשים בפונקציית התרגום במקום להציג את error.message
      alert(getHebrewAuthError(error.message));
    } else {
      setUser(data.user);
    }
    setIsLoadingAuth(false);
  };

  const handleSignUp = async () => {
    if (!fullName || !phone || !email || !authPassword) {
      alert("אנא מלאו את כל השדות להרשמה (שם, טלפון, אימייל וסיסמה).");
      return;
    }

    setIsLoadingAuth(true);
    // אנו מעבירים לסופאבייס גם את המידע הנוסף (שם וטלפון) כדי שהטריגר שלנו ישמור אותם ב-DB
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password: authPassword,
      options: {
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });
    
    if (error) {
      alert(getHebrewAuthError(error.message));
    } else {
      if (data.user && !data.session) {
        alert("הרשמה בוצעה! נשלח אליכם אימייל לאימות (או שיש לאשר התחברות).");
      } else {
        alert("הרשמה בוצעה בהצלחה! מתחבר כעת...");
        setUser(data.user);
      }
    }
    setIsLoadingAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
    setMainMessages([]);
    setCurrentChatId(null);
    setCurrentModelName(AVAILABLE_MODELS[0]);
  };

  const startNewChat = () => {
    setMainMessages([]);
    setCurrentChatId(null);
    setChatRules([]);
    setCurrentModelName(selectedModel);
  };

  // --- שליחת הודעה בצ'אט הראשי ---
  const handleMainSend = async () => {
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

      const combinedSystemInstructions = getCombinedSystemInstructions();
      const fallbackModels = AVAILABLE_MODELS.filter(m => m !== selectedModel && !disabledModels.includes(m));

      const response: GeminiResponse = await askGemini(
        userText,
        mainMessages,
        combinedSystemInstructions,
        selectedModel,
        fallbackModels,
        userApiKey
      );

      const modelMessage: ChatMessageType = { role: 'model', parts: [{ text: response.text }] };
      setMainMessages(prev => [...prev, modelMessage]);

      if (user && activeChatId) {
        await supabase.from('messages').insert([{ chat_id: activeChatId, role: 'model', content: response.text }]);
      }

      if (response.modelUsed !== selectedModel) {
        setCurrentModelName(`${response.modelUsed} (גיבוי)`);
        setToastMessage(`עקב עומס, הועברת אוטומטית למודל ${response.modelUsed}`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setCurrentModelName(selectedModel);
      }

      if (response.failedModels && response.failedModels.length > 0) {
        setDisabledModels(prev => [...new Set([...prev, ...response.failedModels])]);
        setTimeout(() => {
          setDisabledModels(prev => prev.filter(m => !response.failedModels.includes(m)));
        }, 60000);
      }

    } catch (error: unknown) {
      console.error("שגיאה בצ'אט הראשי:", error);

      if (error instanceof ChatApiError) {
        alert(error.message);
        if (error.failedModels.length > 0) {
          setDisabledModels(prev => [...new Set([...prev, ...error.failedModels])]);
          setTimeout(() => {
            setDisabledModels(prev => prev.filter(m => !error.failedModels.includes(m)));
          }, 60000);
        }
      } else {
        const errMessage = error instanceof Error ? error.message : "הייתה בעיה בתקשורת עם ה-AI.";
        alert(errMessage);
      }
    } finally {
      setIsWaiting(false);
    }
  };

  // --- רינדור מסכים ---

  if (!isSiteUnlocked) {
    return (
      <div dir="rtl" className="flex h-[100dvh] items-center justify-center bg-[#efeae2]">
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

 // --- רינדור מסך התחברות / הרשמה (אם המשתמש לא מחובר ולא אורח) ---
  if (!user && !isGuest) {
    return (
      <div dir="rtl" className="flex h-[100dvh] items-center justify-center bg-[#efeae2]">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm text-white">👤</div>
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">
            {isLoginMode ? 'ברוכים השבים' : 'יצירת משתמש חדש'}
          </h1>
          
          {!isLoginMode && (
            <>
              <input
                type="text"
                placeholder="שם מלא (חובה)"
                className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-slate-800 text-right"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                type="tel"
                placeholder="מספר טלפון (חובה)"
                className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-slate-800 text-right"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}

          <input
            type="email"
            placeholder="אימייל"
            className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-slate-800 text-right"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="סיסמה (לפחות 6 תווים)"
            className="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-slate-800 text-right"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                isLoginMode ? handleLogin() : handleSignUp();
              }
            }}
          />

          {isLoginMode && (
            <div className="text-left mb-6">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">שכחת סיסמה?</a>
            </div>
          )}

          {isLoginMode ? (
            <button onClick={handleLogin} disabled={isLoadingAuth} className="w-full bg-[#00a884] text-white py-3 rounded-xl font-bold hover:bg-[#008f6f] mb-3 transition-all disabled:opacity-50">
              התחברות לחשבון
            </button>
          ) : (
            <button onClick={handleSignUp} disabled={isLoadingAuth} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 mb-3 transition-all disabled:opacity-50">
              הירשם עכשיו
            </button>
          )}
          
          <div className="text-center mt-2 mb-4">
            <button 
              onClick={() => setIsLoginMode(!isLoginMode)} 
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              {isLoginMode ? 'אין לך חשבון? לחץ כאן להרשמה' : 'יש לך כבר חשבון? התחבר כאן'}
            </button>
          </div>

          <div className="relative flex py-2 items-center mb-4 mt-2">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">או</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          <button onClick={() => setIsGuest(true)} className="w-full bg-transparent border-2 border-gray-300 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">המשך כאורח (ללא היסטוריה)</button>
        </div>
      </div>
    );
  }
  const handleSaveApiKey = () => {
    if (userApiKey.trim()) {
      localStorage.setItem('local_gemini_api_key', userApiKey.trim());
      setIsApiKeyLocked(true);
      alert('המפתח נשמר בדפדפן בהצלחה וננעל.');
    } else {
      // אם המשתמש שמר שדה ריק, נמחק את מה ששמור
      localStorage.removeItem('local_gemini_api_key');
      setIsApiKeyLocked(true);
    }
  };

  const handleEditApiKey = () => {
    setIsApiKeyLocked(false);
  };
  const handleSaveUserSettings = async () => {
    if (!user) {
      alert("יש להתחבר כדי לשמור הגדרות לחשבון.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        api_key: userApiKey,
        preferred_model: selectedModel
      })
      .eq('id', user.id);

    if (error) {
      alert("אירעה שגיאה בשמירת ההגדרות.");
      console.error(error);
    } else {
      alert("ההגדרות נשמרו בחשבונך בהצלחה!");
      setIsSettingsModalOpen(false);
    }
  };

  // --- המסך הראשי ---
  return (
    <div dir="rtl" className="flex h-[100dvh] overflow-hidden bg-[#efeae2] relative">

      {/* תפריט צד (Sidebar) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-800">
          <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#008f6f] text-white py-3 px-4 rounded-xl font-medium transition-colors">
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
                          className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#00a884]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveChatTitle(chat.id);
                            if (e.key === 'Escape') setEditingChatId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveChatTitle(chat.id)}
                          className="text-[#00a884] hover:text-[#02c497] text-xs font-medium shrink-0"
                        >
                          שמור
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => loadSingleChat(chat.id)}
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
                            onClick={() => handleDeleteChat(chat.id)}
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
          <button onClick={handleLogout} className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors">התנתק / החלף משתמש</button>
        </div>
      </aside>

      {/* אזור התוכן המרכזי */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className="bg-[#f0f2f5] p-4 shadow-sm z-10 flex justify-between items-center border-b border-gray-200 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Workspace</h1>
            {user && <span className="text-xs text-gray-500">{user.email}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSettingsModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
              <span className="text-lg">⚙️</span> הגדרות AI
            </button>
            {user && (
              <button onClick={() => setIsMemoryModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
                <span className="text-lg">🧠</span> כללים וזיכרון
              </button>
            )}
            <button onClick={() => setIsSideModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
              <span className="text-lg">💡</span> התייעצות
            </button>
          </div>
        </header>

        {toastMessage && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium border border-slate-700">{toastMessage}</div>
          </div>
        )}

        {/* אזור ההודעות הנגלל */}
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

        {/* סרגל הקלדה (דבוק לתחתית בזכות ה-shrink-0) */}
        <div className="bg-[#f0f2f5] p-3 md:p-4 border-t border-gray-200 shrink-0 flex flex-col items-center">
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

        {/* מודלים קופצים (Modals) */}
        <SideModal
          isOpen={isSideModalOpen}
          onClose={() => setIsSideModalOpen(false)}
          mainContext={mainMessages}
          selectedModel={selectedModel}
          userApiKey={userApiKey}
          systemInstruction={getCombinedSystemInstructions()}
        />

     {isSettingsModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">⚙️ הגדרות AI</h2>
                <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-500 hover:bg-gray-100 rounded-full w-8 h-8">✕</button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">בחירת מודל:</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-[#00a884] outline-none"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <option key={model} value={model} disabled={disabledModels.includes(model)}>
                        {model} {disabledModels.includes(model) ? '(עמוס כרגע - יתפנה בקרוב)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">מפתח API אישי (BYOK):</label>
                  <input
                    type="password"
                    placeholder="השאר/י ריק כדי להשתמש במפתח של האתר"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#00a884] outline-none text-left"
                    dir="ltr"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    המפתח נשמר בצורה מאובטחת בחשבון שלך וישמש אותך בכל מחשב שממנו תתחברי.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSaveUserSettings} 
                    className="w-full bg-[#00a884] text-white py-3 rounded-xl font-bold hover:bg-[#008f6f] transition-all"
                  >
                    שמור הגדרות לחשבון
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isMemoryModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
              <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold flex items-center gap-2"><span className="text-2xl">🧠</span> ניהול זיכרון וכללים</h2>
                <button onClick={() => setIsMemoryModalOpen(false)} className="text-gray-500 hover:text-gray-800 bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
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
                      placeholder="הגדירי כלל שתקף תמיד..."
                      className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#00a884] text-sm resize-none h-16"
                    />
                    <button onClick={addGlobalRule} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-sm font-medium">הוסף כלל</button>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">כללים מקומיים (לשיחה הנוכחית בלבד)</h3>
                  {!currentChatId ? (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">יש להתחיל שיחה חדשה כדי להגדיר לה כללים.</p>
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