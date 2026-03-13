import { useState } from "react";
import { Send, Bot, User, Menu } from "lucide-react";
import { sendChatQuery } from "../lib/api";

export function Chatbot() {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! I'm your HR Intelligence Assistant. How can I help you today?" }
  ]);

  const SUGGESTED_PROMPTS = [];

  const handleSend = async () => {
    if (!input.trim()) return;
    if (isSending) return;
    const nextInput = input.trim();
    setIsSending(true);
    
    // Add user message
    setMessages(prev => [...prev, { sender: "user", text: nextInput }]);
    setChatHistory((prev) => [{ id: Date.now(), text: nextInput }, ...prev].slice(0, 8));
    setInput("");

    try {
      const result = await sendChatQuery(nextInput);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: result.answer || "I could not generate a response for that request.",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            "The intelligence backend is currently unavailable. Please verify backend and LLM services are running, then try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const fillPrompt = (text) => setInput(text);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Left Panel - History */}
      <div className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-gray-50 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
          <Menu className="w-4 h-4 mr-2" /> Recent Chats
        </h2>
        <div className="space-y-2">
          {chatHistory.map(chat => (
            <button key={chat.id} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-md hover:shadow-sm border border-transparent hover:border-gray-200 truncate transition-all">
              {chat.text}
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel - Conversation */}
      <div className="flex flex-col flex-1 bg-white relative">
        <div className="p-4 border-b border-gray-200 flex items-center bg-white z-10">
          <Bot className="w-6 h-6 text-[#1f7a6c] mr-2" />
          <h1 className="text-lg font-bold text-[#1f2937]">HR AI Assistant</h1>
        </div>

        {/* Conversation messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-[#1f7a6c] text-white' : 'bg-gray-200 text-[#1f7a6c]'}`}>
                  {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-[#1f7a6c] text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Panel - Input & Suggestions */}
        <div className="p-4 bg-white border-t border-gray-200">
          {SUGGESTED_PROMPTS.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button 
                  key={i} 
                  className="px-3 py-1.5 text-xs text-[#1f7a6c] bg-[#1f7a6c]/10 hover:bg-[#1f7a6c]/20 rounded-full transition-colors border border-[#1f7a6c]/20"
                  onClick={() => fillPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about your workforce..."
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1f7a6c]/50 focus:border-[#1f7a6c]"
            />
            <button 
              onClick={handleSend}
              disabled={isSending}
              className="absolute right-2 p-1.5 bg-[#1f7a6c] text-white rounded-lg hover:bg-[#165a50] transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
