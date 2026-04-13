import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    
    // Pega as últimas 3 mensagens para dar contexto à busca
    const contextoBusca = messages.slice(-3).map(m => m.content).join(' ');

    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    // 1. GERAÇÃO DE EMBEDDING (Focada em capturar o assunto técnico)
    const resIA = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        parameters: { input_type: 'query', truncate: 'END' },
        inputs: [{ text: contextoBusca }] // Buscamos usando o contexto completo
      })
    });

    const dataIA = await resIA.json();
    const queryVector = dataIA.data?.[0]?.values;

    let contextoTecnico = "";
    
    if (queryVector) {
      // AUMENTAMOS O TOPK PARA 15 (Para pegar mais pedaços do manual)
      const busca = await index.query({ 
        vector: queryVector, 
        topK: 15, 
        includeMetadata: true 
      });

      // LOG DE DIAGNÓSTICO (Olhe o terminal do seu VS Code após perguntar algo)
      console.log(`🔍 BUSCA NO BANCO: Encontrei ${busca.matches.length} resultados.`);
      if (busca.matches.length > 0) {
        console.log(`📄 PRIMEIRO RESULTADO: ${busca.matches[0].metadata.text.substring(0, 100)}...`);
      }

      contextoTecnico = busca.matches
        .filter(m => m.score > 0.3) // Filtra resultados que não têm nada a ver
        .map(match => match.metadata.text)
        .join('\n---\n');
    }

    const systemPrompt = `Você é o Engenheiro de Suporte da Casa das Resistências. 
    Seu cérebro é EXCLUSIVAMENTE o CONTEXTO TÉCNICO fornecido.

    REGRAS CRÍTICAS:
    1. Se a informação não estiver no contexto abaixo, diga: "Não localizei os detalhes exatos no catálogo, mas para orçarmos essa peça, informe a Tensão (V), Potência (W) e Dimensões."
    2. Nunca invente marcas ou especificações (ex: nada de Bronze ou Hotmel se não estiver no texto).
    3. Use tabelas Markdown para listar dados técnicos.
    4. Responda de forma direta e profissional.

    CONTEXTO TÉCNICO EXTRAÍDO DO BANCO:
    ${contextoTecnico || "AVISO: O banco de dados não retornou informações para esta busca."}`;

    // 2. DISPARO PARA A IA (Groq com Fallback Gemini)
    let respostaFinal = "";
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-6)],
          temperature: 0 
        })
      });
      const groqData = await groqResponse.json();
      respostaFinal = groqData.choices[0].message.content;
    } catch (err) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: systemPrompt });
      const result = await geminiModel.generateContent(ultimaPergunta);
      respostaFinal = result.response.text();
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("ERRO:", error);
    return NextResponse.json({ content: "Tive um erro ao consultar a engenharia. Tente novamente." });
  }
}