import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Importamos o Gemini

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const historico = messages.slice(-3).map(m => m.content).join(' ');

    const apiKey = process.env.PINECONE_API_KEY.trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    // ==========================================
    // 1. EMBEDDING DA PERGUNTA (Pinecone IA)
    // ==========================================
    const resIA = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'X-Pinecone-API-Version': '2024-07'
      },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        parameters: { input_type: 'query', truncate: 'END' },
        inputs: [{ text: historico }] 
      })
    });

    const dataIA = await resIA.json();
    if (!dataIA.data) throw new Error("Falha ao gerar vetor da pergunta.");

    const queryVector = dataIA.data[0].values || dataIA.data[0].embedding;

    // ==========================================
    // 2. BUSCA NO PINECONE (RAG)
    // ==========================================
    const busca = await index.query({
      vector: queryVector,
      topK: 3, // Contexto enxuto e preciso
      includeMetadata: true
    });

    const contexto = busca.matches.map(match => match.metadata.text).join('\n---\n');

    const systemPrompt = `Você é o Suporte Técnico Especialista da Casa das Resistências.
    REGRA 1: Responda SEMPRE com base neste CONTEXTO DO CATÁLOGO:
    ${contexto || "Use seu conhecimento geral, mas avise que não localizou no catálogo."}
    REGRA 2: Seja técnico, direto e não invente produtos que não estão no contexto.`;

    let respostaFinal = "";

    // ==========================================
    // 3. ROTEAMENTO DE MODELOS (O FALLBACK)
    // ==========================================

    try {
      // TENTATIVA 1: GROQ (Llama 3.1) - Mais rápido
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-4)
          ],
          temperature: 0.15,
          max_tokens: 1500
        })
      });

      const groqData = await groqResponse.json();

      // Se a Groq responder com aquele erro de limite (Rate Limit), nós forçamos o erro para cair no Catch
      if (groqData.error) {
        throw new Error(`Groq falhou: ${groqData.error.code || groqData.error.message}`);
      }

      respostaFinal = groqData.choices[0].message.content;

    } catch (erroGroq) {
      console.warn("⚠️ Groq fora do ar ou com limite excedido. Ativando Gemini... Motivo:", erroGroq.message);

      // TENTATIVA 2: GEMINI 1.5 FLASH (Google) - Super resiliente e com limites altíssimos
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      // O Gemini exige que os papéis sejam 'user' e 'model' (não 'assistant')
      const mensagensRecentes = messages.slice(-4);
      const perguntaAtual = mensagensRecentes.pop().content; 
      
      const geminiHistory = mensagensRecentes.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const chat = geminiModel.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(perguntaAtual);
      
      respostaFinal = result.response.text();
    }

    // Retorna a resposta vitoriosa (seja de qual IA for)
    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return NextResponse.json({ content: "Tive um soluço técnico aqui na rede. Pode me repetir a pergunta?" });
  }
}