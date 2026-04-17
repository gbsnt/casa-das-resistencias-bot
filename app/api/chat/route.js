"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Flame, Loader2, Search, ArrowRight, RefreshCw, Factory, Info, FileText, Beaker, ChevronLeft, LayoutGrid } from "lucide-react";
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
  const messagesEndRef = useRef(null);

  const termosTecnicos = [
    "Fundida Zamac", "Cartucho", "Cartucho Fendilhado", "Coleira Mica", 
    "Coleira Cerâmica", "Imersão Sobre Borda", "Infravermelho", 
    "Termostato Capilar", "Fibra Cerâmica", "Tubular Aletada", 
    "Aquecedor de Passagem", "Microtubular", "Manta de Silicone"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const verificarSugestao = (termo) => {
    if (!termo || termo.length < 3) {
      setSugestao(null);
      return;
    }
    const res = fuzzysort.go(termo, termosTecnicos, { threshold: -10000, limit: 1 });
    if (res.length > 0 && res[0].score > -100) {
      if (res[0].score > -5) setSugestao(null);
      else setSugestao(res[0].target);
    } else setSugestao(null);
  };

  // 🛠️ FUNÇÃO DE NAVEGAÇÃO CORRIGIDA
  const goToProductById = async (id) => {
    setIsLoading(true);
    try {
      // Forçamos a busca pelo ID exato
      const res = await fetch("/api/search", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: id }),
      });
      const data = await res.json();
      
      // Filtramos para garantir que pegamos o ID exato (ex: T-R e não T-R-2)
      const match = data.resultados.find(p => p.id.toLowerCase() === id.toLowerCase());
      
      if (match) {
        setSelectedProduct(match);
        setStep("product");
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(`Modelo ${id} não localizado. Sincronize o Notion e tente novamente.`);
      }
    } catch (e) {
      console.error("Erro na navegação interna");
    } finally {
      setIsLoading(false);
    }
  };

  const syncCatalog = async () => {
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      if (data.success) setSyncStatus("online");
      else setSyncStatus("error");
    } catch (e) { setSyncStatus("error"); }
  };

  const handleSearch = async (termoManual) => {
    const termoFinal = termoManual || query;
    if (!termoFinal.trim()) return;
    setResults([]); 
    setIsLoading(true);
    setSugestao(null);
    try {
      const res = await fetch("/api/search", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: termoFinal }),
      });
      const data = await res.json();
      setResults(data.resultados || []);
    } catch (e) { console.error("Erro busca"); } 
    finally { setIsLoading(false); }
  };

  const viewProduct = (product) => {
    setSelectedProduct(product);
    setStep("product");
  };

  const startCommercialChat = () => {
    setStep("chat");
    setMessages([{
      role: "assistant",
      content: `Olá! Sou o assistente técnico. Para orçarmos a **${selectedProduct.nome}**, qual a aplicação e a temperatura de operação? [OPCOES: Uso Industrial, Máquina Injetora, Enviar Desenho]`
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
        headers: { "Content-Type": "application/json" },
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

    // 1. FORMATAÇÃO DE TABELAS TÉCNICAS
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
        return rows.length > 0 ? `## Especificações Técnicas\n\n| Característica | Detalhe |\n|---|---|\n${rows.join('\n')}\n\n` : match;
      }
    );

    // 2. CONVERSÃO DE MODELOS EM LINKS ESPECIAIS (Evita que fiquem um ao lado do outro)
    formatted = formatted.replace(
      /MODELOS DISPONÍVEIS\n([\s\S]*?)(?=\n##|$)/gi,
      (match, content) => {
        const links = content.split('\n').filter(line => line.includes(':')).map(line => {
          const parts = line.replace(/^- /, '').split(':');
          const id = parts[0].trim();
          const desc = parts[1]?.trim() || "";
          // Usamos uma sintaxe que o renderizador vai capturar como bloco
          return `\n\n[LINK_MODELO:${id}:${desc}]\n\n`;
        });
        return links.length > 0 ? `## Modelos de Linha\n${links.join('')}` : match;
      }
    );

    return formatted;
  };

  const markdownComponents = {
    h1: ({node, ...props}) => <h1 className="text-2xl font-semibold text-zinc-900 border-b border-zinc-100 pb-6 mb-8" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-sm font-semibold text-zinc-400 mt-10 mb-4 uppercase tracking-widest" {...props} />,
    p: ({node, children, ...props}) => {
      // Verificamos se o parágrafo contém nosso link especial de modelo
      const content = children?.[0];
      if (typeof content === 'string' && content.startsWith('[LINK_MODELO:')) {
        const parts = content.replace('[', '').replace(']', '').split(':');
        const id = parts[1];
        const desc = parts[2];
        return (
          <button 
            onClick={() => goToProductById(id)}
            className="w-full flex items-center justify-between p-4 mb-3 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-900 hover:shadow-md transition-all group text-left"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Modelo {id}</span>
              <span className="text-sm font-semibold text-zinc-800 group-hover:text-zinc-900">{desc}</span>
            </div>
            <div className="bg-zinc-100 p-2 rounded-xl group-hover:bg-zinc-900 group-hover:text-white transition-colors">
              <ArrowRight size={16} />
            </div>
          </button>
        );
      }
      return <p className="mb-4 leading-relaxed text-zinc-600 font-light" {...props}>{children}</p>;
    },
    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-8 text-zinc-600 font-light marker:text-zinc-300" {...props} />,
    li: ({node, ...props}) => <li className="pl-1" {...props} />,
    table: ({node, ...props}) => (
      <div className="overflow-x-auto my-6 border border-zinc-200 rounded-xl shadow-sm">
        <table className="min-w-full text-sm text-left bg-white" {...props} />
      </div>
    ),
    th: ({node, ...props}) => <th className="p-4 bg-zinc-50 font-bold text-[10px] uppercase text-zinc-500 tracking-wider border-b border-zinc-200" {...props} />,
    td: ({node, ...props}) => <td className="p-4 border-b border-zinc-50 text-zinc-600 font-light" {...props} />,
    tr: ({node, ...props}) => <tr className="hover:bg-zinc-50/50 transition-colors" {...props} />,
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-zinc-900 overflow-hidden">
      
      {/* STATUS BAR */}
      <div className="bg-zinc-50 text-zinc-500 text-[10px] py-2 px-6 flex justify-between items-center border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-zinc-300"}`} />
          <span className="uppercase tracking-widest font-medium">Sistema Operante</span>
        </div>
        <button onClick={syncCatalog} disabled={syncStatus === "syncing"} className="flex items-center gap-1.5 hover:text-zinc-800 transition-colors">
          <RefreshCw size={12} className={syncStatus === "syncing" ? "animate-spin" : ""}/> 
          <span className="font-medium uppercase tracking-widest">Sincronizar Notion</span>
        </button>
      </div>

      <header className="px-6 py-5 bg-white border-b border-zinc-100 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setStep("search"); setResults([]); setQuery("");}}>
          <Flame className="text-zinc-900 w-5 h-5" />
          <h1 className="font-semibold text-xs tracking-widest uppercase">Casa das Resistências</h1>
        </div>
        {step !== "search" && (
           <button onClick={() => setStep("search")} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-widest">
             <ChevronLeft size={14} /> Voltar
           </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          
          {step === "search" && (
            <div className="py-8 space-y-10 animate-in fade-in">
              <div className="text-center space-y-4">
                <LayoutGrid size={32} className="text-zinc-300 mx-auto" />
                <h2 className="text-3xl font-semibold text-zinc-900 tracking-tighter uppercase">Catálogo Técnico</h2>
                <p className="text-zinc-500 text-sm font-light italic">Engenharia de Aquecimento Industrial</p>
              </div>
              
              <div className="max-w-2xl mx-auto relative">
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                  <input 
                    value={query} 
                    onChange={e => { setQuery(e.target.value); verificarSugestao(e.target.value); }}
                    className="w-full bg-white border border-zinc-200 p-5 rounded-2xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-50 transition-all font-light"
                    placeholder="Busque por modelo ou aplicação..."
                  />
                  <button type="submit" className="absolute right-3 top-3 bottom-3 bg-zinc-900 text-white px-5 rounded-xl">
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </form>

                {sugestao && (
                  <div className="mt-3 px-5 flex items-center gap-2 text-xs text-zinc-500 animate-in fade-in">
                    <Info size={12} className="text-orange-400" />
                    <span>Sugestão: </span>
                    <button onClick={() => { setQuery(sugestao); handleSearch(sugestao); }} className="text-zinc-900 font-bold underline">
                      {sugestao}?
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
                {results.map((prod) => (
                  <button key={prod.id} onClick={() => viewProduct(prod)} className="flex items-center justify-between p-6 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-400 hover:shadow-md transition-all text-left group">
                    <div className="space-y-2">
                      <div className="flex gap-2 text-[9px] font-bold uppercase tracking-tighter text-zinc-400">
                        <span>{prod.id}</span> <span>•</span> <span>{prod.linha}</span>
                      </div>
                      <h3 className="font-semibold text-zinc-900 text-lg leading-tight group-hover:text-zinc-700">{prod.nome}</h3>
                      <p className="text-zinc-500 text-xs font-light line-clamp-3 leading-relaxed max-w-md">
                        {prod.descricaoCurta}
                      </p>
                    </div>
                    <ArrowRight className="text-zinc-200 group-hover:text-zinc-900 transition-all group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "product" && (
            <div className="animate-in slide-in-from-bottom-4">
              <div className="bg-white p-8 sm:p-12 rounded-3xl border border-zinc-200 shadow-sm relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
                    <Loader2 className="animate-spin text-zinc-900" size={32} />
                  </div>
                )}
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {formatMarkdownText(selectedProduct.texto)}
                </ReactMarkdown>
                
                <div className="mt-12 pt-8 border-t border-zinc-100 flex flex-col sm:flex-row gap-6 items-center justify-between">
                  <div className="text-center sm:text-left">
                    <h4 className="font-bold text-zinc-900">Precisa de um orçamento?</h4>
                    <p className="text-sm text-zinc-500 font-light">Nossa IA coletará os dados técnicos do seu projeto.</p>
                  </div>
                  <button onClick={startCommercialChat} className="w-full sm:w-auto bg-zinc-900 text-white px-10 py-4 rounded-2xl font-semibold flex items-center gap-3 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200">
                    Iniciar Atendimento <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "chat" && (
            <div className="space-y-6 pb-40">
              {messages.map((m, i) => {
                let clean = m.content;
                let opts = [];
                const match = m.content.match(/\[OPCOES:\s*(.+?)\]/);
                if (match) {
                  clean = m.content.replace(match[0], '').trim();
                  opts = match[1].split(',').map(o => o.trim());
                }
                const isLast = i === messages.length - 1;
                return (
                  <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start animate-in slide-in-from-left-2"}`}>
                    <div className={`p-5 max-w-[85%] rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800 border border-zinc-200"}`}>
                       <ReactMarkdown>{clean}</ReactMarkdown>
                    </div>
                    {opts.length > 0 && isLast && !isLoading && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {opts.map((o, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => processMessage(o)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                              o.toLowerCase().includes("desenho") || o.toLowerCase().includes("amostra")
                              ? "bg-zinc-100 text-zinc-900 border-2 border-zinc-900 hover:bg-zinc-200" 
                              : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400"
                            }`}
                          >
                            {o.toLowerCase().includes("desenho") && <FileText size={14} />}
                            {o.toLowerCase().includes("amostra") && <Beaker size={14} />}
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && <Loader2 className="animate-spin text-zinc-300 mx-auto mt-4" />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {step === "chat" && (
        <footer className="fixed bottom-0 w-full p-6 bg-white/80 backdrop-blur-md border-t border-zinc-100">
          <form onSubmit={e => { e.preventDefault(); processMessage(input); }} className="max-w-3xl mx-auto flex gap-3">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              placeholder="Descreva as medidas ou sua dúvida..."
              className="flex-1 bg-white border border-zinc-200 p-4 rounded-2xl outline-none focus:border-zinc-900 transition-all text-sm font-light"
            />
            <button type="submit" className="bg-zinc-900 text-white px-6 rounded-2xl hover:bg-zinc-800 transition-all">
              <Send size={18} />
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}