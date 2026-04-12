import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const historicoParaBusca = messages.slice(-3).map(m => m.content).join(' ');

    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    // 1. EMBEDDING
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
        inputs: [{ text: historicoParaBusca }] 
      })
    });

    const dataIA = await resIA.json();
    const queryVector = dataIA.data?.[0]?.values;

    // 2. BUSCA RAG
    let contexto = "";
    if (queryVector) {
      const busca = await index.query({ vector: queryVector, topK: 3, includeMetadata: true });
      contexto = busca.matches.map(match => match.metadata.text).join('\n---\n');
    }

    const systemPrompt = `Você é um Engenheiro de Aplicação da Casa das Resistências. 
    Responda APENAS com base no contexto abaixo. Se não souber, direcione para o comercial. 
    NUNCA invente preços ou modelos (ex: MTO-50).
    
    CONTEXTO:
    ${contexto}`;

    let respostaFinal = ""; // Variável declarada corretamente aqui no topo

    // 3. ROTEAMENTO (GROQ -> GEMINI)
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-6)],
          temperature: 0.1
        })
      });

      const groqData = await groqResponse.json();
      if (groqData.error) throw new Error(groqData.error.message);
      
      respostaFinal = groqData.choices[0].message.content;

    } catch (erroGroq) {
      console.warn("⚠️ Groq falhou, usando Gemini. Motivo:", erroGroq.message);

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      // FILTRO CRÍTICO: O Gemini exige que a primeira mensagem seja 'user'
      let mensagensGemini = messages.slice(-6);
      while (mensagensGemini.length > 0 && mensagensGemini[0].role !== 'user') {
        mensagensGemini.shift();
      }

      if (mensagensGemini.length === 0) {
        // Se não sobrou nada, mandamos apenas a última pergunta
        const ultimaMsg = messages[messages.length - 1].content;
        const result = await geminiModel.generateContent(ultimaMsg);
        respostaFinal = result.response.text();
      } else {
        const perguntaAtual = mensagensGemini.pop().content;
        const history = mensagensGemini.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const chat = geminiModel.startChat({ history });
        const result = await chat.sendMessage(perguntaAtual);
        respostaFinal = result.response.text();
      }
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return NextResponse.json({ content: "Tive um soluço técnico. Pode repetir?" });
  }
}