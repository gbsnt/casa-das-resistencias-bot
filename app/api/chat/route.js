import { NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/prompt';

export async function POST(req) {
  try {
    const { messages, productName } = await req.json();
    const ultimaPergunta = messages[messages.length - 1]?.content || "";

    // 💡 O Prompt agora é focado 100% no atendimento comercial do produto escolhido
    const systemPrompt = buildSystemPrompt(productName || "Resistência Industrial");
    
    // Chamada rápida à IA (Groq Llama 3.1)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-4)], // Lembra das últimas 4 falas do orçamento
        temperature: 0.3 // Um pouco de temperatura para a conversa fluir natural
      })
    });

    if (!response.ok) throw new Error("Erro na IA");

    const data = await response.json();
    const respostaFinal = data.choices[0].message.content;
    const tokens = data.usage?.total_tokens || 0;

    return NextResponse.json({ content: respostaFinal, tokens });

  } catch (e) {
    console.error("Erro na central comercial:", e);
    return NextResponse.json({ content: "Sistema comercial indisponível no momento. [OPCOES: Tentar Novamente]" });
  }
}