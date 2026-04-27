"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Flame, Loader2, Search, ArrowRight, RefreshCw, Factory, Info, FileText, Beaker, ChevronLeft, Layers, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import fuzzysort from "fuzzysort";

export default function ChatPage() {
  const [step, setStep] = useState("search"); 
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("online");
  const [sugestao, setSugestao] = useState(null);
  const [aiIntro, setAiIntro] = useState("");
  const [isIntroLoading, setIsIntroLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  const termosTecnicos = ["Fundida Zamac", "Cartucho", "Cartucho Fendilhado", "Coleira Mica", "Coleira Cerâmica", "Imersão Sobre Borda", "Infravermelho", "Termostato Capilar", "Fibra Cerâmica", "Tubular Aletada", "Aquecedor de Passagem", "Microtubular", "Manta de Silicone"];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = async (termoManual) => {
    const termoFinal = (termoManual || query).trim();
    if (!termoFinal) return;
    setResults([]); setAiIntro(""); setIsLoading(true); setStep("search"); 
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: termoFinal }), });
      const data = await res.json();
      setResults(data.resultados || []);
      setQuery(termoFinal);
      if (data.resultados && data.resultados.length > 0) {
        setIsIntroLoading(true);
        fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: termoFinal }], isIntro: true }) })
        .then(resIA => resIA.json()).then(dataIA => { if(dataIA.content) setAiIntro(dataIA.content); setIsIntroLoading(false); }).catch(() => setIsIntroLoading(false));
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const viewProduct = (product) => { setSelectedProduct(product); setStep("product"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const goToProductById = async (id) => {
    if (!id) return; setIsLoading(true);
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: id.trim() }), });
      const data = await res.json();
      const match = data.resultados.find(p => p.id.toUpperCase() === id.trim().toUpperCase());
      if (match) viewProduct(match); else if (data.resultados.length > 0) viewProduct(data.resultados[0]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const processMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs); setInput(""); setIsLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs, productName: selectedProduct.nome }) });
      const data = await res.json(); setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (e) { setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão." }]); } finally { setIsLoading(false); }
  };

  // COMPONENTES DE FORMATAÇÃO (O segredo do espaçamento está aqui)
  const markdownComponents = {
    p: ({children}) => <p className="mb-6 leading-relaxed text-zinc-600 font-light last:mb-0">{children}</p>,
    h1: ({children}) => <h1 className="text-2xl font-bold text-zinc-900 mb-4">{children}</h1>,
    h2: ({children}) => <h2 className="text-xs font-bold text-zinc-400 mt-6 mb-2 uppercase tracking-widest">{children}</h2>,
    table: ({children}) => <div className="overflow-x-auto my-6 border border-zinc-200 rounded-xl"><table className="min-w-full text-sm text-left border-collapse">{children}</table></div>,
    th: ({children}) => <th className="p-3 bg-zinc-50 font-bold text-[10px] uppercase border-b border-zinc-200">{children}</th>,
    td: ({children}) => <td className="p-3 border-b border-zinc-100">{children}</td>,
  };

  return (
    <div className="flex flex-col h-screen bg-white text-zinc-900 overflow-hidden">
      <header className="px-6 py-5 bg-white border-b border-zinc-100 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setStep("search"); setResults([]); setQuery("");}}>
          <Flame className="text-zinc-900 w-5 h-5" />
          <h1 className="font-bold text-xs tracking-widest uppercase">Casa das Resistências</h1>
        </div>
        {step !== "search" && (<button onClick={() => setStep("search")} className="text-zinc-400 hover:text-zinc-900 text-[10px] font-bold uppercase">Voltar</button>)}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-12">
        <div className="max-w-3xl mx-auto">
          
          {step === "search" && (
            <div className="space-y-10">
              <div className="text-center space-y-4">
                <Factory size={32} className="text-zinc-200 mx-auto" />
                <h2 className="text-3xl font-bold tracking-tighter uppercase">Catálogo Técnico</h2>
              </div>
              
              <div className="max-w-2xl mx-auto">
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="relative">
                  <input value={query} onChange={e => setQuery(e.target.value)} className="w-full border border-zinc-200 p-5 rounded-2xl outline-none focus:border-zinc-900 shadow-sm" placeholder="O que você precisa aquecer hoje?" />
                  <button type="submit" className="absolute right-3 top-3 bottom-3 bg-zinc-900 text-white px-5 rounded-xl">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}</button>
                </form>
              </div>

              {results.length > 0 && (
                <div className="max-w-2xl mx-auto mt-8 animate-in fade-in">
                  {isIntroLoading ? (
                    <div className="flex items-center gap-3 text-zinc-400 text-xs font-bold uppercase bg-zinc-50 p-4 rounded-2xl"><Loader2 size={14} className="animate-spin" /> Consultando engenharia...</div>
                  ) : aiIntro ? (
                    <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-2xl flex gap-4 items-start shadow-sm mb-10">
                      <div className="bg-zinc-900 text-white p-2 rounded-xl shrink-0"><Flame size={16} /></div>
                      <div className="text-zinc-700 text-sm leading-relaxed w-full prose prose-zinc">
                        {/* AQUI O REACT MARKDOWN VAI CRIAR OS <P> COM MARGEM mb-6 */}
                        <ReactMarkdown components={markdownComponents}>{aiIntro}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
                {results.map((prod) => (
                  <button key={prod.id} onClick={() => viewProduct(prod)} className="flex items-center justify-between p-6 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-900 transition-all text-left group">
                    <div className="space-y-2">
                      <div className="text-[9px] font-bold uppercase text-zinc-400">{prod.id} • {prod.linha}</div>
                      <h3 className="font-bold text-zinc-900 text-lg uppercase">{prod.nome}</h3>
                      <p className="text-zinc-500 text-xs line-clamp-2">{prod.descricaoCurta}</p>
                    </div>
                    <ArrowRight className="text-zinc-200 group-hover:text-zinc-900 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "product" && selectedProduct && (
            <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-zinc-200 shadow-sm relative overflow-hidden">
               {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin" size={32} /></div>}
               <ReactMarkdown components={markdownComponents}>{selectedProduct.texto}</ReactMarkdown>
               <button onClick={() => setStep("chat")} className="mt-10 w-full bg-zinc-900 text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-3">Solicitar Orçamento <ArrowRight size={18} /></button>
            </div>
          )}

          {step === "chat" && (
            <div className="space-y-6 pb-40">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`p-5 max-w-[85%] rounded-2xl text-sm ${m.role === "user" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 shadow-sm"}`}>
                    <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {step === "chat" && (
        <footer className="fixed bottom-0 w-full p-6 bg-white border-t border-zinc-100">
          <form onSubmit={e => { e.preventDefault(); processMessage(input); }} className="max-w-3xl mx-auto flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Digite sua dúvida técnica..." className="flex-1 border border-zinc-200 p-4 rounded-2xl outline-none focus:border-zinc-900" />
            <button type="submit" className="bg-zinc-900 text-white px-6 rounded-2xl"><Send size={18} /></button>
          </form>
        </footer>
      )}
    </div>
  );
}