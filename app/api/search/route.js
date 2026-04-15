import { NextResponse } from 'next/server';
// 1️⃣ MUDANÇA AQUI: Importamos a função que busca no Notion em vez do array fixo
import { getCatalog } from '@/lib/catalog';

// Normalizador de segurança (para o fallback)
const normalize = (text) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export async function POST(req) {
  // 2️⃣ MUDANÇA AQUI: Carregamos o catálogo do Notion (usando o cache para ser instantâneo)
  const fullCatalog = await getCatalog();

  let query = "";
  try {
    query = (await req.json()).query || "";
  } catch (e) {
    return NextResponse.json({ resultados: [] });
  }

  if (!query) return NextResponse.json({ resultados: [] });

  console.log(`🔎 IA Nano-Search analisando: "${query}"`);

  try {
    // Daqui para baixo, o código é EXATAMENTE o mesmo que você colou!
    const nanoCatalog = fullCatalog.map(p => 
      `[${p.id}] ${p.metadata.nome.replace('Resistência ', '')}`
    ).join(" | ");

    const systemPrompt = `Você é um motor de busca B2B de peças industriais.
CATÁLOGO DISPONÍVEL:
${nanoCatalog}

Sua tarefa: Identificar a intenção do usuário e retornar os IDs dos produtos que resolvem o problema dele.
REGRAS:
1. Pense no processo. Se ele falar "injetora", indique Cartuchos (C-S) e Coleiras (CO). Se falar "zamac", indique a linha FZ. Se falar "água/óleo", indique Imersão (IFR).
2. Retorne APENAS um JSON no formato exato: {"ids": ["ID1", "ID2"]}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Pesquisa: "${query}"` }
        ],
        response_format: { type: "json_object" },
        temperature: 0, 
        max_tokens: 60
      })
    });

    if (!response.ok) throw new Error("Groq Rate Limit ou Indisponibilidade");

    const data = await response.json();
    const matchedIds = JSON.parse(data.choices[0].message.content).ids || [];

    console.log(`🧠 IA relacionou a pesquisa com os IDs:`, matchedIds);

    let resultados = fullCatalog
      .filter(p => matchedIds.includes(p.id))
      .map(p => ({
        id: p.id,
        nome: p.metadata.nome,
        linha: p.metadata.linha,
        texto: p.content 
      }));

    if (resultados.length > 0) return NextResponse.json({ resultados });
    throw new Error("Zero matches na IA");

  } catch (error) {
    console.log(`⚠️ Acionando busca local rápida para: "${query}"`);
    const qNorm = normalize(query);
    const termos = qNorm.split(' ').filter(t => t.length > 2);
    
    let resultadosManuais = fullCatalog.filter(p => {
      // ⚠️ CUIDADO: Se no Notion você não tiver "tags", precisamos garantir que não dê erro aqui
      const tagsString = p.metadata.tags ? p.metadata.tags.join(" ") : "";
      const dadosProduto = normalize(`${p.id} ${p.metadata.nome} ${tagsString}`);
      
      return termos.every(termo => dadosProduto.includes(termo));
    }).map(p => ({
      id: p.id,
      nome: p.metadata.nome,
      linha: p.metadata.linha,
      texto: p.content
    })).slice(0, 8);

    return NextResponse.json({ resultados: resultadosManuais });
  }
}