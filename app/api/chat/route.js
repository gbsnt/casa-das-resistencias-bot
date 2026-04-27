export const runtime = 'nodejs';
import { promises as fs } from 'fs';
import path from 'path';

// IMPORTANTE: Em Next.js App Router, usamos export nomeado (POST) e NUNCA export default.
export async function POST(req) {
  try {
    const { messages, language = "português", isIntro } = await req.json();
    const lastMessage = messages[messages.length - 1].content;
    
    const groqKey = process.env.GROQ_API_KEY;
    const apiKey = process.env.GEMINI_API_KEY; 

    // 1. CARREGA O ARQUIVO DE CONHECIMENTO
    const filePath = path.join(process.cwd(), 'conhecimento.txt');
    let textoCompleto = "";
    try {
      textoCompleto = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      return Response.json({ error: "Arquivo conhecimento.txt não encontrado." }, { status: 404 });
    }

    // 2. MOTOR DE BUSCA (MINI-RAG)
    const secoes = textoCompleto.split(/(?=# )/g); 
    const termosBusca = lastMessage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ').filter(word => word.length > 2); 

    const secoesRelevantes = secoes.map(secao => {
      let score = 0; const secaoLimpa = secao.toLowerCase();
      termosBusca.forEach(termo => { if (secaoLimpa.includes(termo)) score++; });
      return { secao, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.secao).join('\n\n');

    const contextoFinal = secoesRelevantes.length > 50 ? secoesRelevantes : textoCompleto.substring(0, 1500);

    // 3. PROMPT DINÂMICO
    let systemPrompt = "";

    if (isIntro) {
      systemPrompt = `
        Você é o Consultor Técnico da Casa das Resistências. 
        Sua tarefa é introduzir os produtos para a busca: "${lastMessage}".
        
        REGRAS DE FORMATAÇÃO:
        1. Divida o texto em exatamente 2 parágrafos.
        2. IMPORTANTE: Use obrigatoriamente DUAS QUEBRAS DE LINHA (Enter duas vezes) entre os parágrafos para o Markdown entender a separação.
        3. Cada parágrafo deve ter no máximo 3 linhas.
        4. É ESTRITAMENTE PROIBIDO o uso de listas, bullet points ou dois-pontos (:).
        
        CONTEÚDO:
        - Seja técnico, mencione materiais (inox, latão, cerâmica) e benefícios.
        - Encerre o texto OBRIGATORIAMENTE com a frase: "Estes são os produtos que encontramos para a sua aplicação."
        
        BANCO DE DADOS:
        ${contextoFinal}
      `;
    } else {
      systemPrompt = `Você é o Suporte Técnico da Casa das Resistências. Responda em ${language} usando o contexto: ${contextoFinal}`;
    }

    // 4. CHAMADA DA API - FALLBACK
    
    // TENTATIVA 1: GEMINI
    try {
      const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const resGemini = await fetch(urlGemini, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: lastMessage }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } 
        })
      });

      if (resGemini.ok) {
        const dataGemini = await resGemini.json();
        if (dataGemini?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return Response.json({ content: dataGemini.candidates[0].content.parts[0].text });
        }
      }
    } catch (e) { console.warn("Gemini falhou, tentando Groq..."); }

    // TENTATIVA 2: GROQ
    if (groqKey) {
      try {
        const resGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: lastMessage }],
            temperature: 0.2, max_tokens: 1024
          })
        });
        const dataGroq = await resGroq.json();
        if (dataGroq?.choices?.[0]?.message?.content) {
          return Response.json({ content: dataGroq.choices[0].message.content });
        }
      } catch (e) { console.error("Groq falhou também:", e); }
    }

    return Response.json({ error: "Limite de requisições." }, { status: 429 });

  } catch (e) {
    console.error("Erro crítico:", e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}