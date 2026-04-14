import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { buildSystemPrompt } from '@/lib/prompt'; 

export async function POST(req) {
  let respostaFinal = "";
  let tokenCount = 0;
  let contexto = "";

  try {
    const { messages, aiMode } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    const historicoCurto = messages.slice(-8); // Aumentei um pouco para manter o fio da meada

    // 1. BUSCA NO PINECONE
    try {
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
      const index = pc.index('catalogo-casa');
      const resIA = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: { 'Api-Key': process.env.PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'multilingual-e5-large', inputs: [{ text: ultimaPergunta }] })
      });
      const dataIA = await resIA.json();
      const vector = dataIA.data?.[0]?.values;
      const busca = await index.query({ vector, topK: 2, includeMetadata: true });
      contexto = busca.matches.map(m => m.metadata.text).join('\n---\n');
    } catch (e) { 
      console.log("⚠️ Erro Pinecone"); 
      contexto = "O catálogo está offline, responda com base no seu conhecimento geral de resistências.";
    }

    // 2. CONSTRUÇÃO DO PROMPT REFORÇADO
    const promptBase = buildSystemPrompt(contexto);
    const instrucaoBotoes = `\n\n[REGRA DE OURO]: Toda resposta técnica sua DEVE terminar com 2 ou 3 opções de botões para o usuário clicar, seguindo EXATAMENTE este formato: [OPCOES: Opção A, Opção B, Opção C].`;
    
    // Array de mensagens com "Lembrete de Final de Fila"
    const mensagensReforcadas = [
      { role: "system", content: promptBase + instrucaoBotoes },
      ...historicoCurto,
      { role: "system", content: "IMPORTANTE: Não esqueça de gerar os botões [OPCOES: ...] ao final da resposta." }
    ];

    // 🏠 MODO LOCAL (Ollama)
    if (aiMode === 'local') {
      try {
        console.log("🏠 Tentando Ollama Local...");
        const resLocal = await fetch('http://localhost:11434/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            model: 'llama3.1:8b', 
            messages: mensagensReforcadas,
            temperature: 0.2 
          })
        });
        if (resLocal.ok) {
          const data = await resLocal.json();
          return NextResponse.json({ content: data.choices[0].message.content, tokens: 0, isLocal: true });
        }
      } catch (err) { console.log("🏠 Ollama offline"); }
    }

    // ☁️ MODO NUVEM (CASCATA)
    const models = [
      { id: "gemini-1.5-flash", provider: "google" },
      { id: "llama-3.1-8b-instant", provider: "groq" },
      { id: "gpt-4o-mini", provider: "openai" }
    ];

    for (const model of models) {
      try {
        console.log(`📡 Tentando ${model.id}...`);
        
        if (model.provider === "google") {
          // Ajuste para formato nativo do Gemini com histórico
          const contents = historicoCurto.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }));

          const resGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ 
              contents, 
              systemInstruction: { parts: [{ text: promptBase + instrucaoBotoes }] }
            })
          });

          if (resGemini.ok) {
            const d = await resGemini.json();
            respostaFinal = d.candidates[0].content.parts[0].text;
            tokenCount = d.usageMetadata.totalTokenCount;
            break;
          }
        } 
        
        else if (model.provider === "groq" || model.provider === "openai") {
          const apiKey = model.provider === "groq" ? process.env.GROQ_API_KEY : process.env.MINHA_CHAVE_OPENAI;
          const url = model.provider === "groq" ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              model: model.id, 
              messages: mensagensReforcadas,
              temperature: 0.1
            })
          });

          if (response.ok) {
            const d = await response.json();
            respostaFinal = d.choices[0].message.content;
            tokenCount = d.usage.total_tokens;
            break;
          }
        }
      } catch (e) { console.log(`❌ Erro em ${model.id}`); }
    }

    // FALLBACK DE SEGURANÇA
    return NextResponse.json({ 
      content: respostaFinal || "Entendi seu projeto. Qual a voltagem desejada? [OPCOES: 110V, 220V, 380V]", 
      tokens: tokenCount, 
      isLocal: false 
    });

  } catch (error) {
    console.error("Erro Fatal:", error);
    return NextResponse.json({ content: "Erro técnico na engenharia. Tente novamente.", tokens: 0 });
  }
}