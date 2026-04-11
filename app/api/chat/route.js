import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const normalizarTexto = (texto) => {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export async function POST(req) {
  try {
    const { messages, language, provider = 'groq' } = await req.json();

    // Pegamos APENAS a última mensagem para a busca. 
    // Isso evita que ele misture "Túnel de Ar" com "Mel" se você mudar de assunto.
    const ultimaMensagemCliente = normalizarTexto(messages[messages.length - 1].content);
    
    const palavrasIgnoradas = ['quero', 'queria', 'gostaria', 'preciso', 'aquecer', 'esquentar', 'fazer', 'para', 'com', 'que', 'qual', 'quais', 'voces', 'vocês', 'tem', 'temos', 'uma', 'um', 'modelo', 'modelos', 'sobre', 'aplicacao', 'liste', 'opcoes', 'como', 'posso', 'ajudar', 'resistencia', 'resistencias', 'nao', 'de', 'do', 'da', 'ola', 'bom', 'dia', 'tarde', 'noite', 'saber', 'mais', 'errado', 'certo', 'ta'];
    
    const palavrasChave = ultimaMensagemCliente
      .split(/\s+/)
      .map(p => p.replace(/[^\w-]/g, '')) 
      .filter(palavra => palavra.length > 2 && !palavrasIgnoradas.includes(palavra));

    let trechosRelevantes = '';
    const palavrasUnicas = [...new Set(palavrasChave)];

    if (palavrasUnicas.length > 0) {
      try {
        const filePath = path.join(process.cwd(), 'conhecimento.txt');
        const arquivoCompleto = fs.readFileSync(filePath, 'utf8');
        const paragrafos = arquivoCompleto.split('\n\n'); 
        
        const paragrafosComScore = paragrafos.map(paragrafo => {
          const textoNorm = normalizarTexto(paragrafo);
          let score = 0;
          palavrasUnicas.forEach(palavra => {
            // Damos peso extra se a palavra exata for encontrada
            if (textoNorm.includes(palavra)) score += 2; 
          });
          return { textoOriginal: paragrafo, score: score };
        });

        // Pegamos os 4 parágrafos mais relevantes
        const paragrafosTop = paragrafosComScore
          .filter(p => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map(p => p.textoOriginal);

        trechosRelevantes = paragrafosTop.join('\n\n');
      } catch (err) {
        console.error('Erro ao ler conhecimento.txt:', err);
      }
    }

    if (palavrasUnicas.length > 0 && trechosRelevantes.trim() === '') {
      return NextResponse.json({
        content: "Não encontrei as especificações exatas para esse pedido no meu catálogo online. Por favor, consulte nossos vendedores.",
        model_usado: 'Busca Direta do Sistema'
      });
    }

    let regrasDeAtendimento = '';
    if (palavrasUnicas.length === 0) {
      regrasDeAtendimento = `O cliente enviou uma saudação. Seja educado e pergunte qual resistência INDUSTRIAL ele procura. NUNCA invente modelos.`;
    } else {
      regrasDeAtendimento = `Você é o assistente técnico sênior da Casa das Resistências.
CATÁLOGO ENCONTRADO PARA A PERGUNTA:
${trechosRelevantes}

REGRAS RÍGIDAS:
1. Baseie sua resposta ESTRITAMENTE no catálogo acima.
2. Se a aplicação do cliente (ex: "mel", "ar", "injetora") não combinar com os produtos do catálogo acima, diga que não encontrou o produto. NUNCA sugira um produto para a aplicação errada.
3. Não liste variações que não estejam escritas no texto.
4. Seja altamente técnico, direto e profissional.`;
    }

    // =========================================================================
    // TRILHO DO GOOGLE GEMINI (Corrigido o nome do modelo para -latest)
    // =========================================================================
    if (provider === 'gemini') {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) return NextResponse.json({ error: 'Chave GEMINI não encontrada' }, { status: 500 });

      const mensagensGoogle = messages
        .filter(m => !m.content.startsWith('⚠️'))
        .slice(-6)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const response = await fetch(
       `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: mensagensGoogle,
            systemInstruction: { parts: [{ text: regrasDeAtendimento }] },
            generationConfig: { temperature: 0.1 }
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message }, { status: response.status });

      return NextResponse.json({
        content: data.candidates[0].content.parts[0].text,
        model_usado: 'Google Gemini 1.5 Flash'
      });

    } else {
      // =========================================================================
      // TRILHO DA GROQ (De volta para o modelo 70B de gênio!)
      // =========================================================================
      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      if (!GROQ_API_KEY) return NextResponse.json({ error: 'Chave GROQ não encontrada' }, { status: 500 });

      const mensagensLimpas = messages
        .filter(m => !m.content.startsWith('⚠️'))
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const systemInstruction = { role: 'system', content: regrasDeAtendimento };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // <-- DE VOLTA AO INTELIGENTE
          messages: [systemInstruction, ...mensagensLimpas],
          temperature: 0.1
        }),
      });

      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data.error?.message }, { status: response.status });

      return NextResponse.json({
        content: data.choices[0].message.content,
        model_usado: 'Llama 3.3 70B (Sênior)'
      });
    }

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}