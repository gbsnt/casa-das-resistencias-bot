"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Flame, Loader2 } from "lucide-react";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o especialista técnico da Casa das Resistências. Como posso ajudar no seu projeto hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Faz o scroll descer automaticamente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, tive um erro de conexão. Pode tentar novamente?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Flame className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-800">
              Casa das Resistências
            </h1>
            <p className="text-xs font-medium text-zinc-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Suporte Técnico Especializado
            </p>
          </div>
        </div>
      </header>

      {/* ÁREA DE MENSAGENS */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m, index) => (
            <div
              key={index}
              className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Ícone do Robô (se for assistant) */}
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-zinc-600" />
                </div>
              )}

              {/* Balão de Mensagem */}
              <div
                className={`px-5 py-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-zinc-900 text-white rounded-tr-sm"
                    : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>

              {/* Ícone do Usuário (se for user) */}
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Indicador de Digitação */}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-zinc-600" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-white border border-zinc-200 rounded-tl-sm flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                <span className="text-sm text-zinc-500 font-medium">Consultando o catálogo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ÁREA DE INPUT (RODAPÉ) */}
      <footer className="p-4 bg-white border-t border-zinc-200">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 p-1.5 bg-zinc-100 rounded-full border border-zinc-200 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent transition-all shadow-sm"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Pergunte sobre resistências, potência, dimensões..."
              className="flex-1 bg-transparent px-4 py-3 outline-none text-zinc-800 placeholder-zinc-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-zinc-900 text-white p-3 rounded-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-xs text-zinc-400 mt-3">
            O suporte com IA pode cometer erros. Verifique informações críticas com nossa equipe.
          </p>
        </div>
      </footer>
    </div>
  );
}