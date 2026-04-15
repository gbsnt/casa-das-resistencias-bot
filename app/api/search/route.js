import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const normalizar = (texto) => {
  if (!texto) return "";
  return String(texto).toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ resultados: [] });

    const catalog = await getCatalog();
    const palavrasBusca = normalizar(query).split(/\s+/).filter(p => p.length > 2);
    
    // --- 1. BUSCA POR RELEVÂNCIA (Smarter Manual Search) ---
    let resultadosRanqueados = catalog.map(p => {
      let score = 0;
      const nomeObj = normalizar(p?.metadata?.nome);
      const idObj = normalizar(p?.id);
      const linhaObj = normalizar(p?.metadata?.linha);
      const tagsObj = (p?.metadata?.tags || []).map(t => normalizar(t));

      palavrasBusca.forEach(palavra => {
        // Se a palavra exata está no ID (Peso Máximo)
        if (idObj.includes(palavra)) score += 10;
        // Se está no Nome (Peso Alto)
        if (nomeObj.includes(palavra)) score += 5;
        // Se está na Linha (Peso Médio)
        if (linhaObj.includes(palavra)) score += 3;
        // Se está nas Tags (Peso Complementar)
        if (tagsObj.some(t => t.includes(palavra))) score += 2;
      });

      return { ...p, score };
    })
    .filter(p => p.score > 0) // Só traz o que teve algum match
    .sort((a, b) => b.score - a.score) // Os mais relevantes primeiro
    .map(p => ({
      id: p.id,
      nome: p.metadata.nome,
      linha: p.metadata.linha,
      texto: p.content
    }));

    // --- 2. TENTATIVA COM IA (Raciocínio) ---
    try {
      // Se a IA estiver disponível, ela tenta refinar ainda mais a lista
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ 
          role: 'system', 
          content: 'Retorne um array JSON com os IDs mais relevantes para a busca. IDs: ' + JSON.stringify(catalog.map(x => x.id))
        }, { 
          role: 'user', 
          content: query 
        }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
      });

      const responseText = chatCompletion.choices[0].message.content;
      const match = responseText.match(/\[.*\]/s);
      
      if (match) {
        const idsIA = JSON.parse(match[0]);
        const resultadosIA = catalog.filter(p => idsIA.includes(p.id)).map(p => ({
          id: p.id,
          nome: p.metadata.nome,
          linha: p.metadata.linha,
          texto: p.content
        }));

        // Combinamos os dois mundos
        const mapaGeral = new Map();
        [...resultadosIA, ...resultadosRanqueados].forEach(prod => {
          if (!mapaGeral.has(prod.id)) mapaGeral.set(prod.id, prod);
        });
        
        return NextResponse.json({ resultados: Array.from(mapaGeral.values()) });
      }
    } catch (e) {
      console.warn("⚠️ IA Ocupada. Entregando busca por relevância.");
    }

    return NextResponse.json({ resultados: resultadosRanqueados });

  } catch (error) {
    console.error("Erro crítico:", error);
    return NextResponse.json({ resultados: [] });
  }
}