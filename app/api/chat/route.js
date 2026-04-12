import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { messages, provider } = await req.json();
    const ultimaMensagem = messages[messages.length - 1].content.toLowerCase();

    // 1. LER O ARQUIVO LOCAL (8.000 LINHAS)
    const filePath = path.join(process.cwd(), 'conhecimento.txt');
    const conteúdoCompleto = fs.readFileSync(filePath, 'utf8');
    
    // 2. QUEBRAR EM BLOCOS (PARÁGRAFOS)
    const blocos = conteúdoCompleto.split('\n\n');

    // 3. BUSCA SIMPLES (FILTRO DE RELEVÂNCIA)
    // Vamos pegar as palavras da pergunta do usuário
    const termosBusca = ultimaMensagem.split(' ').filter(p => p.length > 3);
    
    // Filtra os blocos que contêm os termos buscados
    const blocosRelevantes = blocos.filter(bloco => {
      const blocoMinusculo = bloco.toLowerCase();
      return termosBusca.some(termo => blocoMinusculo.includes(termo));
    });

    // Pega apenas os 10 primeiros blocos para não estourar o limite de tokens
    const contextoReduzido = blocosRelevantes.slice(0, 15).join('\n\n');

    // 4. MONTAR O PROMPT PARA A IA
    const systemPrompt = `
      Você é o suporte técnico da Casa das Resistências. 
      Use o CONTEXTO abaixo para responder o cliente de forma técnica e prestativa.
      Se a informação não estiver no contexto, use seu conhecimento geral sobre resistências elétricas industriais.

      CONTEXTO:
      ${contextoReduzido || "Nenhuma informação específica encontrada no catálogo, use seu conhecimento geral."}
    `;

    // 5. CHAMADA PARA A IA (GROQ OU GEMINI)
    let respostaFinal = "";
    let modeloNome = "";

    if (provider === 'gemini') {
      // Exemplo rápido com fetch direto para o Gemini
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nPergunta: " + ultimaMensagem }] }]
        })
      });
      const data = await res.json();
      respostaFinal = data.candidates[0].content.parts[0].text;
      modeloNome = "Gemini 1.5 Flash (Local Search)";
    } else {
      // Lógica similar para Groq...
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ]
        })
      });
      const data = await res.json();
      respostaFinal = data.choices[0].message.content;
      modeloNome = "Llama 3.1 (Local Search)";
    }

    return NextResponse.json({ content: respostaFinal, model_usado: modeloNome });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao processar suporte local." }, { status: 500 });
  }
}