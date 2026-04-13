import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;

    // Filtra apenas mensagens do usuário para evitar que a IA busque suas próprias tabelas no banco
    const mensagensUsuario = messages.filter(m => m.role === 'user');
    const contextoBusca = mensagensUsuario.slice(-2).map(m => m.content).join(' ');

    const apiKey = (process.env.PINECONE_API_KEY || "").trim();
    const pc = new Pinecone({ apiKey });
    const index = pc.index('catalogo-casa');

    let contextoTecnico = "";
    
    if (contextoBusca.length > 5) {
      try {
        const resIA = await fetch('https://api.pinecone.io/embed', {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
          body: JSON.stringify({
            model: 'multilingual-e5-large',
            parameters: { input_type: 'query', truncate: 'END' },
            inputs: [{ text: contextoBusca }]
          })
        });

        if (resIA.ok) {
          const dataIA = await resIA.json();
          const queryVector = dataIA.data?.[0]?.values;

          if (queryVector) {
            const busca = await index.query({
              vector: queryVector,
              topK: 8,
              includeMetadata: true
            });

            contextoTecnico = busca.matches
              .filter(m => m.score > 0.40)
              .map(match => match.metadata.text)
              .join('\n---\n');
          }
        }
      } catch (errPinecone) {
        console.error("⚠️ Erro silencioso no Pinecone:", errPinecone);
      }
    }

    // PROMPT REESTRUTURADO: FOCO EM FLUXOS E RENDERIZAÇÃO DE TABELAS
    const systemPrompt = `Você é o Engenheiro de Aplicação Sênior da Casa das Resistências.

    REGRAS DE BLOQUEIO ABSOLUTO:
    1. PROIBIÇÃO DE INVENÇÃO: Nunca invente SKUs, modelos, limites térmicos ou dados técnicos. Use APENAS o contexto abaixo.
    2. PROIBIÇÃO DE PREÇOS: Nunca forneça valores (R$). Responda: "Para orçamentos, envie os dados técnicos ao nosso setor comercial."
    3. MODO DE SEGURANÇA: Se o produto exato não estiver no catálogo, peça: Tensão (V), Potência (W) e Dimensões (mm).

    REGRAS DE RENDERIZAÇÃO:
    - Use obrigatoriamente TABELAS MARKDOWN para dados técnicos.
    - NUNCA use blocos de código (ex: \`\`\`markdown) para envolver tabelas. Escreva a tabela diretamente no texto para garantir a renderização.

    FLUXOS DE ATENDIMENTO:
    1. DÚVIDA DE PROJETO: Explique a física térmica e indique o produto adequado do catálogo.
    2. BUSCA DIRETA: Resuma o produto encontrado e gere a Tabela Markdown.
    3. DIAGNÓSTICO DE FALHAS: Se a peça queimou, investigue (folga no furo, falta de controle, nível de fluido) e sugira melhorias (ex: Cartucho Fendilhado para folgas).
    4. NACIONALIZAÇÃO: Informe que fabricamos sob medida e podemos replicar peças importadas. Peça as medidas da original.
    5. DICAS DE INSTALAÇÃO: Oriente sobre boas práticas (ex: tolerância H9, aperto de terminais).
    6. FECHAMENTO: Peça os 4 pilares: Tensão (V), Potência (W), Dimensões (mm) e Material.

    CONTEXTO DO CATÁLOGO:
    ${contextoTecnico || "Informação não localizada no catálogo. Acione o MODO DE SEGURANÇA."}`;

    let respostaFinal = "";

    try {
      const historicoCurto = messages.slice(-4); 

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...historicoCurto],
          temperature: 0.1 // 0.1 permite a renderização correta do Markdown sem perder a precisão factual
        })
      });

      if (!groqResponse.ok) throw new Error("Groq API error");

      const groqData = await groqResponse.json();
      respostaFinal = groqData.choices[0].message.content;

    } catch (err) {
      console.log("⚠️ Groq falhou, ativando Fallback Gemini Pro...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro", 
        systemInstruction: systemPrompt 
      });
      const result = await geminiModel.generateContent(ultimaPergunta);
      respostaFinal = result.response.text();
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("❌ ERRO NA ROTA:", error);
    return NextResponse.json({ 
      content: "Desculpe, tive um problema de conexão com a engenharia. Poderia repetir?" 
    });
  }
}