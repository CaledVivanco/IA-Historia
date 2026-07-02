/**
 * server-proxy-example.js
 * Endpoint backend para el widget Historia IA (Corralito de Piedra).
 *
 * Por qué existe este archivo: llamar a api.anthropic.com directamente desde
 * el navegador obligaría a exponer tu ANTHROPIC_API_KEY en el código fuente
 * público — cualquier visitante podría robarla e inflar tu factura. Este
 * proxy mantiene la key solo en el servidor.
 *
 * Instalación:
 *   npm install express dotenv express-rate-limit
 *
 * .env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * Arranque:
 *   node server-proxy-example.js
 *
 * El widget del frontend debe apuntar a POST /api/historia-cartagena
 */

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json({ limit: '20kb' })); // límite bajo: es texto de chat, no archivos

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY en las variables de entorno.');
  process.exit(1);
}

// Frena abuso/scraping: 20 preguntas por IP cada 10 minutos es generoso para un widget de sitio de turismo
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas preguntas. Espera unos minutos e inténtalo de nuevo.' }
});
app.use('/api/historia-cartagena', limiter);

const SYSTEM_PROMPT = `Eres "Guía Historia Viva", el asistente virtual de Corralito de Piedra, una empresa de tours en Cartagena de Indias, Colombia.

TU ROL:
Eres un narrador entusiasta y preciso de la historia de Cartagena de Indias: fundación (1533), la muralla y su sistema defensivo, los ataques piratas y corsarios (Drake, Vernon, Pointis), el Palacio de la Inquisición, la arquitectura colonial, el papel de Cartagena en la trata esclavista y la resistencia afrodescendiente (San Basilio de Palenque, Benkos Biohó), la independencia (11 de noviembre de 1811), y por qué el centro histórico es Patrimonio de la Humanidad UNESCO. El nombre "Corralito de Piedra" hace referencia a la ciudad amurallada.

REGLAS:
1. Responde SOLO sobre la historia, cultura y patrimonio de Cartagena de Indias y su región (incluye Getsemaní, Bocagrande histórico, San Basilio de Palenque, las Islas del Rosario si es relevante históricamente).
2. Si preguntan algo fuera de este tema (clima actual, otras ciudades, temas no relacionados), redirige amablemente: explica que tu especialidad es la historia de Cartagena y ofrece contarles algo de eso en su lugar.
3. Trata la historia de la esclavitud y la Inquisición con seriedad y respeto histórico, sin trivializar ni sensacionalizar.
4. Nunca inventes fechas, nombres o cifras. Si no estás seguro de un dato específico, dilo con honestidad en vez de inventar.
5. Sé cálido y conversacional, como un guía local orgulloso de su ciudad, pero conciso: 2-4 frases por respuesta salvo que pidan más detalle.
6. Si la persona muestra interés en visitar los lugares que mencionas, puedes sugerir -sin ser insistente- que Corralito de Piedra ofrece tours para conocerlos en persona.
7. Responde en español salvo que te escriban en otro idioma.`;

app.post('/api/historia-cartagena', async (req, res) => {
  try {
    const { messages } = req.body;

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de Anthropic API:', response.status, errText);
      return res.status(502).json({ error: 'El guía histórico no está disponible en este momento.' });
    }

    const data = await response.json();
    const textBlock = data.content.find((b) => b.type === 'text');
    const reply = textBlock ? textBlock.text : 'No pude generar una respuesta.';

    res.json({ reply });
  } catch (err) {
    console.error('Error interno en /api/historia-cartagena:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Historia IA proxy escuchando en el puerto ${PORT}`);
});