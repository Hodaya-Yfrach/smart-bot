"use client";
import { verifySitePassword } from './actions';
import { useState, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SideModal from '@/components/SideModal';
import Sidebar from '@/components/Sidebar';
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
  
  return "אירעה שגיאה בתקשורת. אנא ודאו שכל הפרטים נכונים ונסו שוב.";
};

export default function Home() {
  // 1. משתמשים (ללא נעילת אתר)
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // מעבר בין התחברות להרשמה
  const [fullName, setFullName] = useState(''); // שם
  const [phone, setPhone] = useState('');       // טלפון
  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // 2. צ'אט והיסטוריה
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessageType[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatRecord[]>([]);
  const [input, setInput] = useState('');

  // 3. מודלים (Modals) וזיכרון
  const [isSideModalOpen, setIsSideModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [globalRules, setGlobalRules] = useState<RuleRecord[]>([]);
  const [chatRules, setChatRules] = useState<RuleRecord[]>([]);
  const [newGlobalRule, setNewGlobalRule] = useState('');
  const [newChatRule, setNewChatRule] = useState('');

  // 4. מצבי AI וחיבור (BYOK + Fallback)
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);
  
  // 5. ניהול מפתח API נעילה/עריכה
  const [userApiKey, setUserApiKey] = useState('');
  const [isApiKeyLocked, setIsApiKeyLocked] = useState(false); 
  const [currentModelName, setCurrentModelName] = useState(AVAILABLE_MODELS[0]);

  // בדיקה אם האורח ניצל את השאלה היחידה שלו
  const guestLimitReached = isGuest && mainMessages.some(msg => msg.role === 'user');

  // פונקציית עזר לבניית הוראות המערכת המאוחדות
  const getCombinedSystemInstructions = () => {
    const currentDate = new Date().toLocaleDateString('he-IL');
    let combined = `התאריך היום הוא ${currentDate}.\n`;
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

  // טעינת כל נתוני המשתמש מה-DB כשהוא מתחבר (כולל מפתח ומודל מועדף)
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        // משיכת ההגדרות מהפרופיל
        const { data: profile } = await supabase
          .from('profiles')
          .select('api_key, preferred_model')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.api_key) {
            setUserApiKey(profile.api_key);
            setIsApiKeyLocked(true); 
          }
          if (profile.preferred_model) {
            setSelectedModel(profile.preferred_model);
            setCurrentModelName(profile.preferred_model);
          }
        }

        loadChatHistory();
        loadRules();
      } else {
        setChatHistory([]);
        setGlobalRules([]);
        setUserApiKey('');
        setIsApiKeyLocked(false);
      }
    };
    
    fetchUserData();
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

  const handleDeleteChat = async (chatId: string) => {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (!error) {
      setChatHistory(prev => prev.filter(c => c.id !== chatId));
      if (currentChatId === chatId) {
        startNewChat();
      }
    } else {
      alert("שגיאה במחיקת השיחה");
    }
  };

  const handleUpdateChatTitle = async (chatId: string, newTitle: string) => {
    const { error } = await supabase.from('chats').update({ title: newTitle }).eq('id', chatId);
    if (!error) {
      setChatHistory(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
    } else {
      alert("שגיאה בעדכון כותרת השיחה");
    }
  };

  // --- פעולות התחברות ---
  const handleLogin = async () => {
    if (!email || !authPassword) {
      alert("אנא מלאו אימייל וסיסמה.");
      return;
    }
    
    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    
    if (error) {
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

  const handleSaveUserSettings = async () => {
    if (!user) {
      alert("יש להתחבר כדי לשמור הגדרות לחשבון.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        api_key: userApiKey.trim(),
        preferred_model: selectedModel
      })
      .eq('id', user.id);

    if (error) {
      alert("אירעה שגיאה בשמירת ההגדרות.");
      console.error(error);
    } else {
      alert("ההגדרות נשמרו בחשבונך בהצלחה!");
      if (userApiKey.trim() !== '') {
        setIsApiKeyLocked(true); 
      } else {
        setIsApiKeyLocked(false);
      }
      setIsSettingsModalOpen(false);
    }
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

  // --- רינדור מסך התחברות / הרשמה ---
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
                className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-[#ec4899] text-right"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                type="tel"
                placeholder="מספר טלפון (חובה)"
                className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-[#ec4899] text-right"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}

          <input
            type="email"
            placeholder="אימייל"
            className="w-full p-3 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-[#ec4899] text-right"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="סיסמה (לפחות 6 תווים)"
            className="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#ec4899] text-right"
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
              <a href="/forgot-password" className="text-sm text-pink-600 hover:underline">שכחת סיסמה?</a>
            </div>
          )}

          {isLoginMode ? (
            <button onClick={handleLogin} disabled={isLoadingAuth} className="w-full bg-[#ec4899] text-white py-3 rounded-xl font-bold hover:bg-[#db2777] mb-3 transition-all disabled:opacity-50">
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
          <button onClick={() => setIsGuest(true)} className="w-full bg-transparent border-2 border-pink-300 text-pink-600 py-3 rounded-xl font-bold hover:bg-pink-50 transition-all">המשך כאורח (ללא היסטוריה)</button>
        </div>
      </div>
    );
  }

  // --- המסך הראשי ---
  return (
    <div dir="rtl" className="flex h-[100dvh] overflow-hidden bg-[#efeae2] relative">

      {/* תפריט צד (Sidebar) */}
      <Sidebar 
        user={user}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onSelectChat={loadSingleChat}
        onStartNewChat={startNewChat}
        onLogout={handleLogout}
        onDeleteChat={handleDeleteChat}
        onUpdateTitle={handleUpdateChatTitle}
      />

      {/* אזור התוכן המרכזי */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className="bg-[#f0f2f5] p-4 shadow-sm z-10 flex justify-between items-center border-b border-gray-200 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Workspace</h1>
            {user && <span className="text-xs text-gray-500">{user.email}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSettingsModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-600 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
              <span className="text-lg">⚙️</span> הגדרות AI
            </button>
            {user && (
              <button onClick={() => setIsMemoryModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-600 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
                <span className="text-lg">🧠</span> כללים וזיכרון
              </button>
            )}
            <button onClick={() => setIsSideModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-600 font-medium transition-all shadow-sm flex items-center gap-2 text-sm">
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
                  {/* עיגול הטעינה הפך לוורוד */}
                  <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#ec4899] rounded-full"></div>
                  <span>ממתין לתשובה... {countdown > 0 ? `(${countdown} שניות)` : '(מעבד...)'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* סרגל הקלדה */}
        <div className="bg-[#f0f2f5] p-3 md:p-4 border-t border-gray-200 shrink-0 flex flex-col items-center">
          <div className="w-full max-w-3xl flex gap-3 mb-2">
            <input
              className="flex-1 p-3 bg-white border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-pink-300 shadow-sm text-base disabled:opacity-50 disabled:bg-gray-100"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMainSend()}
              placeholder={guestLimitReached ? "הגעת למגבלת השאלות לאורח 🔒" : "הקלידי הודעה..."}
              disabled={isWaiting || guestLimitReached}
            />
            <button
              onClick={handleMainSend}
              disabled={isWaiting || guestLimitReached}
              className="bg-[#ec4899] text-white px-8 rounded-xl hover:bg-[#db2777] font-bold transition-colors shadow-sm disabled:bg-gray-400"
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
                    className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-[#ec4899] outline-none"
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
                  <div className="flex gap-2">
                    <input
                      type={isApiKeyLocked ? "password" : "text"}
                      placeholder="השאר/י ריק כדי להשתמש במפתח של האתר"
                      className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#ec4899] outline-none text-left disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                      dir="ltr"
                      value={isApiKeyLocked && userApiKey ? '••••••••••••••••••••••••••••' : userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      disabled={isApiKeyLocked}
                    />
                    
                    {isApiKeyLocked && (
                      <button 
                        onClick={() => setIsApiKeyLocked(false)} 
                        className="bg-gray-200 text-gray-700 px-4 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                      >
                        ערוך
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    המפתח נשמר בצורה מאובטחת בחשבון שלך וישמש אותך בכל מחשב שממנו תתחברי.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSaveUserSettings} 
                    className="w-full bg-[#ec4899] text-white py-3 rounded-xl font-bold hover:bg-[#db2777] transition-all"
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
                      className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#ec4899] text-sm resize-none h-16"
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
                            // שינינו את הירוק (green-50, green-900) לוורוד (pink-50, pink-900)
                            <div key={rule.id} className="flex justify-between items-start bg-pink-50 p-3 rounded-lg text-sm text-pink-900 border border-pink-100">
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
                          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#ec4899] text-sm resize-none h-16"
                        />
                        <button onClick={addChatRule} className="bg-[#ec4899] hover:bg-[#db2777] text-white px-4 rounded-lg text-sm font-medium">הוסף לשיחה</button>
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