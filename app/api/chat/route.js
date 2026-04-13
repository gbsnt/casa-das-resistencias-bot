import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// IMPORTAÇÕES EXTERNAS (O Segredo da Organização)
import { buildSystemPrompt } from '@/lib/prompt'; // Ajuste para o seu caminho correto
import { GROQ_MODELS, OPENROUTER_MODELS } from '@/lib/models'; // Importando suas listas!

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

    // 1. PINECONE (RAG)
    try {
      const pc = new Pinecone({ apiKey: pcKey });
      const index = pc.index('catalogo-casa');
      
      const resIA = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: { 
          'Api-Key': pcKey, 
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2024-07' 
        },
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
    } catch (e) {
      console.log("⚠️ Pinecone em espera ou sem resultados exatos.");
    }

    const systemPrompt = buildSystemPrompt(contexto);

    // 2. TENTATIVA GROQ (Loop na lista de modelos Groq)
    let sucesso = false;

    if (groqKey) {
      for (const modelo of GROQ_MODELS) {
        try {
          console.log(`🚀 Tentando Groq com: ${modelo}...`);
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelo,
              messages: [{ role: "system", content: systemPrompt }, ...historicoCurto],
              temperature: 0 
            })
          });

          if (groqRes.ok) {
            const data = await groqRes.json();
            respostaFinal = data.choices[0].message.content;
            console.log(`✅ Sucesso na Groq com o modelo: ${modelo}!`);
            sucesso = true;
            break; // Sai do loop da Groq se deu certo
          } else {
            console.log(`⚠️ Groq ${modelo} ocupado. Tentando próximo...`);
          }
        } catch (err) {
          console.log(`⚠️ Erro de rede no Groq ${modelo}.`);
        }
      }
    }

    // 3. FALLBACK: CASCATA OPENROUTER (Se todos da Groq falharam)
    if (!sucesso && orKey.startsWith("sk-or")) {
      console.log("🔥 Groq esgotado. Iniciando Cascata OpenRouter...");
      
      for (const modelo of OPENROUTER_MODELS) {
        try {
          console.log(`🌟 Tentando OpenRouter com: ${modelo}...`);
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${orKey}`, 
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'SuporteTecnico'
            },
            body: JSON.stringify({
              model: modelo,
              messages: [{ role: "system", content: systemPrompt }, ...historicoCurto],
              temperature: 0
            })
          });

          if (orRes.ok) {
            const orData = await orRes.json();
            respostaFinal = orData.choices[0].message.content;
            console.log(`✅ OpenRouter (${modelo}) salvou a pátria!`);
            sucesso = true;
            break; // Sai do loop assim que acha um que funciona
          } else {
            console.log(`⚠️ Modelo ${modelo} ocupado. Indo para o próximo...`);
          }
        } catch (e) {
          console.log(`⚠️ Erro no OpenRouter (${modelo}). Motivo:`, e.message);
        }
      }
    }

    // 4. RESPOSTA DE SEGURANÇA FINAL
    if (!sucesso || !respostaFinal) {
      respostaFinal = "🔧 Nossos sistemas de cálculo estão com alta demanda. Por favor, **aguarde 60 segundos** e envie sua pergunta técnica novamente para que possamos projetar sua resistência! ⚡";
    }

    // 5. FILTRO CONTRA ALUCINAÇÃO DE PREÇOS
    if (respostaFinal.includes("R$")) {
      respostaFinal = "Fabricamos resistências sob medida. Fale com nosso comercial para orçamentos exatos. 📞";
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("🔥 Erro fatal:", error.message);
    return NextResponse.json({ content: "Tivemos um problema de conexão com a engenharia. Pode repetir a mensagem? 🔄" });
  }
}