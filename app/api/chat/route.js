import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cacheConteudo = null;

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;
    
    // Pega as últimas 3 mensagens para entender o "fio da meada"
    const historicoRecente = messages.slice(-3).map(m => m.content).join(' ');

    if (!cacheConteudo) {
      const filePath = path.join(process.cwd(), 'conhecimento.txt');
      cacheConteudo = fs.readFileSync(filePath, 'utf8').split('\n\n');
    }

    // 1. MOTOR DE BUSCA ROBUSTO
    const limparTexto = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const termos = limparTexto(historicoRecente).split(/\W+/).filter(p => p.length > 2);

    const blocosRelevantes = cacheConteudo.map(bloco => {
      let score = 0;
      const blocoLower = limparTexto(bloco);
      termos.forEach(t => { if (blocoLower.includes(t)) score += 2; }); // Palavra exata vale mais
      return { bloco, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

    const contexto = blocosRelevantes.map(i => i.bloco).join('\n---\n');

    // 2. CHAMADA API COM TRATAMENTO DE RATE LIMIT
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `Você é o suporte da Casa das Resistências. 
            Responda usando o CONTEXTO: ${contexto || "Use seu conhecimento geral sobre resistências industriais."}
            Seja técnico. Se o cliente perguntar "quais?" ou "tem tal modelo?", olhe o contexto enviado.` 
          },
          ...messages.slice(-5) // Manda as últimas 5 mensagens para manter o papo
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    // Se a Groq chiar por causa da velocidade
    if (data.error) {
      if (data.error.code === 'rate_limit_exceeded') {
        return NextResponse.json({ content: "Estou processando muitas informações! Pode repetir em 5 segundos? ⚡" });
      }
      throw new Error(data.error.message);
    }

    return NextResponse.json({ content: data.choices[0].message.content });

  } catch (error) {
    console.error("ERRO:", error);
    // Retorno amigável para o usuário não ver "Erro Interno"
    return NextResponse.json({ content: "Tive um soluço técnico aqui. Mas pode continuar, o que você precisava sobre essa resistência?" });
  }
}