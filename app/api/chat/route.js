import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cacheConteudo = null;

export async function POST(req) {
  try {
    const { messages } = await req.json();
    
    // Pegamos as últimas 2 mensagens para a busca não ficar "cega"
    const contextoBusca = messages.slice(-2).map(m => m.content).join(' ');
    const ultimaMensagem = messages[messages.length - 1].content;

    if (!cacheConteudo) {
      const filePath = path.join(process.cwd(), 'conhecimento.txt');
      cacheConteudo = fs.readFileSync(filePath, 'utf8').split('\n\n');
    }

    // 1. BUSCA MELHORADA: Se a pergunta for curta, usamos o histórico para buscar
    const termos = contextoBusca.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/\W+/)
      .filter(p => p.length > 2);

    const blocosRelevantes = cacheConteudo.map(bloco => {
      let score = 0;
      const blocoLower = bloco.toLowerCase();
      // Pontuação: se a palavra exata existe, ganha ponto
      termos.forEach(t => { if (blocoLower.includes(t)) score++; });
      return { bloco, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15); // Aumentamos para 15 blocos para dar mais margem

    const contextoParaIA = blocosRelevantes.map(i => i.bloco).join('\n---\n');

    // 2. SYSTEM PROMPT MAIS FLEXÍVEL
    const systemPrompt = `
      Você é o Suporte Técnico Especialista da Casa das Resistências.
      
      INSTRUÇÕES:
      1. Use o CONTEXTO fornecido para responder de forma técnica.
      2. Se o usuário fizer perguntas de acompanhamento (como "quais?", "e as tubulares?"), mantenha o foco nos produtos citados anteriormente no contexto.
      3. Se a informação REALMENTE não estiver no contexto, use seu conhecimento sobre resistências elétricas, mas avise que é uma informação geral.
      
      CONTEXTO:
      ${contextoParaIA || "O catálogo técnico está disponível para consulta geral."}
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages // Mandamos o histórico completo para a IA não se perder
        ],
        temperature: 0.2, // Um pouquinho mais de "jogo de cintura"
      })
    });

    const data = await response.json();
    return NextResponse.json({ content: data.choices[0].message.content });

  } catch (error) {
    console.error("ERRO:", error);
    return NextResponse.json({ content: "Tive um erro técnico. Pode repetir a pergunta?" });
  }
}