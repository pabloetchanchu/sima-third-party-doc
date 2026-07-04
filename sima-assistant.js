(function () {
  'use strict';

  var CONFIG = window.SIMA_ASSISTANT_CONFIG || {
  apiUrl: 'https://sima-docs-assistant.simaag.workers.dev/chat',
  apiKey: null,
  title: 'Asistente SIMA',
  subtitle: 'Preguntá sobre la API de Terceros',
  placeholder: 'Ej: ¿Cómo me autentico?',
  exampleQueries: [
    '¿Cómo me autentico en la API?',
    '¿Qué versión usar para work orders?',
    '¿Cuáles son los límites de rate limiting?',
  ],
  supportEmail: 'soporte@sima.ag',
};

  var COLORS = {
    primary: '#1a6b3c',
    primaryLight: '#2d9c5a',
    primaryDark: '#0f4a29',
    surface: '#ffffff',
    text: '#1a1a1a',
    muted: '#6b7280',
    border: '#e5e7eb',
  };

  var state = {
    isOpen: false,
    isLoading: false,
    messages: [],
  };

  function injectStyles() {
    if (document.getElementById('sima-assistant-styles')) {
      return;
    }

    var style = document.createElement('style');
    style.id = 'sima-assistant-styles';
    style.textContent = [
      '#sima-assistant-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5; z-index: 99999; }',
      '#sima-assistant-trigger { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; border: none; background: ' + COLORS.primary + '; color: #fff; cursor: pointer; box-shadow: 0 4px 20px rgba(26,107,60,.35); display: flex; align-items: center; justify-content: center; transition: transform .2s, background .2s; }',
      '#sima-assistant-trigger:hover { background: ' + COLORS.primaryLight + '; transform: scale(1.05); }',
      '#sima-assistant-trigger svg { width: 26px; height: 26px; }',
      '#sima-assistant-panel { position: fixed; bottom: 96px; right: 24px; width: 380px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 120px); background: ' + COLORS.surface + '; border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,.15); display: flex; flex-direction: column; overflow: hidden; border: 1px solid ' + COLORS.border + '; transform: scale(.95) translateY(8px); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; }',
      '#sima-assistant-panel.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }',
      '#sima-assistant-header { background: linear-gradient(135deg, ' + COLORS.primaryDark + ', ' + COLORS.primary + '); color: #fff; padding: 16px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }',
      '#sima-assistant-header h3 { margin: 0; font-size: 16px; font-weight: 600; }',
      '#sima-assistant-header p { margin: 4px 0 0; font-size: 12px; opacity: .85; }',
      '#sima-assistant-close { background: rgba(255,255,255,.15); border: none; color: #fff; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 18px; line-height: 1; flex-shrink: 0; }',
      '#sima-assistant-close:hover { background: rgba(255,255,255,.25); }',
      '#sima-assistant-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }',
      '.sima-msg { max-width: 88%; padding: 10px 14px; border-radius: 12px; word-wrap: break-word; white-space: pre-wrap; }',
      '.sima-msg.user { align-self: flex-end; background: ' + COLORS.primary + '; color: #fff; border-bottom-right-radius: 4px; }',
      '.sima-msg.assistant { align-self: flex-start; background: #fff; color: ' + COLORS.text + '; border: 1px solid ' + COLORS.border + '; border-bottom-left-radius: 4px; }',
      '.sima-msg.loading { color: ' + COLORS.muted + '; font-style: italic; }',
      '.sima-sources { margin-top: 8px; padding-top: 8px; border-top: 1px solid ' + COLORS.border + '; font-size: 11px; }',
      '.sima-sources a { color: ' + COLORS.primary + '; text-decoration: none; display: block; margin-top: 4px; }',
      '.sima-sources a:hover { text-decoration: underline; }',
      '#sima-assistant-examples { padding: 0 16px 8px; display: flex; flex-wrap: wrap; gap: 6px; background: #f9fafb; }',
      '.sima-example-btn { font-size: 11px; padding: 5px 10px; border-radius: 999px; border: 1px solid ' + COLORS.border + '; background: #fff; color: ' + COLORS.primary + '; cursor: pointer; }',
      '.sima-example-btn:hover { border-color: ' + COLORS.primary + '; background: #f0fdf4; }',
      '#sima-assistant-input-area { padding: 12px 16px; border-top: 1px solid ' + COLORS.border + '; display: flex; gap: 8px; background: #fff; }',
      '#sima-assistant-input { flex: 1; border: 1px solid ' + COLORS.border + '; border-radius: 10px; padding: 10px 12px; font-size: 14px; resize: none; font-family: inherit; outline: none; }',
      '#sima-assistant-input:focus { border-color: ' + COLORS.primary + '; box-shadow: 0 0 0 3px rgba(26,107,60,.12); }',
      '#sima-assistant-send { background: ' + COLORS.primary + '; color: #fff; border: none; border-radius: 10px; padding: 0 16px; cursor: pointer; font-weight: 600; font-size: 14px; }',
      '#sima-assistant-send:hover:not(:disabled) { background: ' + COLORS.primaryLight + '; }',
      '#sima-assistant-send:disabled { opacity: .5; cursor: not-allowed; }',
      '#sima-assistant-footer { padding: 6px 16px 10px; font-size: 10px; color: ' + COLORS.muted + '; text-align: center; background: #fff; }',
      '#sima-assistant-footer a { color: ' + COLORS.primary + '; }',
      '@media (max-width: 480px) { #sima-assistant-panel { right: 16px; bottom: 88px; width: calc(100vw - 32px); height: calc(100vh - 110px); } #sima-assistant-trigger { right: 16px; bottom: 16px; } }',
    ].join('\n');

    document.head.appendChild(style);
  }

  function createElement(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text) {
      el.textContent = text;
    }
    return el;
  }

  function renderSources(container, sources) {
    if (!sources || sources.length === 0) {
      return;
    }

    var wrap = createElement('div', 'sima-sources');
    wrap.appendChild(createElement('strong', null, 'Fuentes:'));
    sources.forEach(function (source) {
      var link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title;
      wrap.appendChild(link);
    });
    container.appendChild(wrap);
  }

  function renderMessages(messagesEl, examplesEl) {
    messagesEl.innerHTML = '';

    if (state.messages.length === 0) {
      examplesEl.style.display = 'flex';
      return;
    }

    examplesEl.style.display = 'none';

    state.messages.forEach(function (msg) {
      var bubble = createElement('div', 'sima-msg ' + msg.role);
      if (msg.loading) {
        bubble.classList.add('loading');
        bubble.textContent = 'Pensando...';
      } else {
        bubble.textContent = msg.content;
        if (msg.sources) {
          renderSources(bubble, msg.sources);
        }
      }
      messagesEl.appendChild(bubble);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage(inputEl, messagesEl, examplesEl, sendBtn) {
    var text = inputEl.value.trim();
    if (!text || state.isLoading) {
      return;
    }

    state.messages.push({ role: 'user', content: text });
    state.messages.push({ role: 'assistant', content: '', loading: true });
    state.isLoading = true;
    inputEl.value = '';
    sendBtn.disabled = true;
    renderMessages(messagesEl, examplesEl);

    var history = state.messages
      .filter(function (m) {
        return !m.loading;
      })
      .slice(-8)
      .map(function (m) {
        return { role: m.role, content: m.content };
      });

    var headers = { 'Content-Type': 'application/json' };
    if (CONFIG.apiKey) {
      headers['X-Assistant-Key'] = CONFIG.apiKey;
    }

    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        state.messages = state.messages.filter(function (m) {
          return !m.loading;
        });

        if (!result.ok) {
          state.messages.push({
            role: 'assistant',
            content: 'No pude responder en este momento. Probá de nuevo o escribinos a ' + CONFIG.supportEmail + '.',
          });
          return;
        }

        state.messages.push({
          role: 'assistant',
          content: result.data.answer,
          sources: result.data.sources,
        });
      })
      .catch(function () {
        state.messages = state.messages.filter(function (m) {
          return !m.loading;
        });
        state.messages.push({
          role: 'assistant',
          content: 'Error de conexión. Verificá que el asistente esté desplegado o contactá a ' + CONFIG.supportEmail + '.',
        });
      })
      .finally(function () {
        state.isLoading = false;
        sendBtn.disabled = false;
        renderMessages(messagesEl, examplesEl);
        inputEl.focus();
      });
  }

  function init() {
    if (document.getElementById('sima-assistant-root')) {
      return;
    }

    injectStyles();

    var root = createElement('div');
    root.id = 'sima-assistant-root';

    var trigger = createElement('button');
    trigger.id = 'sima-assistant-trigger';
    trigger.setAttribute('aria-label', 'Abrir asistente SIMA');
    trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    var panel = createElement('div');
    panel.id = 'sima-assistant-panel';

    var header = createElement('div');
    header.id = 'sima-assistant-header';
    var headerText = createElement('div');
    headerText.appendChild(createElement('h3', null, CONFIG.title));
    headerText.appendChild(createElement('p', null, CONFIG.subtitle));
    var closeBtn = createElement('button');
    closeBtn.id = 'sima-assistant-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '×';
    header.appendChild(headerText);
    header.appendChild(closeBtn);

    var messagesEl = createElement('div');
    messagesEl.id = 'sima-assistant-messages';

    var examplesEl = createElement('div');
    examplesEl.id = 'sima-assistant-examples';
    CONFIG.exampleQueries.forEach(function (query) {
      var btn = createElement('button', 'sima-example-btn', query);
      btn.addEventListener('click', function () {
        inputEl.value = query;
        sendMessage(inputEl, messagesEl, examplesEl, sendBtn);
      });
      examplesEl.appendChild(btn);
    });

    var inputArea = createElement('div');
    inputArea.id = 'sima-assistant-input-area';
    var inputEl = document.createElement('textarea');
    inputEl.id = 'sima-assistant-input';
    inputEl.rows = 1;
    inputEl.placeholder = CONFIG.placeholder;
    var sendBtn = createElement('button');
    sendBtn.id = 'sima-assistant-send';
    sendBtn.textContent = 'Enviar';
    inputArea.appendChild(inputEl);
    inputArea.appendChild(sendBtn);

    var footer = createElement('div');
    footer.id = 'sima-assistant-footer';
    footer.innerHTML = 'Asistente SIMA · <a href="mailto:' + CONFIG.supportEmail + '">' + CONFIG.supportEmail + '</a>';

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(examplesEl);
    panel.appendChild(inputArea);
    panel.appendChild(footer);

    root.appendChild(panel);
    root.appendChild(trigger);
    document.body.appendChild(root);

    function togglePanel(open) {
      state.isOpen = typeof open === 'boolean' ? open : !state.isOpen;
      panel.classList.toggle('open', state.isOpen);
      if (state.isOpen) {
        inputEl.focus();
      }
    }

    trigger.addEventListener('click', function () {
      togglePanel();
    });

    closeBtn.addEventListener('click', function () {
      togglePanel(false);
    });

    sendBtn.addEventListener('click', function () {
      sendMessage(inputEl, messagesEl, examplesEl, sendBtn);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputEl, messagesEl, examplesEl, sendBtn);
      }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        togglePanel(true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
