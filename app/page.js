'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Nossos seletores de Idioma e IA
  const [language, setLanguage] = useState('Português');
  const [provider, setProvider] = useState('groq'); 
  
  const [modelUsado, setModelUsado] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setModelUsado('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Agora enviamos o provider (IA escolhida) para o backend!
        body: JSON.stringify({ messages: [...messages, userMsg], language, provider }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + data.error }]);
      } else {
        setModelUsado(data.model_usado || '');
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erro de conexão com o servidor.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.background}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logoArea}>
            <div style={styles.statusDot}></div>
            <div>
              <h1 style={styles.title}>Casa das Resistências</h1>
              <span style={styles.subtitle}>Suporte Técnico Especializado</span>
            </div>
          </div>
        </header>

        <div style={styles.settingsBar}>
          <div style={styles.selectors}>
            <select style={styles.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="Português">🇧🇷 PT</option>
              <option value="English">🇺🇸 EN</option>
              <option value="Español">🇪🇸 ES</option>
            </select>
            
            <select style={styles.select} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="groq">🦙 Llama 3 (Rápido)</option>
              <option value="gemini">✨ Gemini 1.5 (Google)</option>
            </select>
          </div>

          {modelUsado && (
            <span style={styles.modelBadge}>Respondido por: <strong>{modelUsado}</strong></span>
          )}
        </div>

        <main style={styles.chatWindow}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <h2>Como posso ajudar?</h2>
              <p>Descreva sua máquina, temperatura ou aplicação e encontraremos a resistência ideal.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={m.role === 'user' ? styles.userRow : styles.aiRow}>
              <div style={m.role === 'user' ? styles.userBubble : styles.aiBubble}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div style={styles.aiRow}>
              <div style={styles.loadingBubble}>
                <span style={styles.pulse}>Processando catálogo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <form onSubmit={sendMessage} style={styles.inputArea}>
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ex: Qual resistência indico para injetora de plástico?"
            disabled={loading}
          />
          <button style={loading ? styles.btnOff : styles.btnOn} type="submit" disabled={loading}>
            {loading ? '⏳' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  background: {
    backgroundColor: '#eef2f6',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  container: { 
    display: 'flex', 
    flexDirection: 'column', 
    height: '90vh', 
    width: '100%',
    maxWidth: '800px', 
    backgroundColor: '#ffffff', 
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  header: { 
    backgroundColor: '#0a2540', // Azul super escuro industrial
    borderBottom: '4px solid #ff6600', // Detalhe laranja (aquecimento/resistência)
    color: 'white', 
    padding: '20px 30px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  logoArea: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '15px' 
  },
  statusDot: { 
    width: '12px', 
    height: '12px', 
    backgroundColor: '#2ecc71', 
    borderRadius: '50%', 
    boxShadow: '0 0 8px #2ecc71' 
  },
  title: { 
    fontSize: '20px', 
    margin: 0, 
    fontWeight: '700',
    letterSpacing: '-0.5px'
  },
  subtitle: { 
    fontSize: '12px', 
    color: '#a1b0cb' 
  },
  settingsBar: { 
    display: 'flex', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    padding: '12px 30px', 
    backgroundColor: '#f8f9fa', 
    borderBottom: '1px solid #edf2f7' 
  },
  selectors: {
    display: 'flex',
    gap: '10px'
  },
  select: { 
    padding: '8px 12px', 
    borderRadius: '8px', 
    border: '1px solid #d1d5db', 
    fontSize: '13px', 
    outline: 'none',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontWeight: '500',
    color: '#374151'
  },
  modelBadge: { 
    fontSize: '12px', 
    color: '#6b7280', 
  },
  chatWindow: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '30px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px',
    backgroundColor: '#fcfcfc'
  },
  emptyState: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  userRow: { 
    alignSelf: 'flex-end', 
    maxWidth: '75%' 
  },
  aiRow: { 
    alignSelf: 'flex-start', 
    maxWidth: '85%' 
  },
  userBubble: { 
    backgroundColor: '#ff6600', // Laranja Casa das Resistências
    color: 'white', 
    padding: '14px 20px', 
    borderRadius: '20px 20px 4px 20px', 
    fontSize: '15px', 
    boxShadow: '0 4px 12px rgba(255, 102, 0, 0.2)',
    lineHeight: '1.5'
  },
  aiBubble: { 
    backgroundColor: '#ffffff', 
    color: '#1f2937', 
    padding: '14px 20px', 
    borderRadius: '20px 20px 20px 4px', 
    fontSize: '15px', 
    border: '1px solid #e5e7eb', 
    lineHeight: '1.6', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
    whiteSpace: 'pre-wrap', 
    overflowWrap: 'break-word' 
  },
  loadingBubble: { 
    padding: '14px 20px',
    backgroundColor: '#f3f4f6',
    borderRadius: '20px 20px 20px 4px',
    fontSize: '14px', 
    color: '#6b7280', 
  },
  pulse: {
    animation: 'pulse 1.5s infinite',
  },
  inputArea: { 
    padding: '20px 30px', 
    backgroundColor: '#ffffff', 
    display: 'flex', 
    gap: '15px', 
    borderTop: '1px solid #edf2f7' 
  },
  input: { 
    flex: 1, 
    padding: '16px 24px', 
    borderRadius: '12px', 
    border: '1px solid #d1d5db', 
    outline: 'none', 
    fontSize: '15px', 
    transition: 'border-color 0.2s',
    backgroundColor: '#f9fafb',
    color: '#111827'
  },
  btnOn: { 
    backgroundColor: '#0a2540', 
    color: 'white', 
    border: 'none', 
    padding: '0 30px', 
    borderRadius: '12px', 
    cursor: 'pointer', 
    fontWeight: '600',
    fontSize: '15px',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 6px rgba(10, 37, 64, 0.2)'
  },
  btnOff: { 
    backgroundColor: '#e5e7eb', 
    color: '#9ca3af', 
    border: 'none', 
    padding: '0 30px', 
    borderRadius: '12px',
    fontWeight: '600'
  },
};