import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    const historicoParaBusca = messages.slice(-3).map(m => m.content).join(' ');
    
    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');
    
    let termoParaBusca = ultimaPergunta;
    if (ultimaPergunta.length < 10) termoParaBusca = historicoParaBusca;
    
    // 1. GERAÇÃO DE EMBEDDING
    const resIA = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        parameters: { input_type: 'query', truncate: 'END' },
        inputs: [{ text: termoParaBusca }] 
      })
    });
    
    const dataIA = await resIA.json();
    const queryVector = dataIA.data?.[0]?.values;
    
    let contexto = "";
    let encontrouContexto = false;
    
    if (queryVector) {
      const busca = await index.query({ vector: queryVector, topK: 6, includeMetadata: true });
      if (busca.matches && busca.matches.length > 0) {
        contexto = busca.matches.map(match => match.metadata.text).join('\n---\n');
        encontrouContexto = true;
      }
    }
    
    // SYSTEM PROMPT: Responde APENAS com contexto, mantém formatação original
    const systemPrompt = `Você é o Especialista Técnico da Casa das Resistências.

INSTRUÇÕES:
- Responda APENAS com informações do contexto fornecido abaixo
- Mantenha a formatação original: tabelas, bullet points, estrutura do catálogo
- Não invente dados, produtos ou especificações
- Não adicione explicações extras ou contexto geral
- Se não encontrar no contexto, responda: "Não encontrei essa informação em nosso banco de dados."

CONTEXTO:
${encontrouContexto ? contexto : "Nenhum dado encontrado no catálogo para esta busca."}`;

    let respostaFinal = "";
    
    try {
      // TENTA GROQ
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-5)],
          temperature: 0.05,
          top_p: 0.85,
          max_tokens: 800
        })
      });
      
      const groqData = await groqResponse.json();
      if (groqData.choices?.[0]?.message?.content) {
        respostaFinal = groqData.choices[0].message.content;
      } else {
        throw new Error('Resposta inválida');
      }
    } catch (err) {
      // FALLBACK GEMINI
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const geminiModel = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash", 
          systemInstruction: systemPrompt
        });
        const result = await geminiModel.generateContent(ultimaPergunta);
        respostaFinal = result.response.text();
      } catch (geminiErr) {
        respostaFinal = "Tive um soluço técnico. Pode repetir? 🔄";
      }
    }
    
    // Filtro: Remove preços se houver
    if (respostaFinal.includes("R$")) {
      respostaFinal = respostaFinal.replace(/R\$[\d.,\s]+/g, "[VALOR]");
      respostaFinal += "\n\nPara orçamentos, consulte nosso setor comercial.";
    }
    
    return NextResponse.json({ content: respostaFinal });
    
  } catch (error) {
    return NextResponse.json({ content: "Tive um soluço técnico. Pode repetir? 🔄" });
  }
}