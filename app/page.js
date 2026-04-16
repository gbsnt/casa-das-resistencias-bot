"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Flame, Loader2, Search, ArrowRight, RefreshCw, Factory, ClipboardList, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import fuzzysort from "fuzzysort"; // Importação necessária

export default function ChatPage() {
  const [step, setStep] = useState("search"); 
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("online");
  const [sugestao, setSugestao] = useState(null); // Estado para sugestão
  const messagesEndRef = useRef(null);

  // Lista de termos técnicos para o "Você quis dizer?"
  const termosTecnicos = [
    "Fundida Zamac", "Cartucho", "Cartucho Fendilhado", "Coleira Mica", 
    "Coleira Cerâmica", "Imersão Sobre Borda", "Infravermelho", 
    "Termostato Capilar", "Fibra Cerâmica", "Tubular Aletada", 
    "Aquecedor de Passagem", "Microtubular", "Manta de Silicone"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Lógica de Sugestão (Did you mean?)
  const verificarSugestao = (termo) => {
    if (termo.length < 3) {
      setSugestao(null);
      return;
    }
    const res = fuzzysort.go(termo, termosTecnicos, { threshold: -10000, limit: 1 });
    if (res.length > 0 && res[0].score > -100) {
      // Se ele já acertou quase perfeitamente, não sugere
      if (res[0].score > -5) {
        setSugestao(null);
      } else {
        setSugestao(res[0].target);
      }
    } else {
      setSugestao(null);
    }
  };

  const syncCatalog = async () => {
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      if (data.success) {
        setSyncStatus("online");
        alert(`Sucesso! Catálogo atualizado com ${data.count} produtos.`);
      } else {
        setSyncStatus("error");
        alert("Erro na sincronização: " + data.error);
      }
    } catch (e) {
      setSyncStatus("error");
      alert("Erro ao conectar com servidor.");
    }
  };

  const handleSearch = async (termoManual) => {
    const termoFinal = termoManual || query;
    if (!termoFinal.trim()) return;
    
    // 1. LIMPEZA IMEDIATA: Mata os resultados anteriores antes de começar
    setResults([]); 
    setIsLoading(true);
    setSugestao(null);
  
    try {
      const res = await fetch("/api/search", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: termoFinal }),
        cache: 'no-store', // 2. ANTI-CACHE: Força o navegador a buscar dado novo sempre
      });
      
      const data = await res.json();
      
      // 3. VALIDAÇÃO: Só atualiza se a query ainda for a mesma (evita atropelo de respostas)
      setResults(data.resultados || []);
    } catch (e) { 
      console.error("Erro busca"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const viewProduct = (product) => {
    setSelectedProduct(product);
    setStep("product");
  };

  const startCommercialChat = () => {
    setStep("chat");
    setMessages([{
      role: "assistant",
      content: `Olá. Sou o especialista comercial da Casa das Resistências. Para montarmos a proposta do modelo **${selectedProduct.nome}**, qual a quantidade de peças que você precisa? E quais as medidas exatas? [OPCOES: Orçar 10 peças, Tenho um desenho técnico, Falar com Vendedor]`
    }]);
  };

  const processMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMsgs, productName: selectedProduct.nome })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão." }]);
    } finally { setIsLoading(false); }
  };

  const formatMarkdownText = (text) => {
    if (!text) return "";
    let formatted = text;

    formatted = formatted.replace(
      /## Especificações Técnicas\n([\s\S]*?)(?=\n##|$)/g,
      (match, content) => {
        const rows = content.split('\n').filter(line => line.trim().startsWith('-')).map(line => {
          const cleanLine = line.replace(/^- /, '');
          const splitMatch = cleanLine.match(/^(.*?):(.*)$/);
          if (splitMatch) {
            const key = splitMatch[1].replace(/\*\*/g, '').trim();
            const val = splitMatch[2].replace(/\*\*/g, '').trim();
            return `| **${key}** | ${val} |`;
          }
          return `| ${cleanLine} | |`;
        });
        if (rows.length === 0) return match;
        return `## Especificações Técnicas\n\n| Característica | Detalhe Técnico |\n|---|---|\n${rows.join('\n')}\n\n`;
      }
    );

    formatted = formatted.replace(
      /## Códigos para Pedido \(SKU\)\n([\s\S]*?)(?=\n##|$)/g,
      (match, content) => {
        const rows = content.split('\n').filter(line => line.trim().startsWith('-')).map(line => {
          const cleanLine = line.replace(/^- /, '');
          const splitMatch = cleanLine.split('→');
          if (splitMatch.length >= 2) {
            return `| ${splitMatch[0].trim()} | **${splitMatch[1].trim()}** |`;
          }
          return `| ${cleanLine} | |`;
        });
        if (rows.length === 0) return match;
        return `## Códigos para Pedido (SKU)\n\n| Modelo / Medidas | Código SKU |\n|---|---|\n${rows.join('\n')}\n\n`;
      }
    );

    return formatted;
  };

  const markdownComponents = {
    h1: ({node, ...props}) => <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 border-b border-zinc-100 pb-6 mb-8" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-sm font-semibold text-zinc-500 mt-10 mb-4 uppercase tracking-widest" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-base font-semibold text-zinc-800 mt-6 mb-3" {...props} />,
    p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-zinc-600 font-light" {...props} />,
    strong: ({node, ...props}) => <strong className="font-semibold text-zinc-900" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-8 text-zinc-600 font-light marker:text-zinc-300" {...props} />,
    li: ({node, ...props}) => <li className="pl-1" {...props} />,
    table: ({node, ...props}) => (
      <div className="overflow-x-auto my-8 border border-zinc-200 rounded-lg">
        <table className="min-w-full text-sm text-left bg-white" {...props} />
      </div>
    ),
    thead: ({node, ...props}) => <thead className="bg-zinc-50 border-b border-zinc-200" {...props} />,
    th: ({node, ...props}) => <th className="p-4 font-medium text-[11px] uppercase text-zinc-500 tracking-wider" {...props} />,
    td: ({node, ...props}) => <td className="p-4 border-b border-zinc-100 text-zinc-600 font-light" {...props} />,
    tr: ({node, ...props}) => <tr className="even:bg-zinc-50/30 hover:bg-zinc-50 transition-colors" {...props} />,
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-zinc-900 overflow-hidden selection:bg-zinc-200">
      
      {/* BARRA DE ACOMPANHAMENTO */}
      <div className="bg-zinc-50 text-zinc-500 text-[10px] sm:text-xs py-2 px-6 flex justify-between items-center border-b border-zinc-100">
        <div className="flex items-center gap-2">
          {syncStatus === "online" && <><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span>Sistema Operante</span></>}
          {syncStatus === "syncing" && <><Loader2 size={12} className="animate-spin" /><span>Baixando nuvem...</span></>}
          {syncStatus === "error" && <><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /><span>Erro Local (Verifique Terminal)</span></>}
        </div>
        <button onClick={syncCatalog} disabled={syncStatus === "syncing"} className="flex items-center gap-1.5 hover:text-zinc-800 transition-colors">
          <RefreshCw size={12} className={syncStatus === "syncing" ? "animate-spin" : ""}/> 
          <span className="font-medium uppercase tracking-widest">Sincronizar Notion</span>
        </button>
      </div>

      <header className="px-6 py-5 bg-white border-b border-zinc-100 flex justify-between items-center z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setStep("search"); setResults([]); setQuery(""); setSugestao(null); }}>
          <Flame className="text-zinc-900 w-5 h-5" strokeWidth={2.5} />
          <h1 className="font-semibold text-sm sm:text-base tracking-tight text-zinc-900">Casa das Resistências</h1>
        </div>
        {step !== "search" && (
          <button onClick={() => { setStep("search"); setResults([]); setQuery(""); setSugestao(null); }} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-2">
            <Search size={14}/> Buscar
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:p-12">
        <div className="max-w-3xl mx-auto">
          {step === "search" && (
            <div className="py-12 space-y-10 animate-in fade-in duration-700">
              <div className="text-center space-y-4">
                <Factory size={32} className="text-zinc-300 mx-auto" strokeWidth={1.5} />
                <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight">Catálogo Técnico</h2>
                <p className="text-zinc-500 text-sm font-light">Pesquise por modelo, aplicação ou característica técnica.</p>
              </div>
              
              <div className="max-w-2xl mx-auto">
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="relative">
                  <input 
                    value={query} 
                    onChange={e => {
                      const val = e.target.value;
                      setQuery(val);
                      verificarSugestao(val);
                    }}
                    className="w-full bg-white border border-zinc-200 p-5 rounded-2xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-50 transition-all text-base font-light pr-16 placeholder:text-zinc-400"
                    placeholder="Ex: Cartucho, Zamac, FZ-C..."
                  />
                  <button type="submit" className="absolute right-2 top-2 bottom-2 bg-zinc-900 text-white px-4 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center">
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} strokeWidth={2.5}/>}
                  </button>
                </form>

                {/* UI DO "VOCÊ QUIS DIZER?" */}
                {sugestao && (
                  <div className="mt-3 px-5 flex items-center gap-2 text-sm text-zinc-500 animate-in fade-in slide-in-from-top-1">
                    <Info size={14} className="text-orange-400" />
                    <span>Você quis dizer: </span>
                    <button 
                      onClick={() => {
                        setQuery(sugestao);
                        handleSearch(sugestao);
                      }}
                      className="text-zinc-900 font-semibold underline decoration-zinc-300 hover:decoration-zinc-900 transition-all"
                    >
                      {sugestao}?
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto mt-6">
  {results.map((prod) => (
    <button 
      key={prod.id} 
      onClick={() => viewProduct(prod)} 
      className="flex items-center justify-between p-5 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-400 hover:shadow-sm transition-all group text-left"
    >
      <div className="space-y-1 pr-4">
        <div className="flex items-center gap-2">
           <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">{prod.id}</span>
           <span className="text-zinc-300 text-[10px]">•</span>
           <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-widest">{prod.linha}</span>
        </div>
        <h3 className="font-semibold text-zinc-900 text-lg group-hover:text-zinc-700 transition-colors">
          {prod.nome}
        </h3>
        {/* BREVE DESCRITIVO ADICIONADO AQUI */}
        <p className="text-zinc-500 text-xs font-light line-clamp-2 leading-relaxed">
          {prod.descricaoCurta}
        </p>
      </div>
      <ArrowRight className="text-zinc-300 group-hover:text-zinc-800 group-hover:translate-x-1 transition-all shrink-0" size={20} />
    </button>
  ))}
</div>
            </div>
          )}

          {step === "product" && selectedProduct && (
            <div className="pb-24 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white px-6 sm:px-12 py-10 rounded-3xl border border-zinc-200">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">Ficha de Especificação</span>
                <div className="w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {formatMarkdownText(selectedProduct.texto)}
                  </ReactMarkdown>
                </div>
                <div className="mt-16 pt-8 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <h3 className="font-semibold text-zinc-900 text-lg">Projeto e Orçamento</h3>
                    <p className="text-sm text-zinc-500 font-light mt-1">Configure esta peça com nossos engenheiros.</p>
                  </div>
                  <button onClick={startCommercialChat} className="w-full sm:w-auto bg-zinc-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-3">
                    Iniciar Atendimento <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "chat" && (
            <div className="space-y-6 pb-32 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-center mb-8">
                <span className="bg-zinc-50 text-zinc-500 text-[10px] font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest border border-zinc-200">
                  Ref: {selectedProduct?.id}
                </span>
              </div>
              {messages.map((m, i) => {
                let clean = m.content;
                let opts = [];
                if (m.role === "assistant") {
                  const match = m.content.match(/\[OPCOES:\s*(.+?)\]/);
                  if (match) {
                    clean = m.content.replace(match[0], '').trim();
                    opts = match[1].split(',').map(o => o.trim());
                  }
                }
                const isLast = m.role === "assistant" && i === messages.length - 1;
                return (
                  <div key={i} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`p-5 max-w-[90%] sm:max-w-[80%] leading-relaxed text-sm ${m.role === "user" ? "bg-zinc-900 text-white rounded-2xl rounded-tr-sm font-light" : "bg-white border border-zinc-200 rounded-2xl rounded-tl-sm text-zinc-700"}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{...markdownComponents, p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />}}>
                        {clean}
                      </ReactMarkdown>
                    </div>
                    {opts.length > 0 && isLast && !isLoading && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {opts.map((o, idx) => (
                          <button key={idx} onClick={() => processMessage(o)} className="px-4 py-2 text-[11px] font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:border-zinc-400 hover:text-zinc-900 transition-colors">
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start items-center gap-3 p-4">
                  <Loader2 className="animate-spin text-zinc-400" size={20} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {step === "chat" && (
        <footer className="p-4 sm:p-6 bg-white border-t border-zinc-100 fixed bottom-0 w-full z-20">
          <form onSubmit={(e) => { e.preventDefault(); processMessage(input); }} className="max-w-3xl mx-auto flex gap-2 relative">
            <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-white px-5 py-4 rounded-xl outline-none text-sm font-light border border-zinc-200 focus:border-zinc-400 transition-all placeholder:text-zinc-400" placeholder="Digite sua mensagem..." disabled={isLoading}/>
            <button type="submit" disabled={isLoading || !input.trim()} className="bg-zinc-900 text-white px-6 rounded-xl hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center">
              <Send size={18}/>
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}