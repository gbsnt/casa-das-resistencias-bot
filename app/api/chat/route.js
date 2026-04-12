import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Variável global para não ler o arquivo do zero toda vez
let cacheConteudo = null;

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;

    // 1. LER O ARQUIVO (SÓ UMA VEZ)
    if (!cacheConteudo) {
      const filePath = path.join(process.cwd(), 'conhecimento.txt');
      cacheConteudo = fs.readFileSync(filePath, 'utf8').split('\n\n');
    }

    // 2. BUSCA POR PALAVRAS-CHAVE (MELHORADA)
    const palavrasChave = ultimaMensagem.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Tira acentos
      .split(' ')
      .filter(p => p.length > 2); // Busca até palavras curtas como "IHM"

    const blocosRelevantes = cacheConteudo.map(bloco => {
      let score = 0;
      const blocoLower = bloco.toLowerCase();
      palavrasChave.forEach(p => { if (blocoLower.includes(p)) score++; });
      return { bloco, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Pega os 8 melhores para não estourar o limite de tokens

    const contexto = blocosRelevantes.map(i => i.bloco).join('\n---\n');

    // 3. CHAMADA API GROQ (COM MODELO NOVO)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Modelo mais estável e inteligente
        messages: [
          { 
            role: "system", 
            content: `Você é o Suporte Técnico da Casa das Resistências. 
            Responda de forma técnica, objetiva e use APENAS o contexto abaixo.
            Se não encontrar a resposta no contexto, diga que não localizou no catálogo e peça para o cliente enviar uma foto da etiqueta da resistência.
            
            CONTEXTO:
            ${contexto || "Não foram encontrados dados específicos no catálogo."}` 
          },
          { role: "user", content: ultimaMensagem }
        ],
        temperature: 0.1, // Quase zero criatividade (Pé no chão)
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (data.error) {
      // Se a Groq der erro de limite, a gente avisa o usuário
      const msgErro = data.error.code === 'rate_limit_exceeded' 
        ? "Muitas perguntas seguidas! Aguarde 1 minuto." 
        : "Erro na IA: " + data.error.message;
      return NextResponse.json({ content: msgErro }, { status: 200 });
    }

    return NextResponse.json({ 
      content: data.choices[0].message.content,
      model: "Llama 3.3-70B"
    });

  } catch (error) {
    console.error("ERRO NO BACKEND:", error);
    return NextResponse.json({ content: "⚠️ Tive um pequeno problema técnico. Pode repetir?" }, { status: 200 });
  }
}