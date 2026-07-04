(function () {
  'use strict';

  var DEFAULT_CONFIG = {
    apiUrl: 'https://sima-docs-assistant.simaag.workers.dev/chat',
    apiKey: 'f8f1b311a321edd0a18e690ace8cb2928aa3f3d85d65dd0b125062a05defc77c',
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

  var CONFIG = Object.assign({}, DEFAULT_CONFIG, window.SIMA_ASSISTANT_CONFIG || {});
  if (!CONFIG.exampleQueries || !CONFIG.exampleQueries.length) {
    CONFIG.exampleQueries = DEFAULT_CONFIG.exampleQueries;
  }

  var state = {
    isOpen: false,
    isLoading: false,
    messages: [],
  };

  function isDarkMode() {
    var html = document.documentElement;
    if (html.classList.contains('dark')) {
      return true;
    }

    var stored = localStorage.getItem('isDarkMode');
    if (stored === 'true' || stored === 'dark') {
      return true;
    }
    if (stored === 'false' || stored === 'light') {
      return false;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderInlineMarkdown(text) {
    var lines = text.split('\n');
    var html = [];
    var inList = false;

    function closeList() {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) {
        closeList();
        return;
      }

      var heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        var level = heading[1].length + 1;
        html.push('<h' + level + ' class="sima-h">' + formatInline(heading[2]) + '</h' + level + '>');
        return;
      }

      var listItem = trimmed.match(/^(?:\*|-|•)\s+(.+)$/);
      if (listItem) {
        if (!inList) {
          html.push('<ul class="sima-ul">');
          inList = true;
        }
        html.push('<li>' + formatInline(listItem[1]) + '</li>');
        return;
      }

      closeList();
      html.push('<p class="sima-p">' + formatInline(trimmed) + '</p>');
    });

    closeList();
    return html.join('');
  }

  function formatInline(text) {
    var safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/`([^`]+)`/g, '<code class="sima-inline-code">$1</code>');
    return safe;
  }

  function renderMarkdown(text) {
    if (!text) {
      return '';
    }

    var result = [];
    var pattern = /```(\w*)\n?([\s\S]*?)```/g;
    var lastIndex = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(renderInlineMarkdown(text.slice(lastIndex, match.index)));
      }
      result.push(
        '<pre class="sima-code"><code>' + escapeHtml(match[2].replace(/^\n|\n$/g, '')) + '</code></pre>'
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push(renderInlineMarkdown(text.slice(lastIndex)));
    }

    return '<div class="sima-md">' + result.join('') + '</div>';
  }

  function injectStyles() {
    var existing = document.getElementById('sima-assistant-styles');
    if (existing) {
      existing.remove();
    }

    var style = document.createElement('style');
    style.id = 'sima-assistant-styles';
    style.textContent = [
      '#sima-assistant-root {',
      '  --sima-primary: #1a6b3c;',
      '  --sima-primary-light: #2d9c5a;',
      '  --sima-primary-dark: #0f4a29;',
      '  --sima-surface: #ffffff;',
      '  --sima-bg: #f9fafb;',
      '  --sima-text: #1a1a1a;',
      '  --sima-muted: #6b7280;',
      '  --sima-border: #e5e7eb;',
      '  --sima-bubble: #ffffff;',
      '  --sima-code-bg: #f3f4f6;',
      '  --sima-shadow: 0 12px 48px rgba(0,0,0,.15);',
      '  position: fixed; bottom: 0; right: 0; z-index: 2147483000; pointer-events: none;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  font-size: 14px; line-height: 1.5;',
      '}',
      '#sima-assistant-root.sima-dark {',
      '  --sima-surface: #161b22;',
      '  --sima-bg: #0d1117;',
      '  --sima-text: #e6edf3;',
      '  --sima-muted: #8b949e;',
      '  --sima-border: #30363d;',
      '  --sima-bubble: #21262d;',
      '  --sima-code-bg: #0d1117;',
      '  --sima-shadow: 0 12px 48px rgba(0,0,0,.45);',
      '}',
      '#sima-assistant-trigger, #sima-assistant-panel { pointer-events: auto; }',
      '#sima-assistant-trigger {',
      '  position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;',
      '  border-radius: 50%; border: none; background: var(--sima-primary); color: #fff;',
      '  cursor: pointer; box-shadow: 0 4px 20px rgba(26,107,60,.35);',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: transform .2s, background .2s;',
      '}',
      '#sima-assistant-trigger:hover { background: var(--sima-primary-light); transform: scale(1.05); }',
      '#sima-assistant-trigger svg { width: 26px; height: 26px; }',
      '#sima-assistant-panel {',
      '  position: fixed; bottom: 96px; right: 24px; width: 400px; max-width: calc(100vw - 32px);',
      '  height: 560px; max-height: calc(100vh - 120px); background: var(--sima-surface);',
      '  border-radius: 16px; box-shadow: var(--sima-shadow); display: flex; flex-direction: column;',
      '  overflow: hidden; border: 1px solid var(--sima-border);',
      '  transform: scale(.95) translateY(8px); opacity: 0; pointer-events: none;',
      '  transition: opacity .2s, transform .2s, background .2s, border-color .2s;',
      '}',
      '#sima-assistant-panel.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }',
      '#sima-assistant-header {',
      '  background: linear-gradient(135deg, var(--sima-primary-dark), var(--sima-primary));',
      '  color: #fff; padding: 16px 18px; display: flex; align-items: flex-start;',
      '  justify-content: space-between; gap: 12px; flex-shrink: 0;',
      '}',
      '#sima-assistant-header h3 { margin: 0; font-size: 16px; font-weight: 600; }',
      '#sima-assistant-header p { margin: 4px 0 0; font-size: 12px; opacity: .85; }',
      '#sima-assistant-close {',
      '  background: rgba(255,255,255,.15); border: none; color: #fff; width: 28px; height: 28px;',
      '  border-radius: 8px; cursor: pointer; font-size: 18px; line-height: 1; flex-shrink: 0;',
      '}',
      '#sima-assistant-close:hover { background: rgba(255,255,255,.25); }',
      '#sima-assistant-messages {',
      '  flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column;',
      '  gap: 12px; background: var(--sima-bg); transition: background .2s;',
      '}',
      '.sima-msg { max-width: 92%; padding: 10px 14px; border-radius: 12px; word-wrap: break-word; }',
      '.sima-msg.user {',
      '  align-self: flex-end; background: var(--sima-primary); color: #fff;',
      '  border-bottom-right-radius: 4px; white-space: pre-wrap;',
      '}',
      '.sima-msg.assistant {',
      '  align-self: flex-start; background: var(--sima-bubble); color: var(--sima-text);',
      '  border: 1px solid var(--sima-border); border-bottom-left-radius: 4px;',
      '}',
      '.sima-msg.loading { color: var(--sima-muted); font-style: italic; }',
      '.sima-md { font-size: 13px; line-height: 1.55; }',
      '.sima-md .sima-p { margin: 0 0 8px; }',
      '.sima-md .sima-p:last-child { margin-bottom: 0; }',
      '.sima-md .sima-h { margin: 12px 0 6px; font-size: 13px; font-weight: 600; line-height: 1.3; }',
      '.sima-md .sima-h:first-child { margin-top: 0; }',
      '.sima-md .sima-ul { margin: 4px 0 8px; padding-left: 18px; }',
      '.sima-md .sima-ul li { margin: 4px 0; }',
      '.sima-inline-code {',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;',
      '  background: var(--sima-code-bg); padding: 1px 5px; border-radius: 4px;',
      '  border: 1px solid var(--sima-border);',
      '}',
      '.sima-code {',
      '  margin: 8px 0; padding: 10px 12px; border-radius: 8px; overflow-x: auto;',
      '  background: var(--sima-code-bg); border: 1px solid var(--sima-border);',
      '}',
      '.sima-code code {',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;',
      '  line-height: 1.45; white-space: pre; display: block; color: var(--sima-text);',
      '}',
      '.sima-sources { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--sima-border); font-size: 11px; }',
      '.sima-sources a { color: var(--sima-primary-light); text-decoration: none; display: block; margin-top: 4px; }',
      '.sima-sources a:hover { text-decoration: underline; }',
      '#sima-assistant-examples {',
      '  padding: 0 16px 8px; display: flex; flex-wrap: wrap; gap: 6px;',
      '  background: var(--sima-bg); flex-shrink: 0;',
      '}',
      '.sima-example-btn {',
      '  font-size: 11px; padding: 5px 10px; border-radius: 999px;',
      '  border: 1px solid var(--sima-border); background: var(--sima-surface);',
      '  color: var(--sima-primary-light); cursor: pointer;',
      '}',
      '.sima-example-btn:hover { border-color: var(--sima-primary); background: rgba(45,156,90,.12); }',
      '#sima-assistant-input-area {',
      '  padding: 12px 16px; border-top: 1px solid var(--sima-border);',
      '  display: flex; gap: 8px; background: var(--sima-surface); flex-shrink: 0;',
      '}',
      '#sima-assistant-input {',
      '  flex: 1; border: 1px solid var(--sima-border); border-radius: 10px;',
      '  padding: 10px 12px; font-size: 14px; resize: none; font-family: inherit;',
      '  outline: none; background: var(--sima-bg); color: var(--sima-text);',
      '}',
      '#sima-assistant-input::placeholder { color: var(--sima-muted); }',
      '#sima-assistant-input:focus { border-color: var(--sima-primary); box-shadow: 0 0 0 3px rgba(26,107,60,.2); }',
      '#sima-assistant-send {',
      '  background: var(--sima-primary); color: #fff; border: none; border-radius: 10px;',
      '  padding: 0 16px; cursor: pointer; font-weight: 600; font-size: 14px;',
      '}',
      '#sima-assistant-send:hover:not(:disabled) { background: var(--sima-primary-light); }',
      '#sima-assistant-send:disabled { opacity: .5; cursor: not-allowed; }',
      '#sima-assistant-footer {',
      '  padding: 6px 16px 10px; font-size: 10px; color: var(--sima-muted);',
      '  text-align: center; background: var(--sima-surface); flex-shrink: 0;',
      '}',
      '#sima-assistant-footer a { color: var(--sima-primary-light); }',
      '@media (max-width: 480px) {',
      '  #sima-assistant-panel { right: 16px; bottom: 88px; width: calc(100vw - 32px); height: calc(100vh - 110px); }',
      '  #sima-assistant-trigger { right: 16px; bottom: 16px; }',
      '}',
    ].join('\n');

    document.head.appendChild(style);
  }

  function applyTheme(root) {
    if (!root) {
      return;
    }
    root.classList.toggle('sima-dark', isDarkMode());
  }

  function watchTheme(root) {
    applyTheme(root);

    var observer = new MutationObserver(function () {
      applyTheme(root);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        applyTheme(root);
      });
    }
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
      } else if (msg.role === 'assistant') {
        bubble.innerHTML = renderMarkdown(msg.content);
        if (msg.sources) {
          renderSources(bubble, msg.sources);
        }
      } else {
        bubble.textContent = msg.content;
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

    watchTheme(root);

    function togglePanel(open) {
      state.isOpen = typeof open === 'boolean' ? open : !state.isOpen;
      panel.classList.toggle('open', state.isOpen);
      if (state.isOpen) {
        applyTheme(root);
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
