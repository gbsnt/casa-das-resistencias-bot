import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(req) {
  try {
    const { messages, language } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;

    // 1. Conectar ao Pinecone
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('catalogo-casa');

    // 2. BUSCA DIRETA (O Pinecone faz o embedding internamente agora)
    // Trocamos 'vector' por 'data' para usar o modelo integrado (Llama)
    const queryResponse = await index.query({
      topK: 5,
      data: ultimaMensagem, // Enviamos o texto puro da pergunta
      includeMetadata: true
    });

    // 3. Organizar os trechos técnicos encontrados no catálogo
    const trechosRelevantes = queryResponse.matches
      .map(match => match.metadata.text)
      .join('\n\n');

    // 4. Instrução de Sistema para o Llama na Groq
    const systemInstruction = `Você é o assistente técnico sênior da Casa das Resistências. 
    Responda obrigatoriamente em ${language}.
    
    INFORMAÇÕES TÉCNICAS DO CATÁLOGO:
    ${trechosRelevantes}
    
    REGRAS DE OURO:
    - Use APENAS as informações do catálogo acima para responder.
    - Se a informação não estiver lá, diga que não localizou no catálogo e peça para falar com um consultor humano.
    - Seja extremamente profissional, técnico e direto.
    - Não invente preços ou prazos que não estejam no texto.`;

    // 5. Chamada para a Groq (Llama 3.3 70B)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction }, 
          ...messages.slice(-6) // Mantém o contexto das últimas 6 mensagens
        ],
        temperature: 0.2, // Mantém a resposta precisa e pouco criativa
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Erro na Groq');
    }

    // 6. Retorno para o Front-end
    return NextResponse.json({
      content: data.choices[0].message.content,
      model_usado: 'Cérebro Integrado (Pinecone Inference + Llama 70B)'
    });

  } catch (error) {
    console.error("Erro na Rota de Chat:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}