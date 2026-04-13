import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    
    // Melhora a busca: usa o histórico para entender se o usuário está continuando um assunto
    const contextoBusca = messages.slice(-3).map(m => m.content).join(' ');

    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    // 1. GERAÇÃO DE EMBEDDING
    const resIA = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        parameters: { input_type: 'query', truncate: 'END' },
        inputs: [{ text: contextoBusca }]
      })
    });

    const dataIA = await resIA.json();
    const queryVector = dataIA.data?.[0]?.values;

    let contextoTecnico = "";
    if (queryVector) {
      const busca = await index.query({ 
        vector: queryVector, 
        topK: 12, // Reduzi para 12 para ser mais certeiro e evitar confusão
        includeMetadata: true 
      });

      contextoTecnico = busca.matches
        .filter(m => m.score > 0.35) // Filtro um pouco mais rigoroso
        .map(match => match.metadata.text)
        .join('\n---\n');
    }

    // 2. O SYSTEM PROMPT "CÉREBRO TÉCNICO"
    const systemPrompt = `Você é o Engenheiro Sênior de Aplicação da Casa das Resistências. 
    Sua missão é dar o "norte" técnico para o projeto do cliente.

    DIRETRIZES DE OURO:
    1. RACIOCÍNIO DE ENGENHARIA: Se o cliente fornecer volume (L) e temperatura (°C), você deve realizar um cálculo estimativo. 
       - Exemplo base: Para 50L de água, de 20°C a 100°C, estima-se a necessidade de 5kW a 6kW para aquecer em aproximadamente 1 hora.
    2. CONSULTA AO CONTEXTO: Use os dados do manual abaixo para indicar o modelo exato (Ex: IFR, ISB, Campânula CP-P).
    3. TABELAS: Sempre apresente as especificações técnicas ou indicações em Tabelas Markdown.
    4. CHECKLIST OBRIGATÓRIO: Ao final de cada indicação, peça: Tensão (V), Potência desejada (W), Dimensões (mm) e Material do Recipiente.
    5. FIDELIDADE TÉCNICA: Não confunda aquecedores de aves (Campânula) com aquecedores de tanques químicos (ISB).
    6. ZERO PREÇOS: Nunca fale valores em R$. Direcione para o comercial.

    CONTEXTO TÉCNICO DO MANUAL:
    ${contextoTecnico || "Informação específica não localizada. Use seu conhecimento de engenharia térmica para guiar o cliente e pedir os dados de projeto."}`;

    // 3. DISPARO PARA A IA (Groq com Llama 3.1 8B ou 70B)
    let respostaFinal = "";
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-6)],
          temperature: 0.2 // Baixa temperatura para evitar alucinação
        })
      });

      const groqData = await groqResponse.json();
      
      if (!groqResponse.ok) throw new Error(groqData.error?.message || "Erro Groq");
      respostaFinal = groqData.choices[0].message.content;

    } catch (err) {
      console.warn("⚠️ Groq offline ou erro, tentando Gemini Fallback...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: systemPrompt });
      const result = await geminiModel.generateContent(ultimaPergunta);
      respostaFinal = result.response.text();
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("❌ ERRO NO ROUTE:", error);
    return NextResponse.json({ 
      content: "Tive um problema ao consultar nosso catálogo técnico. Poderia repetir a sua dúvida?" 
    });
  }
}