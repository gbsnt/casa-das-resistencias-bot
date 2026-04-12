import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { messages, provider } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content;

    // 1. LOCALIZAR ARQUIVO
    const filePath = path.join(process.cwd(), 'conhecimento.txt');
    if (!fs.existsSync(filePath)) {
      console.error("❌ Erro: Arquivo conhecimento.txt não encontrado na raiz!");
      return NextResponse.json({ error: "Arquivo de catálogo não encontrado." }, { status: 500 });
    }

    const conteudo = fs.readFileSync(filePath, 'utf8');
    const blocos = conteudo.split('\n\n');

    // 2. BUSCA TÉCNICA
    const palavrasChave = ultimaMensagem.toLowerCase().split(' ').filter(p => p.length > 3);
    const blocosRanqueados = blocos.map(bloco => {
      let score = 0;
      const blocoLower = bloco.toLowerCase();
      palavrasChave.forEach(p => { if (blocoLower.includes(p)) score++; });
      return { bloco, score };
    }).filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

    const contextoFinal = blocosRanqueados.map(i => i.bloco).join('\n---\n');

    // 3. CHAMADA API (USANDO MODELO ATUALIZADO)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Nome mais atual da Groq
        messages: [
          { 
            role: "system", 
            content: `Você é o suporte da Casa das Resistências. Use o CONTEXTO: ${contextoFinal}. Responda tecnicamente. Se não souber, peça mais detalhes.` 
          },
          { role: "user", content: ultimaMensagem }
        ],
        temperature: 0.1
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error("❌ Erro da API da Groq:", data.error.message);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      content: data.choices[0].message.content, 
      model_usado: "Llama 3.3 (Busca Local)" 
    });

  } catch (error) {
    console.error("❌ ERRO NO BACKEND:", error.message);
    return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
  }
}