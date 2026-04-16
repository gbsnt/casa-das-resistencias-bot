import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const criarResumo = (texto, nomeProduto) => {
  if (!texto) return "Descrição não disponível.";
  const linhas = texto.split('\n');
  let resumoReal = "";
  const nomeLimpo = nomeProduto ? nomeProduto.toLowerCase().trim() : "";
  
  for (let linha of linhas) {
    const linhaTrim = linha.trim();
    if (!linhaTrim || linhaTrim.startsWith('#')) continue;
    
    const textoPuro = linhaTrim.replace(/[#*`|_]/g, "").trim();
    const textoLower = textoPuro.toLowerCase();
    
    if (
      textoPuro.length < 20 || 
      textoLower.includes("categoria:") || 
      textoLower.includes("linha:") ||
      textoLower === "descrição" ||
      textoLower === "descricao" ||
      (textoLower.includes(nomeLimpo) && textoPuro.length < (nomeLimpo.length + 15))
    ) {
      continue;
    }
    resumoReal = textoPuro;
    break; 
  }
  // Limite aumentado de 140 para 220 caracteres para um resumo mais rico
  return resumoReal ? resumoReal.substring(0, 220) + "..." : "Descrição detalhada na ficha técnica.";
};

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
    const termoNormalizado = normalizar(query);
    
    const termoSemPlural = termoNormalizado.length > 3 && termoNormalizado.endsWith('s') 
      ? termoNormalizado.slice(0, -1) 
      : termoNormalizado;

    const palavrasBusca = termoNormalizado.split(/\s+/).filter(p => p.length > 2);
    if (!palavrasBusca.includes(termoSemPlural) && termoSemPlural.length > 2) {
      palavrasBusca.push(termoSemPlural);
    }
    
    // --- 1. BUSCA MANUAL SUPER RÁPIDA ---
    let resultadosRanqueados = catalog.map(p => {
      let score = 0;
      const nomeObj = normalizar(p?.metadata?.nome);
      const idObj = normalizar(p?.id);
      const linhaObj = normalizar(p?.metadata?.linha);
      const tagsObj = (p?.metadata?.tags || []).map(t => normalizar(t));
      const descObj = normalizar(p?.content);

      palavrasBusca.forEach(palavra => {
        if (idObj === palavra || nomeObj.split(/\s+/).includes(palavra)) score += 20;
        if (idObj.includes(palavra)) score += 10;
        if (nomeObj.includes(palavra)) score += 5;
        if (linhaObj.includes(palavra)) score += 5;
        if (tagsObj.some(t => t === palavra)) score += 8;
        if (tagsObj.some(t => t.includes(palavra))) score += 2;
        if (descObj.includes(palavra)) score += 1; 
      });

      return { ...p, score };
    })
    .filter(p => p.score >= 5) 
    .sort((a, b) => b.score - a.score);

    // 🚀 BYPASS INTELIGENTE: Se a busca local achou perfeitamente (Score >= 10), não gasta a IA!
    if (resultadosRanqueados.length > 0 && resultadosRanqueados[0].score >= 10) {
       console.log("⚡ Bypass Ativado: Busca direta resolvida em ms.");
       return NextResponse.json({ 
        resultados: resultadosRanqueados.map(p => ({
          id: p.id, 
          nome: p.metadata.nome, 
          linha: p.metadata.linha, 
          texto: p.content,
          descricaoCurta: criarResumo(p.content, p.metadata.nome)
        })) 
      });
    }

    // --- 2. TENTATIVA COM IA (SÓ ACORDA QUANDO NECESSÁRIO) ---
    try {
      console.log("🧠 Acordando a IA para interpretar o termo complexo...");
      const catalogoParaIA = catalog.map(p => ({
        id: p.id,
        nome: p?.metadata?.nome || "",
        tags: (p?.metadata?.tags || []).slice(0, 4),
        descricao: p?.content ? p.content.substring(0, 150).replace(/\n/g, ' ') : ""
      }));

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ 
          role: 'system', 
          content: `Você é um engenheiro sênior de aquecimento industrial.
          SUA MISSÃO: Cruze a necessidade com o NOME, TAGS e a DESCRIÇÃO.
          REGRA: Para "Galvanoplastia" ou "Banho", escolha apenas "Imersão".
          SAÍDA OBRIGATÓRIA: Responda APENAS com um array JSON de "id". Sem texto.` 
        }, { 
          role: 'user', 
          content: `Busca: "${query}". \nCatálogo: ${JSON.stringify(catalogoParaIA)}` 
        }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1, 
        max_tokens: 300,
      });

      const responseText = chatCompletion.choices[0].message.content;
      const match = responseText.match(/\[.*\]/s);
      
      if (match) {
        const idsIA = JSON.parse(match[0]);
        const resultadosIA = catalog.filter(p => idsIA.includes(p.id));

        const mapaGeral = new Map();
        const formatar = (p) => ({
          id: p.id, nome: p.metadata.nome, linha: p.metadata.linha, texto: p.content,
          descricaoCurta: criarResumo(p.content, p.metadata.nome)
        });

        resultadosIA.forEach(p => mapaGeral.set(p.id, formatar(p)));
        resultadosRanqueados.forEach(p => {
          if (!mapaGeral.has(p.id)) mapaGeral.set(p.id, formatar(p));
        });
        
        return NextResponse.json({ resultados: Array.from(mapaGeral.values()) });
      }
    } catch (e) {
      console.warn("⚠️ IA offline ou no limite.");
    }

    return NextResponse.json({ 
      resultados: resultadosRanqueados.map(p => ({
        id: p.id, nome: p.metadata.nome, linha: p.metadata.linha, texto: p.content,
        descricaoCurta: criarResumo(p.content, p.metadata.nome)
      })) 
    });

  } catch (error) {
    console.error("Erro crítico na API de busca:", error);
    return NextResponse.json({ resultados: [] });
  }
}