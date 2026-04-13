import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaPergunta = messages[messages.length - 1].content;

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

    // PROMPT BLINDADO - REGRAS DE BLOQUEIO ABSOLUTO
    const systemPrompt = `Você é o Engenheiro de Aplicação Sênior da Casa das Resistências.
    Sua função é fornecer suporte técnico EXCLUSIVAMENTE com base no CONTEXTO DO CATÁLOGO fornecido abaixo.

    REGRAS DE BLOQUEIO (SOB PENA DE DESLIGAMENTO DO SISTEMA):
    1. PROIBIÇÃO DE INVENÇÃO: É ESTRITAMENTE PROIBIDO criar, adivinhar ou preencher tabelas com SKUs, dimensões, voltagens ou modelos que não estejam literalmente escritos no CONTEXTO DO CATÁLOGO.
    2. PROIBIÇÃO DE PREÇOS: É ESTRITAMENTE PROIBIDO gerar valores monetários (R$, frete, instalação, taxas). Se o cliente perguntar o preço, responda EXATAMENTE: "Para valores e orçamentos, por favor, envie os dados técnicos para o nosso setor comercial."
    3. MODO DE SEGURANÇA: Se a busca do cliente (ex: máquina DC-50) não retornar dados exatos no CONTEXTO DO CATÁLOGO, não tente adivinhar. Responda: "Não tenho as especificações exatas dessa máquina no meu catálogo de acesso rápido. Para eu indicar a peça correta, por favor, me informe as dimensões da furação e a potência desejada."
    4. NÃO SEJA UM ROBÔ: Aja naturalmente. Nunca imprima os nomes das regras ou "FLUXO 1", "Ação" na tela.

    IDENTIFIQUE O FLUXO DO CLIENTE:
    - FLUXO 1 (Dúvida Geral): Explique a física térmica e peça as medidas.
    - FLUXO 2 (Busca Específica): Se o produto estiver no contexto, faça um resumo e confirme. Se não estiver, ative o MODO DE SEGURANÇA.
    - FLUXO 3 (Queima/Falha): Atue como investigador. Pergunte sobre folgas, termostato e sugira melhorias do catálogo (ex: Cartucho Fendilhado para folgas).
    - FLUXO 4 (Fechamento): Diga que fabricamos sob medida e peça: 1. Tensão (V) e Potência (W), 2. Dimensões (mm), 3. Material a aquecer.

    CONTEXTO DO CATÁLOGO (SUA ÚNICA FONTE DA VERDADE):
    ${contextoTecnico || "[CATÁLOGO VAZIO - ATIVE O MODO DE SEGURANÇA E PEÇA AS MEDIDAS AO CLIENTE]"}`;

    let respostaFinal = "";

    try {
      const historicoCurto = messages.slice(-4); 

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // MUDANÇA CRÍTICA: Usando o modelo de 70 Bilhões de parâmetros (Muito mais inteligente e obediente)
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...historicoCurto],
          temperature: 0.0 // MUDANÇA CRÍTICA: Zero criatividade. 100% factual.
        })
      });

      if (!groqResponse.ok) throw new Error("Groq API error");

      const groqData = await groqResponse.json();
      respostaFinal = groqData.choices[0].message.content;

    } catch (err) {
      console.log("⚠️ Groq offline, ativando Fallback Gemini...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro", // Upgrade para o modelo Pro no Fallback também
        systemInstruction: systemPrompt 
      });
      const result = await geminiModel.generateContent(ultimaPergunta);
      respostaFinal = result.response.text();
    }

    return NextResponse.json({ content: respostaFinal });

  } catch (error) {
    console.error("❌ ERRO GRAVE NA ROTA:", error);
    return NextResponse.json({ 
      content: "Houve uma falha de conexão com a nossa base de engenharia. Poderia repetir a sua mensagem?" 
    });
  }
}