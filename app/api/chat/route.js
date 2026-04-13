import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1]?.content || "";

    // Chaves de API (Certifique-se que estão no seu .env.local)
    const pinKey = (process.env.PINECONE_API_KEY || "").trim();
    const groqKey = (process.env.GROQ_API_KEY || "").trim();
    const gemKey = (process.env.GEMINI_API_KEY || "").trim();

    const pc = new Pinecone({ apiKey: pinKey });
    const index = pc.index('catalogo-casa');

    let contextoTecnico = "";
    
    // 1. BUSCA SEMÂNTICA NO PINECONE
    const mensagensUsuario = messages.filter(m => m.role === 'user');
    const termoBusca = mensagensUsuario.slice(-2).map(m => m.content).join(' ');

    if (termoBusca.length > 3) {
      try {
        const resEmb = await fetch('https://api.pinecone.io/embed', {
          method: 'POST',
          headers: { 'Api-Key': pinKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
          body: JSON.stringify({
            model: 'multilingual-e5-large',
            parameters: { input_type: 'query', truncate: 'END' },
            inputs: [{ text: termoBusca }]
          })
        });
        const dataEmb = await resEmb.json();
        const vector = dataEmb.data?.[0]?.values;
        if (vector) {
          const busca = await index.query({ vector, topK: 6, includeMetadata: true });
          contextoTecnico = busca.matches
            .filter(m => m.score > 0.45)
            .map(m => m.metadata.text)
            .join('\n---\n');
        }
      } catch (e) { console.error("Erro Pinecone:", e.message); }
    }

    // 2. DIRETRIZES DE ENGENHARIA SÊNIOR (O CÉREBRO)
    const systemPrompt = `Você é o Engenheiro de Aplicação Sênior da Casa das Resistências. 🔧
    Sua missão é fornecer suporte técnico especializado com base no CONTEXTO fornecido.

    DIRETRIZES RÍGIDAS:
    - PROIBIÇÃO DE INVENÇÃO: Nunca invente modelos, SKUs ou dados técnicos. Se não estiver no contexto, peça: **Tensão (V)**, **Potência (W)** e **Dimensões (mm)**.
    - ZERO PREÇOS: Proibido citar valores em R$. Encaminhe ao comercial para orçamentos.
    - FORMATAÇÃO: Use **Negrito** para destacar dados e produtos. Use tabelas Markdown (| Coluna |) sem blocos de código.
    - ESTILO: Seja técnico, prestativo e use emojis (⚡, ✅, ⚙️).

    FLUXOS DE INTELIGÊNCIA:
    1. **PROJETO**: Explique a física (condução/convecção/IR) e indique o tipo de resistência ideal.
    2. **BUSCA DIRETA**: Identifique o produto no catálogo, apresente o resumo técnico e confirme a aplicação.
    3. **DIAGNÓSTICO (FALHA)**: Se a peça queimou, investigue causas (folga no furo, erro de controle, oxidação). Sugira melhorias como o **Cartucho Fendilhado** para folgas.
    4. **NACIONALIZAÇÃO**: Informe que somos fabricantes e nacionalizamos qualquer peça importada sob medida.
    5. **INSTALAÇÃO**: Dê orientações práticas (ex: tolerância H9 em furos, aperto de bornes).
    6. **FECHAMENTO**: Peça obrigatoriamente: Tensão (V), Potência (W), Dimensões (mm) e Material.

    CONTEXTO TÉCNICO:
    ${contextoTecnico || "Informação específica não localizada no manual. Use conhecimento geral e peça os 4 pilares (V, W, mm, Material)."}`;

    // 3. TENTATIVA NA GROQ (Llama 3.1 8B - Alta Estabilidade)
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", 
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-5)],
          temperature: 0.1
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        return NextResponse.json({ content: data.choices[0].message.content });
      }
    } catch (err) { console.warn("Groq falhou..."); }

    // 4. FALLBACK GEMINI (VIA API V1 ESTÁVEL - SEM ERRO 404)
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${gemKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ text: `Aja como Engenheiro da Casa das Resistências. Instrução: ${systemPrompt}\n\nPergunta: ${ultimaPergunta}` }] 
          }]
        })
      });

      const gemData = await geminiRes.json();
      if (geminiRes.ok && gemData.candidates) {
        return NextResponse.json({ content: gemData.candidates[0].content.parts[0].text });
      }
    } catch (e) { console.error("Erro Crítico Gemini:", e.message); }

    return NextResponse.json({ 
      content: "Olá! 🔧 Tive uma breve oscilação na conexão com nossa base técnica. Para que eu possa te ajudar agora, você poderia me informar a **Tensão (V)**, **Potência (W)** e as **Dimensões** da peça? ⚡" 
    });

  } catch (error) {
    console.error("ERRO GLOBAL:", error.message);
    return NextResponse.json({ content: "Erro de processamento. Por favor, tente novamente. ⚙️" });
  }
}