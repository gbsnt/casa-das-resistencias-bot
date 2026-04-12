import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages, language, provider = 'groq' } = await req.json();
    const query = messages[messages.length - 1].content;

    // 1. Conectar ao Pinecone e Gemini
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('catalogo-resistencias');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // 2. Transformar a pergunta do cliente em "vetor" (Embedding)
    const embeddingRes = await embedModel.embedContent(query);
    const vector = embeddingRes.embedding.values;

    // 3. Buscar no Pinecone os 4 parágrafos mais parecidos
    const queryResponse = await index.query({
      vector: vector,
      topK: 4,
      includeMetadata: true
    });

    const trechosRelevantes = queryResponse.matches
      .map(match => match.metadata.text)
      .join('\n\n');

    // 4. Configurar instruções para a IA
    const systemInstruction = `Você é o suporte técnico da Casa das Resistências.
    Use os dados abaixo para responder (Busca Semântica):
    ${trechosRelevantes}
    
    Regras: Se não houver relação clara entre a pergunta e o catálogo acima, diga que não encontrou.`;

    // 5. Chamar o Provedor Escolhido (Groq ou Gemini)
    // ... (Aqui mantém-se a lógica de fetch para Groq/Gemini que já tínhamos) ...
    // Basta usar 'systemInstruction' como o prompt de sistema.

    // Exemplo simplificado para Groq:
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemInstruction }, ...messages.slice(-6)],
        temperature: 0.1
      })
    });

    const data = await response.json();
    return NextResponse.json({ content: data.choices[0].message.content, model_usado: 'RAG Pro + Llama 70B' });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}