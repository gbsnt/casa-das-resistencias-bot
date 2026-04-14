"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Flame, Loader2, Cpu, Cloud, Activity, Gauge, HardDrive } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o especialista técnico da **Casa das Resistências**. Monitoramento de hardware ativo. Como posso ajudar? [OPCOES: 🔥 Resistência Cartucho, 💧 Resistência Tubular]",
    },
  ]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState("local"); 
  const [stats, setStats] = useState({ cpu: 0, ram: 0 });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) { console.log("Erro telemetria"); }
    };
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const processMessage = async (textToSend) => {
    if (!textToSend.trim() || isLoading) return;
    setIsLoading(true);
    const userMsg = { role: "user", content: textToSend };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, aiMode }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Erro na conexão técnica." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (text, isAssistant, msgIndex) => {
    let cleanText = text;
    let options = [];

    if (isAssistant) {
      const match = text.match(/\[OPCOES:\s*(.+?)\]/);
      if (match) {
        cleanText = text.replace(match[0], '').trim();
        options = match[1].split(',').map(o => o.trim());
      }
    }

    const isLast = isAssistant && msgIndex === messages.length - 1;

    return (
      <div className="flex flex-col gap-3">
        <div className={`prose prose-sm max-w-none leading-relaxed ${isAssistant ? 'text-zinc-700' : 'text-white'}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanText}</ReactMarkdown>
        </div>
        {options.length > 0 && isLast && !isLoading && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-100">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => processMessage(opt)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#5897fb] bg-white border border-zinc-200 rounded-lg hover:border-[#5897fb] hover:bg-blue-50 transition-all shadow-sm active:scale-95"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fc] text-zinc-900 overflow-hidden font-sans">
      
      {/* HEADER TÉCNICO REFINADO */}
      <header className="flex-none flex items-center justify-between px-8 py-4 bg-white border-b border-zinc-200 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
            <Flame className="w-6 h-6 text-[#5897fb]" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter text-zinc-800 leading-none">Casa das Resistências</h1>
            <div className="flex gap-4 mt-2">
              {/* STATUS CPU */}
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${stats.cpu > 50 ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">CPU: {stats.cpu}%</span>
              </div>
              {/* STATUS RAM (NOVO) */}
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${stats.ram > 85 ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">RAM: {stats.ram}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button onClick={() => setAiMode("cloud")} className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black rounded-xl transition-all ${aiMode === "cloud" ? "bg-white text-[#5897fb] shadow-sm" : "text-zinc-400"}`}>
            <Cloud className="w-3.5 h-3.5" /> NUVEM
          </button>
          <button onClick={() => setAiMode("local")} className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black rounded-xl transition-all ${aiMode === "local" ? "bg-[#5897fb] text-white shadow-md" : "text-zinc-400"}`}>
            <Activity className="w-3.5 h-3.5" /> LOCAL
          </button>
        </div>
      </header>

      {/* CHAT AREA */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {messages.map((m, index) => (
            <div key={index} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shrink-0 shadow-sm text-zinc-400">
                  <Bot className="w-5 h-5" />
                </div>
              )}
              <div className={`px-6 py-4 rounded-3xl shadow-md border ${
                m.role === "user" 
                ? "bg-[#007AFF] text-white border-[#0066CC] rounded-tr-none" 
                : "bg-white text-zinc-700 border-zinc-200/50 rounded-tl-none"
              } max-w-[85%]`}>
                {renderMessageContent(m.content, m.role === "assistant", index)}
              </div>
              {m.role === "user" && (
                <div className="w-9 h-9 rounded-xl bg-[#007AFF] flex items-center justify-center shrink-0 shadow-lg text-white">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-zinc-200"></div>
              <div className="px-6 py-4 rounded-3xl bg-white border border-zinc-200 flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin" />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Processando localmente...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="flex-none p-6 bg-white border-t border-zinc-100">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); processMessage(input); }} className="flex items-center bg-zinc-100 rounded-[2rem] p-1.5 border border-zinc-200 focus-within:ring-4 focus-within:ring-[#007AFF]/10 transition-all shadow-inner">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={aiMode === 'local' ? "MacBook Pro processando..." : "Descreva sua necessidade técnica..."}
              className="flex-1 bg-transparent px-5 py-3 outline-none text-sm font-medium"
              disabled={isLoading}
            />
            <button 
              type="submit" disabled={isLoading || !input.trim()}
              className="bg-[#007AFF] text-white p-3.5 rounded-full hover:scale-105 active:scale-95 disabled:opacity-20 transition-all shadow-lg shadow-blue-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="mt-4 text-center">
             <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-300">Apple Silicon Neural Engine Optimized</p>
          </div>
        </div>
      </footer>
    </div>
  );
}