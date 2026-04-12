import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cacheConteudo = null;

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;
    
    if (!cacheConteudo) {
      const filePath = path.join(process.cwd(), 'conhecimento.txt');
      cacheConteudo = fs.readFileSync(filePath, 'utf8').split('\n\n');
    }

    // 1. BUSCA FOCADA: Prioriza a última pergunta para não misturar produtos
    const limpar = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const termosPrincipais = limpar(ultimaMensagem).split(/\W+/).filter(p => p.length > 3);

    const blocosRelevantes = cacheConteudo.map(bloco => {
      let score = 0;
      const blocoLower = limpar(bloco);
      termosPrincipais.forEach(t => { 
        if (blocoLower.includes(t)) score += 5; // Aumentamos o peso da pergunta atual
      });
      return { bloco, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

    const contexto = blocosRelevantes.map(i => i.bloco).join('\n---\n');

    // 2. PROMPT DE ORGANIZAÇÃO TÉCNICA
    const systemPrompt = `
      Você é o Suporte da Casa das Resistências. 
      NÃO MISTURE PRODUTOS. Se o cliente perguntar de "Cartucho", fale de Cartucho. Se perguntar de "Fundida", fale de Fundida.
      
      CONTEXTO ATUAL:
      ${contexto || "Informação geral sobre resistências industriais."}
      
      REGRAS:
      - Se o contexto trouxer algo diferente do que o usuário pediu, ignore o contexto antigo e foque no novo.
      - Seja direto: dê Nome do Modelo, Aplicação e Temperatura.
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
          ...messages.slice(-3) // Só as últimas 3 mensagens para não confundir a IA
        ],
        temperature: 0.1 // Precisão total, sem inventar
      })
    });

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'rate_limit_exceeded') {
        return NextResponse.json({ content: "Opa, recebi muitas perguntas! Pode repetir essa última em instantes? ⚡" });
      }
      return NextResponse.json({ content: "Tive um soluço técnico. Pode perguntar de novo?" });
    }

    return NextResponse.json({ content: data.choices[0].message.content });

  } catch (error) {
    return NextResponse.json({ content: "Erro ao processar catálogo local." });
  }
}