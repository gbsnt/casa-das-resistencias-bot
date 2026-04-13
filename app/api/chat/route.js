import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;
    const historicoParaBusca = messages.slice(-2).map(m => m.content).join(' ');
    
    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const groqKey = (process.env.GROQ_API_KEY || "").trim();
    
    // AQUI É A SUA CHAVE SK-OR-V1... QUE ESTÁ NO .ENV.LOCAL
    const openRouterKey = (process.env.OPENAI_API_KEY || "").trim(); 
    
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');
    
    let termoParaBusca = ultimaPergunta;
    if (ultimaPergunta.length < 10) termoParaBusca = historicoParaBusca;
    
    // 1. PINECONE
    let contexto = "";
    try {
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
        
        if (queryVector) {
          const busca = await index.query({ vector: queryVector, topK: 4, includeMetadata: true });
          contexto = busca.matches.map(match => match.metadata.text).join('\n---\n');
        }
    } catch (e) {
        console.error("Aviso: Pinecone offline.", e.message);
    }

    // 2. SYSTEM PROMPT
    const systemPrompt = `Você é o Engenheiro de Suporte da Casa das Resistências. 
    Conhecimento RESTRITO ao contexto fornecido.
    
    REGRAS DE CONDUTA:
    1. ZERO INVENÇÃO: Use APENAS Inox, NiCr, MgO. Nunca cite eletrônica ou plástico.
    2. FÓRMULAS: Use LaTeX para potência: $$P = \\frac{V^2}{R}$$.
    3. TABELAS: Sempre que houver dados técnicos, use o formato de tabela Markdown.
    4. PREÇOS: Proibido citar valores. Responda: "Para orçamentos, consulte nosso setor comercial. 📞"
    5. MEDIDAS: Somos fabricantes sob medida. Peça sempre Diâmetro, Comprimento, Tensão (V) e Potência (W).
    
    CONTEXTO DO MANUAL:
    ${contexto || "Dados não localizados. Siga o protocolo de peças sob medida."}`;

    let respostaFinal = "";

    // 3. GROQ
    try {
      console.log("🚀 Disparando Groq (Llama 3.1 8B)...");
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${groqKey}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-3)],
          temperature: 0 
        })
      });

      if (groqResponse.ok) {
        const groqData = await groqResponse.json();
        respostaFinal = groqData.choices[0].message.content;
      } else {
        throw new Error(`Groq Status: ${groqResponse.status}`);
      }

    } catch (err) {
      console.log("⚠️ Groq estourou a cota. Verificando Fallback OpenRouter...", err.message);
      
      // 4. FALLBACK: OPENROUTER
      if (!openRouterKey || !openRouterKey.startsWith("sk-or")) {
          console.error("❌ Chave inválida para OpenRouter. Deve começar com sk-or");
          return NextResponse.json({ 
            content: "Olá! 🔧 Nossos servidores estão com pico de acessos neste minuto. Por favor, **aguarde 60 segundos** e me mande um 'Oi' novamente! ⚡" 
          });
      }

      try {
        console.log("🌟 Acionando OpenRouter (Meta Llama 3 8B Livre)...");
        // Mudamos a URL para a API do OpenRouter! Fim do erro 401.
        const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 
              'Authorization': `Bearer ${openRouterKey}`, 
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000', // OpenRouter exige isso
              'X-Title': 'ChatbotSuporte' // OpenRouter exige isso
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3-8b-instruct:free", // Modelo 100% gratuito no OpenRouter
            messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-3)],
            temperature: 0 
          })
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          respostaFinal = fallbackData.choices[0].message.content;
          console.log("✅ OpenRouter salvou a pátria!");
        } else {
            console.error("❌ Erro no OpenRouter:", await fallbackResponse.text());
            return NextResponse.json({ 
              content: "Olá! 🔧 Houve uma oscilação geral nos servidores de IA. Pode repetir a mensagem em instantes? 🔄" 
            });
        }
      } catch (e) {
        return NextResponse.json({ content: "Tive um soluço de conexão na nuvem. Pode repetir? 🔄" });
      }
    }

    // 5. FILTRO ANTIBURRICE DE PREÇO
    if (respostaFinal.includes("R$")) respostaFinal = "Nossos projetos são 100% sob medida para sua indústria. Consulte nosso comercial para orçamentos exatos. 📞";

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    return NextResponse.json({ content: "Erro no servidor interno. Tente novamente! ⚙️" });
  }
}