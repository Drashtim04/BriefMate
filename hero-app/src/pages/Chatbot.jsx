import { useEffect, useState } from "react";
import { Send, Bot, User, Menu, Loader2, Filter, FileText } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createChatSession, getChatSessionHistory, sendChatQuery } from "../lib/api";

const CHATBOT_STORAGE_KEY = "hrx.chatbot.state.v2";

const DEFAULT_MESSAGES = [
  {
    id: "welcome",
    sender: "bot",
    text: "Hello! I'm your HR Intelligence Assistant. Ask about retention risk, sentiment, or specific employees.",
    transcriptCards: [],
    filters: {},
    count: 0,
  },
];

function mapSessionMessagesToUi(rows = []) {
  return rows
    .map((row) => {
      const role = String(row?.role || "assistant").toLowerCase();
      const text = String(row?.content || "").trim();
      if (!text) return null;

      const sender = role === "user" ? "user" : "bot";
      const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};

      return {
        id: `db-${String(row?.messageIndex ?? "")}-${String(row?.createdAt || "")}`,
        sender,
        text,
        transcriptCards: sender === "bot" && Array.isArray(metadata.transcriptCards) ? metadata.transcriptCards : [],
        filters: sender === "bot" && metadata.filters && typeof metadata.filters === "object" ? metadata.filters : {},
        count: sender === "bot" ? Number(metadata.count || 0) : 0,
      };
    })
    .filter(Boolean);
}

function buildChatHistoryFromMessages(rows = []) {
  return rows
    .filter((row) => row?.sender === "user" && String(row?.text || "").trim())
    .slice()
    .reverse()
    .map((row, index) => ({ id: `hist-${index}-${String(row.id || "")}`, text: row.text }))
    .slice(0, 8);
}

export function Chatbot() {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);

  useEffect(() => {
    let isMounted = true;

    async function hydrateFromDb() {
      let parsed = null;
      try {
        const raw = window.localStorage.getItem(CHATBOT_STORAGE_KEY);
        parsed = raw ? JSON.parse(raw) : null;
      } catch (_err) {
        parsed = null;
      }

      const cachedMessages = Array.isArray(parsed?.messages) ? parsed.messages : [];
      const cachedHistory = Array.isArray(parsed?.chatHistory) ? parsed.chatHistory : [];
      const cachedSessionId = String(parsed?.sessionId || "").trim();

      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }
      if (cachedHistory.length > 0) {
        setChatHistory(cachedHistory);
      }
      if (cachedSessionId) {
        setSessionId(cachedSessionId);
      }

      try {
        let activeSessionId = cachedSessionId;
        if (!activeSessionId) {
          const created = await createChatSession();
          activeSessionId = String(created?.sessionId || "").trim();
        }

        if (!isMounted) return;
        if (activeSessionId) {
          setSessionId(activeSessionId);

          const historyPayload = await getChatSessionHistory(activeSessionId, 180);
          if (!isMounted) return;

          const restoredMessages = mapSessionMessagesToUi(historyPayload?.data || []);
          if (restoredMessages.length > 0) {
            setMessages(restoredMessages);
            setChatHistory(buildChatHistoryFromMessages(restoredMessages));
          } else if (cachedMessages.length === 0) {
            setMessages(DEFAULT_MESSAGES);
            setChatHistory([]);
          }
        }
      } catch (_err) {
        if (!isMounted) return;
        if (cachedMessages.length === 0) {
          setMessages(DEFAULT_MESSAGES);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    hydrateFromDb();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHATBOT_STORAGE_KEY,
        JSON.stringify({
          sessionId,
          messages: messages.slice(-60),
          chatHistory: chatHistory.slice(0, 20),
        })
      );
    } catch (_err) {
      // Ignore storage quota or access errors.
    }
  }, [messages, chatHistory, sessionId]);

  const SUGGESTED_PROMPTS = [
    "Show critical employees with health over 30",
    "Which employees are at high retention risk?",
    "Summarize latest concerns for niharmehta245@gmail.com",
    "Who has declining sentiment this week?",
  ];

  function formatFilterLabel(value) {
    return String(value || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/[_.-]+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  const handleSend = async () => {
    if (!input.trim()) return;
    if (isSending || isHydrating) return;
    const nextInput = input.trim();
    setIsSending(true);

    let activeSessionId = String(sessionId || "").trim();
    if (!activeSessionId) {
      try {
        const created = await createChatSession();
        activeSessionId = String(created?.sessionId || "").trim();
        if (activeSessionId) {
          setSessionId(activeSessionId);
        }
      } catch (_err) {
        // Continue; server can still allocate session ID on query.
      }
    }
    
    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: nextInput,
        transcriptCards: [],
        filters: {},
        count: 0,
      },
    ].slice(-60));
    setChatHistory((prev) => [{ id: Date.now(), text: nextInput }, ...prev].slice(0, 8));
    setInput("");

    try {
      const result = await sendChatQuery(nextInput, { sessionId: activeSessionId });
      if (result?.sessionId && String(result.sessionId).trim() && result.sessionId !== activeSessionId) {
        setSessionId(String(result.sessionId).trim());
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: result.answer || "I could not generate a response for that request.",
          transcriptCards: Array.isArray(result.transcriptCards) ? result.transcriptCards : [],
          filters: result.filters && typeof result.filters === "object" ? result.filters : {},
          count: Number(result.count || 0),
        },
      ].slice(-60));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text:
            "The intelligence backend is currently unavailable. Please verify backend and LLM services are running, then try again.",
          transcriptCards: [],
          filters: {},
          count: 0,
        },
      ].slice(-60));
    } finally {
      setIsSending(false);
    }
  };

  const fillPrompt = (text) => setInput(text);

  return (
    <div className="surface-card flex h-[calc(100vh-140px)] rounded-2xl overflow-hidden">
      
      {/* Left Panel - History */}
      <div className="hidden md:flex flex-col w-64 border-r border-[#dbe5e8] bg-[linear-gradient(180deg,#f7fbfc_0%,#eef5f7_100%)] p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
          <Menu className="w-4 h-4 mr-2" /> Recent Chats
        </h2>
        <div className="space-y-2">
          {chatHistory.map(chat => (
            <button key={chat.id} onClick={() => fillPrompt(chat.text)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-md hover:shadow-sm border border-transparent hover:border-gray-200 truncate transition-all">
              {chat.text}
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel - Conversation */}
      <div className="flex flex-col flex-1 bg-white relative">
        <div className="p-4 border-b border-[#dbe5e8] flex items-center bg-white/90 backdrop-blur-sm z-10">
          <Bot className="w-6 h-6 text-[#1f7a6c] mr-2" />
          <h1 className="text-lg font-bold text-[#1f2937]">HR AI Assistant</h1>
        </div>

        {/* Conversation messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isHydrating && (
            <div className="text-xs text-[#64748b]">Restoring chat history...</div>
          )}

          <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id || i}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-[#1f7a6c] text-white' : 'bg-gray-200 text-[#1f7a6c]'}`}>
                  {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className="space-y-2">
                  <div className={`p-4 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-[#1f7a6c] text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                    {msg.text}
                  </div>

                  {msg.sender === "bot" && msg.count > 0 && (
                    <div className="text-xs text-gray-500 px-1">Matched profiles: {msg.count}</div>
                  )}

                  {msg.sender === "bot" && Object.keys(msg.filters || {}).length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                      <div className="inline-flex items-center text-[11px] font-medium text-gray-500">
                        <Filter className="w-3 h-3 mr-1" /> Applied Filters
                      </div>
                      {Object.entries(msg.filters).map(([key, value]) => (
                        <span key={`${key}-${String(value)}`} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#1f7a6c]/10 text-[#165a50] text-[11px] border border-[#1f7a6c]/20">
                          {formatFilterLabel(key)}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.sender === "bot" && Array.isArray(msg.transcriptCards) && msg.transcriptCards.length > 0 && (
                    <div className="space-y-2">
                      {msg.transcriptCards.slice(0, 3).map((card, index) => (
                        <div key={`${card.employeeEmail || card.employeeName || "card"}-${index}`} className="p-3 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 shadow-sm">
                          <div className="font-semibold text-[#1f2937] flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-[#1f7a6c]" />
                            {card.employeeName || "Employee"}
                            {card.employeeEmail ? <span className="text-gray-400 font-normal">({card.employeeEmail})</span> : null}
                          </div>
                          <p className="mt-1 text-gray-600">{card.summary || "No summary available."}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>

          <AnimatePresence>
          {isSending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex justify-start"
            >
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200 text-[#1f7a6c]">
                  <Bot className="w-5 h-5" />
                </div>
                <motion.div
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  className="p-3 rounded-2xl rounded-tl-none bg-gray-100 text-gray-700 text-sm inline-flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </motion.div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Bottom Panel - Input & Suggestions */}
        <div className="p-4 bg-white border-t border-gray-200">
          {SUGGESTED_PROMPTS.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <motion.button 
                  key={i} 
                  className="px-3 py-1.5 text-xs text-[#1f7a6c] bg-[#1f7a6c]/10 hover:bg-[#1f7a6c]/20 rounded-full transition-colors border border-[#1f7a6c]/20"
                  onClick={() => fillPrompt(prompt)}
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          )}

          <div className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isHydrating ? "Restoring chat session..." : "Ask anything about your workforce..."}
              disabled={isSending || isHydrating}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1f7a6c]/50 focus:border-[#1f7a6c]"
            />
            <button 
              onClick={handleSend}
              disabled={isSending || isHydrating}
              className="absolute right-2 p-1.5 bg-[#1f7a6c] text-white rounded-lg hover:bg-[#165a50] transition-colors disabled:opacity-70"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
