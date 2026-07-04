import knowledgeBase from '../knowledge-base.json';
import { buildContextPrompt, retrieveRelevantChunks } from './retrieval.js';

const SYSTEM_PROMPT = [
  'Sos el asistente de la documentación de la API de Terceros de SIMA (plataforma AgTech).',
  'Respondé en español, de forma clara y concisa, orientado a desarrolladores que integran ERPs o software agropecuario.',
  'Usá SOLO la información del contexto proporcionado. Si no tenés datos suficientes, decilo y sugerí contactar a soporte@sima.ag.',
  'Cuando cites endpoints, incluí método HTTP y ruta. Mencioná entornos QA (api.qa.sima.ag) y Producción (api.sima.ag) cuando aplique.',
  'Al final, listá las fuentes consultadas con sus URLs en una sección "Fuentes:".',
].join('\n');

const ALLOWED_ORIGINS = [
  'https://docs.tp.sima.ag',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    return true;
  }

  return /\.mintlify\.(app|dev|site)$/.test(origin) || origin.endsWith('.mintlify.app');
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Assistant-Key',
    'Access-Control-Max-Age': '86400',
  };

  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function jsonResponse(body, status, origin) {
  const headers = corsHeaders(origin);
  headers['Content-Type'] = 'application/json';

  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function toGeminiRole(role) {
  return role === 'assistant' ? 'model' : 'user';
}

function buildGeminiPayload(env, messages) {
  const systemMessage = messages.find(function (m) {
    return m.role === 'system';
  });
  const conversation = messages
    .filter(function (m) {
      return m.role === 'user' || m.role === 'assistant';
    })
    .map(function (m) {
      return {
        role: toGeminiRole(m.role),
        parts: [{ text: m.content }],
      };
    });

  const payload = {
    contents: conversation,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000,
    },
  };

  if (systemMessage) {
    payload.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  return payload;
}

async function callGemini(env, messages) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    model +
    ':generateContent?key=' +
    encodeURIComponent(env.GEMINI_API_KEY);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGeminiPayload(env, messages)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Gemini error ' + response.status + ': ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  const text = data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text;
}

function validateSecret(env, request) {
  if (!env.ASSISTANT_SECRET) {
    return true;
  }

  const provided = request.headers.get('X-Assistant-Key');
  return provided === env.ASSISTANT_SECRET;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', chunks: knowledgeBase.chunkCount }, 200, origin);
    }

    if (url.pathname === '/chat' && request.method === 'POST') {
      return handleChat(request, env, origin);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
};

async function handleChat(request, env, origin) {
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
  }

  if (!validateSecret(env, request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }

  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'Assistant not configured' }, 503, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
  }

  const message = (body.message || '').trim();
  if (!message || message.length > 2000) {
    return jsonResponse({ error: 'Message required (max 2000 chars)' }, 400, origin);
  }

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const chunks = retrieveRelevantChunks(knowledgeBase, message, 6);
  const context = buildContextPrompt(chunks);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: 'Contexto de documentación:\n\n' + context,
    },
  ];

  history.forEach(function (turn) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: String(turn.content).slice(0, 4000) });
    }
  });

  messages.push({ role: 'user', content: message });

  try {
    const answer = await callGemini(env, messages);
    const sources = chunks.map(function (chunk) {
      return { title: chunk.title + ' — ' + chunk.heading, url: chunk.url };
    });

    return jsonResponse({ answer: answer, sources: sources }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: 'Assistant error', detail: e.message }, 500, origin);
  }
}
