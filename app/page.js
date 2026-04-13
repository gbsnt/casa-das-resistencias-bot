"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Flame, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o especialista técnico da **Casa das Resistências**. Como posso ajudar no seu projeto hoje? 🔧✨",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Erro de conexão. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#5897fb]/10 rounded-lg">
            <Flame className="w-6 h-6 text-[#5897fb]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-800">Casa das Resistências</h1>
            <p className="text-xs font-medium text-zinc-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Suporte Técnico Especialista
            </p>
          </div>
        </div>
      </header>

      {/* MENSAGENS */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((m, index) => (
            <div key={index} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`px-5 py-4 rounded-2xl shadow-sm border ${
                m.role === "user" ? "bg-zinc-900 text-white rounded-tr-sm" : "bg-white border-zinc-200 text-zinc-700 rounded-tl-sm"
              }`}>
                <div className="markdown-content prose prose-zinc max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      strong: ({children}) => <span className="font-semibold text-[#5897fb]">{children}</span>,
                      table: ({children}) => (
                        <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200">
                          <table className="min-w-full divide-y divide-zinc-200 text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({children}) => <thead className="bg-zinc-50">{children}</thead>,
                      th: ({children}) => (
                        <th className="px-4 py-3 text-left font-bold text-[#5897fb] uppercase tracking-wider border-b">
                          {children}
                        </th>
                      ),
                      td: ({children}) => <td className="px-4 py-2 border-b border-zinc-100">{children}</td>,
                      h3: ({children}) => <h3 className="text-lg font-bold text-[#5897fb] mt-4 mb-2">{children}</h3>,
                      p: ({children}) => <p className="mb-2 leading-relaxed whitespace-pre-wrap">{children}</p>
                    }}
                  >{m.content}</ReactMarkdown>
                </div>
              </div>
              {m.role === "user" && (
                <div className="w-9 h-9 rounded-full bg-[#5897fb] flex items-center justify-center shrink-0 shadow-md">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start animate-pulse">
              <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="px-6 py-4 rounded-2xl bg-white border border-zinc-200 flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-[#5897fb] animate-spin" />
                <span className="text-sm text-zinc-500 font-medium">Consultando engenharia...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="p-4 bg-white border-t">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={sendMessage} className="flex items-center gap-2 p-1.5 bg-zinc-100 rounded-2xl border focus-within:ring-2 focus-within:ring-[#5897fb]/30 transition-all">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva sua necessidade técnica..."
              className="flex-1 bg-transparent px-4 py-3 outline-none"
            />
            <button type="submit" className="bg-[#5897fb] text-white p-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#5897fb]/20">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-[10px] uppercase tracking-widest text-zinc-400 mt-4 font-bold">
            Powered by Casa das Resistências Tech ⚡
          </p>
        </div>
      </footer>
    </div>
  );
}