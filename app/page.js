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

  // --- NAVEGAÇÃO ---
  const handleSearch = async (termoManual) => {
    const termoFinal = (termoManual || query).trim();
    if (!termoFinal) return;
    setResults([]); 
    setIsLoading(true);
    setStep("search"); 
    try {
      const res = await fetch("/api/search", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: termoFinal }),
      });
      const data = await res.json();
      setResults(data.resultados || []);
      setQuery(termoFinal);
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  };

  const viewProduct = (product) => {
    setSelectedProduct(product);
    setStep("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToProductById = async (id) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/search", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: id.trim() }),
      });
      const data = await res.json();
      const match = data.resultados.find(p => p.id.toUpperCase() === id.trim().toUpperCase());
      if (match) viewProduct(match);
      else if (data.resultados.length > 0) viewProduct(data.resultados[0]);
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
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
    } catch (e) { setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão." }]); } 
    finally { setIsLoading(false); }
  };

  // --- O TRANSFORMADOR (VERSÃO BLINDADA CONTRA NEGRITOS E ESPAÇOS) ---
  const formatMarkdownText = (text, productName = "") => {
    if (!text) return "";
    let formatted = text;

    // Normalização inicial para remover espaços invisíveis do Notion
    formatted = formatted.replace(/\u00A0/g, ' '); 

    const isLinhaGeral = productName.toLowerCase().includes("linha geral");

    // 1. Corrige títulos ##
    formatted = formatted.replace(/^(#{1,6})([^#\s])/gm, '$1 $2');

    // 2. 🛠️ LIMPEZA E CRIAÇÃO DE BOTÕES DE CATEGORIA/LINHA
    // Remove negritos das chaves e captura os valores
    formatted = formatted.replace(/(?:\*\*|)?Categoria:(?:\*\*|)?\s*([^*|\n\r]+)/gi, (match, val) => {
      return `\n\n@@INFO_CATEGORIA:${val.trim()}@@\n\n`;
    });

    formatted = formatted.replace(/(?:\|?\s*(?:\*\*|)?Linha:(?:\*\*|)?)\s*([^*|\n\r]+)/gi, (match, val) => {
      const cleanVal = val.trim();
      if (isLinhaGeral) return ""; // Não mostra botão de linha se já estiver nela
      return `\n\n@@FILTRO_LINHA:${cleanVal}@@\n\n`;
    });

    // 3. Modelos Disponíveis
    formatted = formatted.replace(
      /MODELOS DISPONÍVEIS\n([\s\S]*?)(?=\n##|$)/gi,
      (match, content) => {
        const lines = content.split('\n').filter(l => l.includes(':'));
        const buttons = lines.map(line => {
          const parts = line.replace(/^- /, '').split(':');
          const id = parts[0].trim();
          const desc = parts[1]?.trim() || "";
          return `\n\n@@BOTÃO_MODELO:${id}:${desc}@@\n\n`;
        }).join('');
        return `\n## Modelos Disponíveis\n${buttons}`;
      }
    );

    // 4. Tabelas Técnicas
    formatted = formatted.replace(
      /## Especificações Técnicas\n([\s\S]*?)(?=\n##|$)/g,
      (match, content) => {
        let cleanedContent = content.replace(/\.\s?\*\*/g, '.\n- **'); 
        if (!cleanedContent.trim().startsWith('-')) cleanedContent = '- ' + cleanedContent;
        const rows = cleanedContent.split('\n').filter(line => line.includes('**')).map(line => {
          const cleanLine = line.replace(/^- /, '').trim();
          const splitMatch = cleanLine.match(/^\*\*(.*?)\*\*(.*)$/);
          if (splitMatch) return `| **${splitMatch[1].trim()}** | ${splitMatch[2].trim()} |`;
          return `| ${cleanLine} | |`;
        });
        return `\n## Especificações Técnicas\n\n| Característica | Detalhe |\n|---|---|\n${rows.join('\n')}\n\n`;
      }
    );

    return formatted;
  };

  // --- COMPONENTES ---
  const markdownComponents = {
    h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-zinc-900 border-b pb-4 mb-6" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-xs font-bold text-zinc-400 mt-10 mb-4 uppercase tracking-[0.2em]" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-base font-bold text-zinc-800 mt-6 mb-3" {...props} />,
    p: ({node, children, ...props}) => {
      // Função para extrair texto de dentro de possíveis tags strong/em
      const flatten = (parts) => {
        return parts.map(part => {
          if (typeof part === 'string') return part;
          if (part.props && part.props.children) return flatten(Array.isArray(part.props.children) ? part.props.children : [part.props.children]);
          return '';
        }).join('');
      };

      const contentString = Array.isArray(children) ? flatten(children) : (typeof children === 'string' ? children : '');

      // RENDER: CATEGORIA
      if (contentString.includes('@@INFO_CATEGORIA:')) {
        const valor = contentString.replace(/@@INFO_CATEGORIA:|@@/g, '').trim();
        return (
          <div className="flex items-center gap-2 mb-2">
            <Tag size={12} className="text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Setor: {valor}</span>
          </div>
        );
      }

      // RENDER: LINHA (Botão de Retorno para Família)
      if (contentString.includes('@@FILTRO_LINHA:')) {
        const valor = contentString.replace(/@@FILTRO_LINHA:|@@/g, '').trim();
        return (
          <div className="flex items-center gap-4 mb-8 bg-zinc-900 p-4 rounded-2xl shadow-xl shadow-zinc-200 group cursor-pointer hover:bg-zinc-800 transition-all" onClick={() => handleSearch(valor)}>
            <div className="bg-white/10 text-white p-2.5 rounded-xl"><Layers size={18} /></div>
            <div className="flex flex-col flex-1">
              <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">Voltar para a Linha</span>
              <span className="text-sm font-bold text-white uppercase">{valor}</span>
            </div>
            <ArrowRight size={18} className="text-zinc-500 group-hover:text-white transition-colors" />
          </div>
        );
      }

      // RENDER: BOTÃO DE MODELO
      if (contentString.includes('@@BOTÃO_MODELO:')) {
        const parts = contentString.replace(/@@/g, '').split(':');
        const id = parts[1]?.trim();
        const desc = parts[2]?.trim();
        if (!id) return null;
        return (
          <button 
            type="button"
            key={id}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToProductById(id); }}
            className="w-full flex items-center justify-between p-5 mb-3 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-900 transition-all group text-left shadow-sm"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Ficha Técnica</span>
              <span className="text-sm font-bold text-zinc-800 uppercase">{id} - {desc}</span>
            </div>
            <div className="bg-zinc-50 p-2 rounded-xl group-hover:bg-zinc-900 group-hover:text-white transition-colors"><ArrowRight size={20} /></div>
          </button>
        );
      }
      return <p className="mb-4 leading-relaxed text-zinc-600 font-light" {...props}>{children}</p>;
    },
    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-8 text-zinc-600 font-light" {...props} />,
    table: ({node, ...props}) => (
      <div className="overflow-x-auto my-6 border border-zinc-200 rounded-xl">
        <table className="min-w-full text-sm text-left bg-white border-collapse" {...props} />
      </div>
    ),
    th: ({node, ...props}) => <th className="p-4 bg-zinc-50 font-bold text-[10px] uppercase text-zinc-400 border-b border-zinc-200" {...props} />,
    td: ({node, ...props}) => <td className="p-4 border-b border-zinc-100 text-zinc-600 font-light" {...props} />,
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-zinc-900 overflow-hidden">
      
      <div className="bg-zinc-50 text-zinc-500 text-[10px] py-2 px-6 flex justify-between items-center border-b border-zinc-100">
        <div className="flex items-center gap-2 font-medium uppercase tracking-widest">
          <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-zinc-300"}`} />
          <span>Sistema Operante</span>
        </div>
        <button onClick={syncCatalog} disabled={syncStatus === "syncing"} className="flex items-center gap-1.5 hover:text-zinc-800 uppercase tracking-widest">
          <RefreshCw size={12} className={syncStatus === "syncing" ? "animate-spin" : ""}/> 
          Sincronizar Notion
        </button>
      </div>

      <header className="px-6 py-5 bg-white border-b border-zinc-100 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setStep("search"); setResults([]); setQuery("");}}>
          <Flame className="text-zinc-900 w-5 h-5" strokeWidth={2.5} />
          <h1 className="font-bold text-xs tracking-widest uppercase">Casa das Resistências</h1>
        </div>
        {step !== "search" && (
           <button onClick={() => setStep("search")} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 text-[10px] font-bold uppercase tracking-widest">
             <ChevronLeft size={14} /> Voltar
           </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-12">
        <div className="max-w-3xl mx-auto">
          
          {step === "search" && (
            <div className="py-8 space-y-10 animate-in fade-in">
              <div className="text-center space-y-4">
                <Factory size={32} className="text-zinc-200 mx-auto" />
                <h2 className="text-3xl font-bold text-zinc-900 tracking-tighter uppercase text-center">Catálogo Técnico</h2>
                <p className="text-zinc-400 text-sm font-light italic text-center">Engenharia de Aquecimento Industrial</p>
              </div>
              
              <div className="max-w-2xl mx-auto relative">
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                  <input value={query} onChange={e => { setQuery(e.target.value); }} className="w-full bg-white border border-zinc-200 p-5 rounded-2xl outline-none focus:border-zinc-900 transition-all font-light shadow-sm" placeholder="Busque por modelo ou aplicação..." />
                  <button type="submit" className="absolute right-3 top-3 bottom-3 bg-zinc-900 text-white px-5 rounded-xl">
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
                {results.map((prod) => (
                  <button key={prod.id} onClick={() => viewProduct(prod)} className="flex items-center justify-between p-6 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-900 hover:shadow-lg transition-all text-left group">
                    <div className="space-y-2">
                      <div className="flex gap-2 text-[9px] font-bold uppercase tracking-tighter text-zinc-400">
                        <span>{prod.id}</span> <span>•</span> <span>{prod.linha}</span>
                      </div>
                      <h3 className="font-bold text-zinc-900 text-lg leading-tight uppercase group-hover:text-zinc-700">{prod.nome}</h3>
                      <p className="text-zinc-500 text-xs font-light line-clamp-3 leading-relaxed max-w-md">{prod.descricaoCurta}</p>
                    </div>
                    <ArrowRight className="text-zinc-200 group-hover:text-zinc-900 transition-all group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "product" && selectedProduct && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-zinc-200 shadow-sm relative overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-zinc-900" size={32} />
                  </div>
                )}
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {formatMarkdownText(selectedProduct.texto, selectedProduct.nome)}
                </ReactMarkdown>
                
                <div className="mt-12 pt-10 border-t border-zinc-100 flex flex-col sm:flex-row gap-6 items-center justify-between">
                  <div className="text-center sm:text-left">
                    <h4 className="font-bold text-zinc-900 uppercase">Configurar Projeto</h4>
                    <p className="text-sm text-zinc-400 font-light mt-1">Coleta técnica de medidas e potência.</p>
                  </div>
                  <button onClick={() => { setStep("chat"); setMessages([{ role: "assistant", content: `Olá! Sou o consultor técnico. Para orçarmos a **${selectedProduct.nome}**, qual a aplicação e a temperatura de operação desejada? [OPCOES: Uso Industrial, Máquina Injetora, Enviar Desenho]` }]); }} className="w-full sm:w-auto bg-zinc-900 text-white px-10 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200">
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
                    <div className={`p-5 max-w-[85%] rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-zinc-900 text-white shadow-xl shadow-zinc-100" : "bg-white border border-zinc-200 shadow-sm text-zinc-800"}`}>
                       <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{clean}</ReactMarkdown>
                    </div>
                    {opts.length > 0 && isLast && !isLoading && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {opts.map((o, idx) => (
                          <button key={idx} onClick={() => processMessage(o)} className={`px-4 py-3 rounded-xl text-xs font-bold transition-all ${o.toLowerCase().includes("desenho") || o.toLowerCase().includes("amostra") ? "bg-zinc-100 text-zinc-900 border-2 border-zinc-900 hover:bg-zinc-200" : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"}`}>
                            {o.toLowerCase().includes("desenho") && <FileText size={14} className="inline mr-2" />}
                            {o.toLowerCase().includes("amostra") && <Beaker size={14} className="inline mr-2" />}
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
        <footer className="fixed bottom-0 w-full p-6 bg-white/90 backdrop-blur-md border-t border-zinc-100">
          <form onSubmit={e => { e.preventDefault(); processMessage(input); }} className="max-w-3xl mx-auto flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Digite sua mensagem..." className="flex-1 bg-white border border-zinc-200 p-4 rounded-2xl outline-none focus:border-zinc-900 transition-all text-sm font-light" />
            <button type="submit" disabled={isLoading || !input.trim()} className="bg-zinc-900 text-white px-6 rounded-2xl hover:bg-zinc-800 transition-all"><Send size={18} /></button>
          </form>
        </footer>
      )}
    </div>
  );
}