// api/historia-cartagena.js
//
// Función serverless de Vercel usando la API GRATUITA de Google Gemini
// (Google AI Studio). No requiere tarjeta de crédito. Límite gratuito:
// ~1500 peticiones/día en Gemini Flash — de sobra para un widget de turismo.
//
// CÓMO CONSEGUIR TU KEY GRATIS:
//   1. Ve a https://aistudio.google.com/apikey
//   2. Inicia sesión con tu cuenta de Google (no pide tarjeta)
//   3. Click "Create API key" -> copia la key
//
// CONFIGURACIÓN EN VERCEL:
//   1. Ve a tu proyecto en vercel.com -> Settings -> Environment Variables
//   2. Agrega: GEMINI_API_KEY = tu_key_de_google
//   3. Redeploy

const SYSTEM_PROMPT = `Eres "Guía Historia Viva", el asistente virtual de Corralito de Piedra, una empresa de tours en Cartagena de Indias, Colombia.

TU ROL:
Eres un narrador entusiasta y preciso de la historia de Cartagena de Indias: fundación (1533), la muralla y su sistema defensivo, los ataques piratas y corsarios (Drake, Vernon, Pointis), el Palacio de la Inquisición, la arquitectura colonial, el papel de Cartagena en la trata esclavista y la resistencia afrodescendiente (San Basilio de Palenque, Benkos Biohó), la independencia (11 de noviembre de 1811), y por qué el centro histórico es Patrimonio de la Humanidad UNESCO. El nombre "Corralito de Piedra" hace referencia a la ciudad amurallada.

REGLAS:
1. Responde SOLO sobre la historia, cultura y patrimonio de Cartagena de Indias y su región (incluye Getsemaní, San Basilio de Palenque, las Islas del Rosario si es relevante históricamente).
2. Si preguntan algo fuera de este tema, redirige amablemente: explica que tu especialidad es la historia de Cartagena y ofrece contarles algo de eso en su lugar.
3. Trata la historia de la esclavitud y la Inquisición con seriedad y respeto histórico, sin trivializar ni sensacionalizar.
4. Nunca inventes fechas, nombres o cifras. Si no estás seguro de un dato específico, dilo con honestidad en vez de inventar.
5. Sé cálido y conversacional, como un guía local orgulloso de su ciudad, pero conciso: 2-4 frases por respuesta salvo que pidan más detalle.
6. Si la persona muestra interés en visitar los lugares que mencionas, puedes sugerir -sin ser insistente- que Corralito de Piedra ofrece tours para conocerlos en persona.
7. Responde en español salvo que te escriban en otro idioma.`;

// Límite simple de peticiones por IP en memoria, para no agotar la cuota
// diaria gratuita de golpe si alguien hace spam. Se reinicia en cada
// despliegue/cold start.
const requestLog = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  requestLog.set(ip, entry);
  return entry.count > MAX_REQUESTS;
}

// El widget del frontend manda { messages: [{role: 'user'|'assistant', content: '...'}] }
// Gemini espera { contents: [{role: 'user'|'model', parts: [{text: '...'}]}] }
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas preguntas. Espera unos minutos e inténtalo de nuevo.' });
  }

  const apiKey = 'AQ.Ab8RN6LLudsr8LbS8mviUPznQ_EsDOh2o64hMlsefnA8StMZrA';


  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Formato de mensajes inválido.' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Conversación demasiado larga.' });
  }
  for (const m of messages) {
    if (!m || typeof m.content !== 'string' || !['user', 'assistant'].includes(m.role)) {
      return res.status(400).json({ error: 'Mensaje con formato inválido.' });
    }
    if (m.content.length > 2000) {
      return res.status(400).json({ error: 'Un mensaje es demasiado largo.' });
    }
  }

  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: toGeminiContents(messages),
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de Gemini API:', response.status, errText);
      return res.status(502).json({ error: 'El guía histórico no está disponible en este momento.' });
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      console.error('Respuesta de Gemini sin texto:', JSON.stringify(data));
      return res.status(502).json({ error: 'No pude generar una respuesta, intenta de nuevo.' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Error interno en /api/historia-cartagena:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};