import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages, language, provider = 'groq' } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('catalogo-resistencias');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    // 1. Gerar Embedding da pergunta
    const embeddingRes = await embedModel.embedContent(ultimaMensagem);
    const vector = Array.from(embeddingRes.embedding.values);

    // 2. Buscar no Pinecone
    const queryResponse = await index.query({
      vector: vector,
      topK: 4,
      includeMetadata: true
    });

    const trechosRelevantes = queryResponse.matches
      .map(match => match.metadata.text)
      .join('\n\n');

    const systemInstruction = `Você é o assistente técnico da Casa das Resistências. Responda em ${language}.
    Use este catálogo: ${trechosRelevantes}`;

    // 3. Chamar a IA (Groq por padrão para ser mais rápido)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemInstruction }, ...messages.slice(-6)],
        temperature: 0.1
      }),
    });

    const data = await response.json();
    return NextResponse.json({
      content: data.choices[0].message.content,
      model_usado: 'RAG Pro (Pinecone + Llama 70B)'
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}