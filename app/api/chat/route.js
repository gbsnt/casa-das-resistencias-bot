import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    
    // Pegamos o contexto das últimas mensagens para ele não "esquecer" do que estão falando
    const historico = messages.slice(-3).map(m => m.content).join(' ');

    const apiKey = process.env.PINECONE_API_KEY.trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    // ==========================================
    // 1. TRANSFORMA A PERGUNTA EM VETOR (Usando o Bypass)
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
        parameters: { input_type: 'query', truncate: 'END' }, // 'query' diz à IA que é uma pesquisa
        inputs: [{ text: historico }] 
      })
    });

    const dataIA = await resIA.json();
    
    // Se der algum erro na API do Pinecone
    if (!dataIA.data) {
        throw new Error("Falha ao gerar vetor da pergunta.");
    }

    const queryVector = dataIA.data[0].values || dataIA.data[0].embedding;

    // ==========================================
    // 2. BUSCA INTELIGENTE NO PINECONE (O RAG REAL)
    // ==========================================
    const busca = await index.query({
      vector: queryVector,
      topK: 6, // Pega os 6 parágrafos mais perfeitos para a pergunta
      includeMetadata: true
    });

    // Monta o contexto para a IA ler
    const contexto = busca.matches.map(match => match.metadata.text).join('\n---\n');

    // ==========================================
    // 3. O CÉREBRO DA RESPOSTA (GROQ + LLAMA 3)
    // ==========================================
    const systemPrompt = `
      Você é o Suporte Técnico Especialista da Casa das Resistências.
      
      REGRA 1: Responda SEMPRE com base neste CONTEXTO DO CATÁLOGO:
      ${contexto || "Use seu conhecimento geral, mas avise que não localizou no catálogo."}
      
      REGRA 2: Seja técnico, direto e não invente produtos que não estão no contexto.
      REGRA 3: Se o cliente der "Oi" ou pedir informações iniciais, seja cordial.
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-4) // Mantém as 4 últimas mensagens para a IA não se perder
        ],
        temperature: 0.15, // Precisão técnica altíssima
        max_tokens: 1500   // Garante que a resposta nunca seja cortada no meio
      })
    });

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'rate_limit_exceeded') {
        return NextResponse.json({ content: "Estou lendo o catálogo para você... Pode repetir a pergunta em 5 segundos? ⚡" });
      }
      return NextResponse.json({ content: "Tive um erro de conexão. Pode repetir?" });
    }

    return NextResponse.json({ content: data.choices[0].message.content });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return NextResponse.json({ content: "Tive um soluço técnico aqui. Sobre o que estávamos falando?" });
  }
}