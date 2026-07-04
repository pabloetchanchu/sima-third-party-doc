import { useEffect } from 'react';

var WIDGET_URL = 'https://sima-docs-assistant.simaag.workers.dev/widget.js';

export function SimaAssistant() {
  useEffect(function () {
    if (document.getElementById('sima-assistant-root')) {
      return undefined;
    }

    window.SIMA_ASSISTANT_CONFIG = {
      apiUrl: 'https://sima-docs-assistant.simaag.workers.dev/chat',
      apiKey: 'f8f1b311a321edd0a18e690ace8cb2928aa3f3d85d65dd0b125062a05defc77c',
    };

    var script = document.createElement('script');
    script.id = 'sima-assistant-loader';
    script.src = WIDGET_URL;
    script.async = true;
    document.body.appendChild(script);

    return function () {
      var root = document.getElementById('sima-assistant-root');
      if (root) {
        root.remove();
      }

      var styles = document.getElementById('sima-assistant-styles');
      if (styles) {
        styles.remove();
      }

      var loader = document.getElementById('sima-assistant-loader');
      if (loader) {
        loader.remove();
      }
    };
  }, []);

  return null;
}
