import { NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/prompt';

export async function POST(req) {
  let contextoTécnico = "";
  let respostaFinal = "";
  let tokenCount = 0;

  try {
    const { messages, aiMode } = await req.json();
    const ultimaPergunta = messages[messages.length - 1]?.content || "";
    
    // 💡 MEMÓRIA ZERO: A IA não pode saber o que foi dito antes para não confundir produtos.
    const msgUnica = [{ role: "user", content: ultimaPergunta }];

    try {
      const resEmbed = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: { 'Api-Key': process.env.PINECONE_API_KEY, 'Content-Type': 'application/json', 'X-Pinecone-Api-Version': '2024-10' },
        body: JSON.stringify({ model: 'multilingual-e5-large', inputs: [{ text: ultimaPergunta }], parameters: { input_type: 'query' } })
      });
      const embedData = await resEmbed.json();
      const vector = embedData.data?.[0]?.values;

      if (vector) {
        const resQuery = await fetch('https://catalogo-casa-yev3st4.svc.aped-4627-b74a.pinecone.io/query', {
          method: 'POST',
          headers: { 'Api-Key': process.env.PINECONE_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ vector, topK: 3, includeMetadata: true })
        });
        const queryData = await resQuery.json();
        // 🎯 Score mais baixo (0.35) para permitir que siglas como C-S90 tragam dados, mas com filtro de limpeza.
        contextoTécnico = queryData.matches?.filter(m => m.score > 0.35).map(m => m.metadata.text).join('\n---\n');
      }
    } catch (e) { console.error("RAG Down"); }

    const systemFinal = buildSystemPrompt(contextoTécnico);

    const models = [
      { id: "llama-3.3-70b-versatile", provider: "groq" },
      { id: "llama-3.1-8b-instant", provider: "groq" },
      { id: "gemini-1.5-flash", provider: "google" }
    ];

    for (const model of models) {
      try {
        let response;
        if (model.provider === "groq") {
          response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model.id, messages: [{ role: "system", content: systemFinal }, ...msgUnica], temperature: 0 })
          });
        } else {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: ultimaPergunta }] }],
              systemInstruction: { parts: [{ text: systemFinal }] },
              generationConfig: { temperature: 0 }
            })
          });
        }

        const data = await response.json();
        if (response.ok) {
          respostaFinal = model.provider === "groq" ? data.choices[0].message.content : data.candidates[0].content.parts[0].text;
          tokenCount = (model.provider === "groq" ? data.usage?.total_tokens : data.usageMetadata?.totalTokenCount) || 0;
          break;
        }
      } catch (e) { continue; }
    }

    return NextResponse.json({ content: respostaFinal || "Erro na consulta técnica.", tokens: tokenCount });
  } catch (error) { return NextResponse.json({ content: "Sistema indisponível." }); }
}