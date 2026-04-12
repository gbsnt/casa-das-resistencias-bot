'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erro de conexão.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="background">
      <div className="container">
        <header className="header">
          <div className="logoArea">
            <div className="statusDot"></div>
            <div>
              <h1 className="title">Casa das Resistências</h1>
              <span className="subtitle">Suporte Técnico Especializado</span>
            </div>
          </div>
        </header>

        <div className="settingsBar">
          <div className="selectors">
            <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="Português">🇧🇷 PT</option>
              <option value="English">🇺🇸 EN</option>
              <option value="Español">🇪🇸 ES</option>
            </select>
            
            <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="groq">🦙 Llama 3</option>
              <option value="gemini">✨ Gemini</option>
            </select>
          </div>
          {modelUsado && <span className="modelBadge">IA: <strong>{modelUsado}</strong></span>}
        </div>

        <main className="chatWindow">
          {messages.length === 0 && (
            <div className="emptyState">
              <h2>Como posso ajudar?</h2>
              <p>Descreva sua máquina ou aplicação técnica.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'userRow' : 'aiRow'}>
              <div className={m.role === 'user' ? 'userBubble' : 'aiBubble'}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="aiRow">
              <div className="loadingBubble pulse">Processando catálogo...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <form onSubmit={sendMessage} className="inputArea">
          <input
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Dúvida técnica..."
            disabled={loading}
          />
          <button className={loading ? 'btnOff' : 'btnOn'} type="submit" disabled={loading}>
            {loading ? '⏳' : 'Enviar'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .background {
          background-color: #eef2f6;
          min-height: 100dvh; /* dvh evita bugs de altura no Chrome mobile */
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: sans-serif;
        }
        .container {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          width: 100%;
          max-width: 800px;
          background: white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .header {
          background: #0a2540;
          color: white;
          padding: 15px 20px;
          border-bottom: 4px solid #ff6600;
        }
        .title { font-size: 18px; margin: 0; }
        .subtitle { font-size: 11px; color: #a1b0cb; }
        .statusDot { width: 10px; height: 10px; background: #2ecc71; border-radius: 50%; }
        .logoArea { display: flex; align-items: center; gap: 12px; }

        .settingsBar {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          padding: 10px 20px;
          background: #f8f9fa;
          gap: 10px;
          border-bottom: 1px solid #eee;
        }
        .selectors { display: flex; gap: 8px; }
        .select { padding: 6px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; }
        .modelBadge { font-size: 11px; color: #666; align-self: center; }

        .chatWindow {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          background: #fcfcfc;
        }
        .userRow { align-self: flex-end; max-width: 85%; }
        .aiRow { align-self: flex-start; max-width: 90%; }
        
        .userBubble {
          background: #ff6600;
          color: white;
          padding: 12px 16px;
          border-radius: 18px 18px 2px 18px;
          font-size: 14px;
        }
        .aiBubble {
          background: white;
          border: 1px solid #e5e7eb;
          padding: 12px 16px;
          border-radius: 18px 18px 18px 2px;
          font-size: 14px;
          line-height: 1.5;
        }

        .inputArea {
          padding: 15px;
          display: flex;
          gap: 10px;
          border-top: 1px solid #eee;
        }
        .input {
          flex: 1;
          padding: 12px 15px;
          border-radius: 10px;
          border: 1px solid #ddd;
          font-size: 14px;
          outline: none;
        }
        .btnOn {
          background: #0a2540;
          color: white;
          border: none;
          padding: 0 20px;
          border-radius: 10px;
          font-weight: bold;
        }

        @media (max-width: 600px) {
          .container { height: 100dvh; border-radius: 0; }
          .header { padding: 10px 15px; }
          .title { font-size: 16px; }
          .chatWindow { padding: 15px; }
          .settingsBar { padding: 8px 15px; }
          .inputArea { padding: 10px; }
          .userBubble, .aiBubble { font-size: 13.5px; padding: 10px 14px; }
          .btnOn { padding: 0 15px; }
          .modelBadge { width: 100%; text-align: center; order: 3; }
        }

        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .pulse { animation: pulse 1.5s infinite; }
      `}</style>
    </div>
  );
}