(function () {
  'use strict';

  if (window.__SIMA_ASSISTANT_LOADER__) {
    return;
  }

  window.__SIMA_ASSISTANT_LOADER__ = true;

  window.SIMA_ASSISTANT_CONFIG = {
    apiUrl: 'https://sima-docs-assistant.simaag.workers.dev/chat',
    apiKey: 'f8f1b311a321edd0a18e690ace8cb2928aa3f3d85d65dd0b125062a05defc77c',
  };

  function loadWidget() {
    if (document.getElementById('sima-assistant-root') || document.getElementById('sima-assistant-loader')) {
      return;
    }

    var script = document.createElement('script');
    script.id = 'sima-assistant-loader';
    script.src = 'https://sima-docs-assistant.simaag.workers.dev/widget.js';
    script.async = true;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget);
  } else {
    loadWidget();
  }
})();
