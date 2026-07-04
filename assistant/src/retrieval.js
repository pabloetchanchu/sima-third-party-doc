const STOP_WORDS = new Set([
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra',
  'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'dos', 'el', 'ella', 'ellas',
  'ellos', 'en', 'entre', 'era', 'es', 'esa', 'esas', 'ese', 'eso', 'esos', 'esta',
  'estas', 'este', 'esto', 'estos', 'fue', 'ha', 'han', 'hasta', 'hay', 'la', 'las',
  'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis', 'muy', 'ni', 'no', 'nos', 'o',
  'otra', 'otras', 'otro', 'otros', 'para', 'pero', 'por', 'que', 'se', 'sea', 'ser',
  'si', 'sin', 'sobre', 'su', 'sus', 'te', 'the', 'tu', 'tus', 'un', 'una', 'uno',
  'unos', 'y', 'ya',
]);

const TOKEN_ALIASES = {
  autentico: ['autenticacion', 'authentication', 'login', 'token', 'bearer', 'refresh'],
  autenticar: ['autenticacion', 'authentication', 'login', 'token'],
  autentica: ['autenticacion', 'authentication', 'login', 'token'],
  login: ['login', 'autenticacion', 'authentication', 'token'],
  token: ['token', 'bearer', 'refresh', 'autenticacion', 'authorization'],
  credenciales: ['login', 'password', 'email', 'autenticacion'],
  password: ['login', 'password', 'email', 'autenticacion'],
  endpoint: ['endpoint', 'api', 'route', 'path'],
  endpoints: ['endpoint', 'api', 'route', 'path'],
  limite: ['rate', 'limit', 'limite', 'throttle', '429'],
  limites: ['rate', 'limit', 'limite', 'throttle', '429'],
  orden: ['work', 'order', 'work_orders', 'laboreo'],
  ordenes: ['work', 'order', 'work_orders', 'laboreo'],
  lote: ['plot', 'plots', 'lote', 'lotes'],
  lotes: ['plot', 'plots', 'lote', 'lotes'],
  establecimiento: ['establishment', 'establishments', 'establecimiento'],
  campana: ['campaign', 'campaigns', 'master_campaign'],
  scouting: ['scouting', 'monitoreo', 'adversity'],
  silobolsa: ['silobag', 'silobags', 'silobolsa'],
  demo: ['demo', 'quickstart', 'cuenta'],
};

const SOURCE_KEYWORDS = {
  'authentication.mdx': ['autentic', 'login', 'token', 'bearer', 'refresh', 'authorization'],
  'quickstart.mdx': ['inicio', 'rapido', 'demo', 'primera', 'login', 'quickstart'],
  'api-reference/errors-and-limits.mdx': ['error', 'limite', 'rate', '429', '401', '403'],
  'api-reference/versions.mdx': ['version', 'v1', 'v2', 'v3'],
  'guides/work-orders.mdx': ['work', 'order', 'orden', 'laboreo', 'ot'],
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9_/-]+/g, ' ')
    .split(/\s+/)
    .filter(function (token) {
      return token.length > 2 && !STOP_WORDS.has(token);
    });
}

function expandQueryTokens(queryTokens) {
  const expanded = new Set(queryTokens);

  queryTokens.forEach(function (token) {
    if (TOKEN_ALIASES[token]) {
      TOKEN_ALIASES[token].forEach(function (alias) {
        expanded.add(alias);
      });
    }

    if (token.length >= 5) {
      expanded.add(token.slice(0, 5));
      expanded.add(token.slice(0, 6));
    }

    Object.keys(TOKEN_ALIASES).forEach(function (key) {
      if (token.indexOf(key) === 0 || key.indexOf(token) === 0) {
        TOKEN_ALIASES[key].forEach(function (alias) {
          expanded.add(alias);
        });
      }
    });
  });

  return Array.from(expanded);
}

function getStems(token) {
  const stems = [token];
  if (token.length >= 5) {
    stems.push(token.slice(0, 5));
    stems.push(token.slice(0, 6));
  }
  return stems;
}

function scoreChunk(chunk, queryTokens) {
  const haystack = normalizeText(
    chunk.title + ' ' + chunk.heading + ' ' + chunk.content + ' ' + chunk.source
  );
  const haystackWords = haystack.split(/[^a-z0-9_/-]+/).filter(Boolean);
  let score = 0;

  queryTokens.forEach(function (token) {
    getStems(token).forEach(function (stem) {
      if (stem.length < 4) {
        return;
      }

      if (haystack.indexOf(stem) !== -1) {
        score += 2;
      }

      haystackWords.forEach(function (word) {
        if (word.indexOf(stem) === 0 || stem.indexOf(word) === 0) {
          score += 3;
        }
      });

      if (normalizeText(chunk.heading).indexOf(stem) !== -1) {
        score += 4;
      }

      if (normalizeText(chunk.source).indexOf(stem) !== -1) {
        score += 3;
      }

      if (normalizeText(chunk.title).indexOf(stem) !== -1) {
        score += 3;
      }
    });
  });

  const sourceKeywords = SOURCE_KEYWORDS[chunk.source];
  if (sourceKeywords) {
    sourceKeywords.forEach(function (keyword) {
      queryTokens.forEach(function (token) {
        if (
          token.indexOf(keyword) === 0 ||
          keyword.indexOf(token) === 0 ||
          token.indexOf(keyword.slice(0, 5)) === 0
        ) {
          score += 6;
        }
      });
    });
  }

  return score;
}

export function retrieveRelevantChunks(knowledgeBase, query, limit) {
  const maxResults = limit || 6;
  const queryTokens = expandQueryTokens(tokenize(query));

  if (queryTokens.length === 0) {
    return knowledgeBase.chunks.slice(0, maxResults);
  }

  const ranked = knowledgeBase.chunks
    .map(function (chunk) {
      return { chunk: chunk, score: scoreChunk(chunk, queryTokens) };
    })
    .filter(function (item) {
      return item.score > 0;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });

  if (ranked.length === 0) {
    return knowledgeBase.chunks.slice(0, maxResults);
  }

  return ranked.slice(0, maxResults).map(function (item) {
    return item.chunk;
  });
}

export function buildContextPrompt(chunks) {
  if (chunks.length === 0) {
    return 'No se encontró contexto relevante en la documentación.';
  }

  return chunks
    .map(function (chunk, index) {
      return (
        '### Fuente ' + (index + 1) + ': ' + chunk.title + ' — ' + chunk.heading + '\n' +
        'URL: ' + chunk.url + '\n' +
        chunk.content
      );
    })
    .join('\n\n---\n\n');
}
