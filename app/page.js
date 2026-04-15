"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Flame, Loader2, Cloud, Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MAX_SESSION_TOKENS = 25000; 

export default function ChatPage() {
  // 1. Começamos com a lista vazia para a IA preencher a vitrine via RAG
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState("cloud"); 
  const [sessionTokens, setSessionTokens] = useState(0);
  const [stats, setStats] = useState({ cpu: 0, ram: 0 });
  const [isLocalhost, setIsLocalhost] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Controle para evitar disparos duplicados no desenvolvimento
  const hasInitialized = useRef(false);

  // 🌍 DETECÇÃO DE AMBIENTE
  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      setIsLocalhost(true);
      setAiMode("local"); 
    }
  }, []);

  // 🤖 GATILHO DA VITRINE DINÂMICA (RAG)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchWelcomeMessage = async () => {
      setIsLoading(true);
      try {
        // Pergunta focada em PRODUTOS REAIS para forçar o RAG a trazer os dados certos
        const hiddenMessage = [{ 
          role: "user", 
          content: "Liste apenas os principais títulos de produtos industriais disponíveis neste catálogo técnico." 
        }];

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: hiddenMessage, aiMode: "cloud" }),
        });
        
        const data = await response.json();
        setMessages([{ role: "assistant", content: data.content }]);
        if (data.tokens) setSessionTokens(prev => prev + data.tokens);
      } catch (error) {
        setMessages([{ role: "assistant", content: "Bem-vindo à Casa das Resistências. [OPCOES: Resistências Cartucho, Resistências Tubulares, Resistências Coleira]" }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWelcomeMessage();
  }, []);

  // 🔄 TELEMETRIA
  useEffect(() => {
    if (!isLocalhost) return;
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
  }, [isLocalhost]);

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
      
      if (data.tokens && aiMode === "cloud") {
        setSessionTokens(prev => prev + data.tokens);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Erro na conexão técnica. [OPCOES: Tentar novamente]" }]);
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
      <div className="flex flex-col gap-3 w-full">
        <div className={`prose prose-sm max-w-none leading-relaxed ${isAssistant ? 'text-zinc-700' : 'text-white'}`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({node, ...props}) => (
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-zinc-200 shadow-sm bg-white">
                  <table className="min-w-full text-left border-collapse text-sm whitespace-nowrap" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-zinc-50 border-b border-zinc-200" {...props} />,
              th: ({node, ...props}) => <th className="px-4 py-3 font-bold text-zinc-700 uppercase tracking-wider text-[11px]" {...props} />,
              td: ({node, ...props}) => <td className="px-4 py-3 text-zinc-600 border-b border-zinc-100 last:border-none" {...props} />,
              tr: ({node, ...props}) => <tr className="even:bg-zinc-50/50 hover:bg-blue-50/40 transition-colors" {...props} />,
              p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />
            }}
          >
            {cleanText}
          </ReactMarkdown>
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

  const tokenPercentage = Math.min((sessionTokens / MAX_SESSION_TOKENS) * 100, 100);

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fc] text-zinc-900 overflow-hidden font-sans">
      
      <header className="flex-none flex items-center justify-between px-6 sm:px-8 py-4 bg-white border-b border-zinc-200 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
            <Flame className="w-6 h-6 text-[#5897fb]" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter text-zinc-800 leading-none">Casa das Resistências</h1>
            <div className="flex gap-4 mt-2">
              {isLocalhost && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${stats.cpu > 50 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">CPU: {stats.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${stats.ram > 80 ? 'bg-red-500 animate-pulse' : stats.ram > 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">RAM: {stats.ram}%</span>
                  </div>
                </>
              )}
              {!isLocalhost && (
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase">Sistema Online</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end min-w-[100px]">
            <span className="text-[9px] font-black text-zinc-400 uppercase leading-none mb-1">Tokens da Sessão</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-zinc-700">{sessionTokens.toLocaleString()}</span>
              <div className="w-16 h-1 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                <div className="h-full bg-[#5897fb] transition-all duration-500" style={{ width: `${tokenPercentage}%` }}></div>
              </div>
            </div>
          </div>

          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button onClick={() => setAiMode("cloud")} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${aiMode === "cloud" ? "bg-white text-[#5897fb] shadow-sm" : "text-zinc-400"}`}>
              <Cloud className="w-3.5 h-3.5" /> CLOUD
            </button>
            {isLocalhost && (
              <button onClick={() => setAiMode("local")} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${aiMode === "local" ? "bg-[#5897fb] text-white shadow-md" : "text-zinc-400"}`}>
                <Activity className="w-3.5 h-3.5" /> LOCAL
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
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
              } max-w-[95%] sm:max-w-[85%] overflow-x-auto`}>
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
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lendo Catálogo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="flex-none p-6 bg-white border-t border-zinc-100">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); processMessage(input); }} className="flex items-center bg-zinc-100 rounded-[2rem] p-1.5 border border-zinc-200 focus-within:ring-4 focus-within:ring-[#007AFF]/10 transition-all shadow-inner">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={aiMode === 'local' ? "Motor Local Ativo..." : "Dúvida técnica?"}
              className="flex-1 bg-transparent px-5 py-3 outline-none text-sm font-medium"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="bg-[#007AFF] text-white p-3.5 rounded-full hover:scale-105 shadow-lg shadow-blue-200">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="mt-4 text-center">
             <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-300">Casa das Resistências • RAG Engine v3.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}