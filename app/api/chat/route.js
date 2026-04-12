import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages, language, provider = 'groq' } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;

    // 1. Conectar ao Pinecone e ao Gemini (para criar o vetor/embedding)
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('catalogo-resistencias');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // 2. Transformar a pergunta do cliente em "vetor matemático"
    const embeddingRes = await embedModel.embedContent(ultimaMensagem);
    const vector = embeddingRes.embedding.values;

    // 3. Buscar no Pinecone os 4 parágrafos mais relevantes em milissegundos
    const queryResponse = await index.query({
      vector: vector,
      topK: 4,
      includeMetadata: true
    });

    const trechosRelevantes = queryResponse.matches
      .map(match => match.metadata.text)
      .join('\n\n');

    // 4. Configurar instruções para a IA
    const systemInstruction = `Você é o assistente técnico sênior da Casa das Resistências. Responda em ${language}.
    
    CATÁLOGO ENCONTRADO NO BANCO DE DADOS:
    ${trechosRelevantes}
    
    REGRAS RÍGIDAS:
    1. Baseie sua resposta ESTRITAMENTE no catálogo acima.
    2. Se a aplicação do cliente não combinar com os produtos do catálogo acima, diga honestamente que não encontrou o produto. 
    3. NUNCA invente especificações técnicas, SKUs ou potências que não estejam no texto.
    4. Responda de forma altamente técnica e profissional.`;

    // =========================================================================
    // 5. TRILHO DO GOOGLE GEMINI
    // =========================================================================
    if (provider === 'gemini') {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) return NextResponse.json({ error: 'Chave GEMINI não encontrada' }, { status: 500 });

      const mensagensGoogle = messages
        .filter(m => !m.content.startsWith('⚠️'))
        .slice(-6)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: mensagensGoogle,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.1 }
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message }, { status: response.status });

      return NextResponse.json({
        content: data.candidates[0].content.parts[0].text,
        model_usado: 'Google Gemini 2.0 (Busca Vetorial)'
      });

    } else {
      // =========================================================================
      // 6. TRILHO DA GROQ (Llama 70B)
      // =========================================================================
      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      if (!GROQ_API_KEY) return NextResponse.json({ error: 'Chave GROQ não encontrada' }, { status: 500 });

      const mensagensLimpas = messages
        .filter(m => !m.content.startsWith('⚠️'))
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const sysMsg = { role: 'system', content: systemInstruction };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [sysMsg, ...mensagensLimpas],
          temperature: 0.1
        }),
      });

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message }, { status: response.status });

      return NextResponse.json({
        content: data.choices[0].message.content,
        model_usado: 'Llama 3.3 70B (Busca Vetorial)'
      });
    }

  } catch (error) {
    console.error("Erro fatal na API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}