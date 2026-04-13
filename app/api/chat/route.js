import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { buildSystemPrompt } from '@/lib/prompt'; 
import { MODEL_HIERARCHY } from '@/lib/models'; 

export async function POST(req) {
  let respostaFinal = "";
  let contexto = "";

  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    const historicoCurto = messages.slice(-3);

    const pcKey = (process.env.PINECONE_API_KEY || "").trim();
    const groqKey = (process.env.GROQ_API_KEY || "").trim();
    const orKey = (process.env.OPENAI_API_KEY || "").trim();

    // 1. PINECONE (Busca de Catálogo)
    try {
      const pc = new Pinecone({ apiKey: pcKey });
      const index = pc.index('catalogo-casa');
      const resIA = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: { 'Api-Key': pcKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
        body: JSON.stringify({
          model: 'multilingual-e5-large',
          parameters: { input_type: 'query', truncate: 'END' },
          inputs: [{ text: ultimaPergunta }]
        })
      });
      if (resIA.ok) {
        const dataIA = await resIA.json();
        const vector = dataIA.data?.[0]?.values;
        if (vector) {
          const busca = await index.query({ vector, topK: 3, includeMetadata: true });
          contexto = busca.matches.map(m => m.metadata.text).join('\n---\n');
        }
      }
    } catch (e) { console.log("⚠️ Erro Pinecone ou busca de contexto."); }

    const systemPrompt = buildSystemPrompt(contexto);

    // 2. CASCATA DE MODELOS (Waterfall com Debug Avançado)
    let sucesso = false;
    for (const item of MODEL_HIERARCHY) {
      try {
        console.log(`📡 Tentando ${item.model}...`);
        const url = item.provider === "groq" ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
        const key = item.provider === "groq" ? groqKey : orKey;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${key}`, 
            'Content-Type': 'application/json',
            ...(item.provider === "openrouter" && { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'CasaResistencias' })
          },
          body: JSON.stringify({
            model: item.model,
            messages: [{ role: "system", content: systemPrompt }, ...historicoCurto],
            temperature: 0
          })
        });

        if (response.ok) {
          const data = await response.json();
          respostaFinal = data.choices[0].message.content;
          console.log(`✅ Sucesso com ${item.model}`);
          sucesso = true;
          break;
        } else {
          // CAPTURA O ERRO REAL PARA O TERMINAL
          const erroTexto = await response.text();
          console.log(`❌ ${item.model} negou a requisição. Status: ${response.status}. Detalhe: ${erroTexto.substring(0, 100)}...`);
        }
      } catch (err) { 
        console.log(`🔥 Erro de rede/conexão crítica com ${item.model}:`, err.message); 
      }
    }

    // 3. FILTRO FINAL E RESPOSTA
    if (!respostaFinal) {
      respostaFinal = "🔧 Nossa engenharia está com alta demanda. Por favor, aguarde 60 segundos e tente novamente para que possamos projetar sua resistência! ⚡";
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("ERRO FATAL NA ROTA:", error);
    return NextResponse.json({ content: "Tivemos um problema técnico. Tente novamente. 🔄" });
  }
}