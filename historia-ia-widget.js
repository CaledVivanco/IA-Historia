/**
 * Historia IA — Corralito de Piedra
 * Widget de chat embebible: un guía histórico de Cartagena de Indias.
 *
 * Uso:
 *   <script src="historia-ia-widget.js"></script>
 *   <script>
 *     HistoriaIA.init({
 *       apiEndpoint: '/api/historia-cartagena', // tu backend, ver server-proxy-example.js
 *       whatsappNumber: '573001234567'          // opcional, para el botón "Reservar un tour"
 *     });
 *   </script>
 *
 * Seguridad: este widget NUNCA debe llamar directamente a api.anthropic.com
 * desde el navegador — expondría tu API key a cualquier visitante. Siempre
 * pasa por tu propio backend (ver server-proxy-example.js).
 */
(function (global) {
  'use strict';

  const STYLE_ID = 'historia-ia-styles';
  const ROOT_ID = 'historia-ia-root';

  const CSS = `
  #${ROOT_ID} {
    --hia-sand: #E4D9BA;
    --hia-stone: #7C7264;
    --hia-stone-dark: #58503F;
    --hia-ink: #1B2420;
    --hia-teal: #0E6E6E;
    --hia-teal-dark: #0A5252;
    --hia-coral: #C1502E;
    --hia-mustard: #D9A441;
    --hia-magenta: #A83263;
    --hia-paper: #F4EEDC;
    font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 999999;
  }
  #${ROOT_ID} * { box-sizing: border-box; }

  #${ROOT_ID} .hia-fab {
    width: 64px;
    height: 64px;
    border-radius: 50% 50% 4px 4px / 60% 60% 4px 4px;
    background: linear-gradient(155deg, var(--hia-teal) 0%, var(--hia-teal-dark) 100%);
    border: 3px solid var(--hia-mustard);
    box-shadow: 0 8px 24px rgba(14, 110, 110, 0.35), 0 2px 6px rgba(0,0,0,0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
    position: relative;
  }
  #${ROOT_ID} .hia-fab:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(14, 110, 110, 0.45); }
  #${ROOT_ID} .hia-fab:focus-visible { outline: 3px solid var(--hia-coral); outline-offset: 3px; }
  #${ROOT_ID} .hia-fab svg { width: 30px; height: 30px; }
  #${ROOT_ID} .hia-fab .hia-badge {
    position: absolute; top: -4px; right: -4px;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--hia-coral); border: 2px solid var(--hia-paper);
  }

  #${ROOT_ID} .hia-panel {
    position: absolute;
    bottom: 78px;
    right: 0;
    width: 368px;
    max-width: calc(100vw - 32px);
    height: 520px;
    max-height: calc(100vh - 140px);
    background: var(--hia-paper);
    border-radius: 22px 22px 14px 14px;
    box-shadow: 0 20px 50px rgba(27, 36, 32, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transform: translateY(16px) scale(0.97);
    pointer-events: none;
    transition: opacity 0.22s ease, transform 0.22s ease;
    border: 1px solid rgba(124,114,100,0.25);
  }
  #${ROOT_ID}.hia-open .hia-panel {
    opacity: 1; transform: translateY(0) scale(1); pointer-events: auto;
  }

  #${ROOT_ID} .hia-header {
    background:
      radial-gradient(circle at 85% -20%, rgba(217,164,65,0.35), transparent 55%),
      linear-gradient(155deg, var(--hia-teal) 0%, var(--hia-ink) 130%);
    padding: 18px 18px 22px;
    border-radius: 22px 22px 60% 60% / 22px 22px 26px 26px;
    color: var(--hia-paper);
    position: relative;
  }
  #${ROOT_ID} .hia-header-top { display: flex; align-items: center; justify-content: space-between; }
  #${ROOT_ID} .hia-title { display: flex; align-items: center; gap: 10px; }
  #${ROOT_ID} .hia-title h2 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 17px; font-weight: 600; margin: 0; line-height: 1.1;
  }
  #${ROOT_ID} .hia-title span.hia-sub {
    display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--hia-mustard); margin-top: 2px; font-weight: 500;
  }
  #${ROOT_ID} .hia-close {
    background: rgba(244,238,220,0.14); border: none; color: var(--hia-paper);
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s ease;
  }
  #${ROOT_ID} .hia-close:hover { background: rgba(244,238,220,0.28); }

  #${ROOT_ID} .hia-messages {
    flex: 1;
    overflow-y: auto;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background:
      repeating-linear-gradient(135deg, rgba(124,114,100,0.05) 0 2px, transparent 2px 14px);
  }
  #${ROOT_ID} .hia-messages::-webkit-scrollbar { width: 6px; }
  #${ROOT_ID} .hia-messages::-webkit-scrollbar-thumb { background: var(--hia-stone); border-radius: 3px; }

  #${ROOT_ID} .hia-msg {
    max-width: 84%;
    padding: 10px 13px;
    border-radius: 14px;
    font-size: 13.5px;
    line-height: 1.5;
    box-shadow: 0 1px 3px rgba(27,36,32,0.08);
  }
  #${ROOT_ID} .hia-msg.hia-bot {
    align-self: flex-start;
    background: #fff;
    color: var(--hia-ink);
    border-bottom-left-radius: 4px;
    border-left: 3px solid var(--hia-teal);
  }
  #${ROOT_ID} .hia-msg.hia-user {
    align-self: flex-end;
    background: var(--hia-coral);
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  #${ROOT_ID} .hia-msg.hia-typing { display: flex; gap: 4px; align-items: center; padding: 12px 14px; }
  #${ROOT_ID} .hia-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--hia-stone);
    animation: hia-bounce 1.1s infinite ease-in-out;
  }
  #${ROOT_ID} .hia-dot:nth-child(2) { animation-delay: 0.15s; }
  #${ROOT_ID} .hia-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes hia-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }

  #${ROOT_ID} .hia-suggestions {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 12px;
  }
  #${ROOT_ID} .hia-chip {
    font-size: 11.5px; padding: 6px 10px; border-radius: 999px;
    background: rgba(14,110,110,0.1); color: var(--hia-teal-dark);
    border: 1px solid rgba(14,110,110,0.25); cursor: pointer;
    font-family: inherit; transition: background 0.15s ease;
  }
  #${ROOT_ID} .hia-chip:hover { background: rgba(14,110,110,0.18); }

  #${ROOT_ID} .hia-inputbar {
    display: flex; gap: 8px; padding: 12px 14px 14px;
    border-top: 1px solid rgba(124,114,100,0.2);
    background: var(--hia-paper);
  }
  #${ROOT_ID} .hia-input {
    flex: 1; border: 1.5px solid rgba(124,114,100,0.35); border-radius: 12px;
    padding: 10px 12px; font-size: 13.5px; font-family: inherit;
    background: #fff; color: var(--hia-ink); resize: none;
  }
  #${ROOT_ID} .hia-input:focus { outline: none; border-color: var(--hia-teal); }
  #${ROOT_ID} .hia-send {
    width: 40px; height: 40px; border-radius: 12px; border: none;
    background: var(--hia-coral); color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: background 0.15s ease;
  }
  #${ROOT_ID} .hia-send:hover { background: #a8431f; }
  #${ROOT_ID} .hia-send:disabled { opacity: 0.5; cursor: default; }

  #${ROOT_ID} .hia-footer {
    text-align: center; font-size: 10.5px; color: var(--hia-stone);
    padding: 0 14px 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    #${ROOT_ID} .hia-fab, #${ROOT_ID} .hia-panel, #${ROOT_ID} .hia-dot { transition: none; animation: none; }
  }
  `;

  const SUGGESTIONS = [
    '¿Por qué construyeron la muralla?',
    '¿Qué fue el Palacio de la Inquisición?',
    '¿Cómo resistió Cartagena los ataques piratas?',
    '¿Qué significa Corralito de Piedra?'
  ];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Work+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function iconArch() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M4 21h16"/><path d="M9 21v-6h6v6"/>
    </svg>`;
  }
  function iconClose() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  }
  function iconSend() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const HistoriaIA = {
    _state: {
      history: [], // {role, content}
      open: false,
      loading: false
    },
    _config: {
      apiEndpoint: '/api/historia-cartagena',
      whatsappNumber: null,
      welcomeMessage: '¡Hola! Soy tu guía de historia de Cartagena de Indias. Pregúntame sobre la muralla, la época colonial, los piratas, la Inquisición o cómo nació el Corralito de Piedra.'
    },

    init(userConfig) {
      this._config = Object.assign({}, this._config, userConfig || {});
      injectStyles();
      this._render();
    },

    _render() {
      let root = document.getElementById(ROOT_ID);
      if (root) root.remove();

      root = document.createElement('div');
      root.id = ROOT_ID;
      root.innerHTML = `
        <button class="hia-fab" id="hia-fab-btn" aria-label="Abrir guía de historia de Cartagena" aria-expanded="false">
          ${iconArch()}
          <span class="hia-badge" aria-hidden="true"></span>
        </button>
        <section class="hia-panel" role="dialog" aria-label="Chat de historia de Cartagena de Indias">
          <header class="hia-header">
            <div class="hia-header-top">
              <div class="hia-title">
                <div>
                  <h2>Historia Viva</h2>
                  <span class="hia-sub">Corralito de Piedra</span>
                </div>
              </div>
              <button class="hia-close" id="hia-close-btn" aria-label="Cerrar chat">${iconClose()}</button>
            </div>
          </header>
          <div class="hia-messages" id="hia-messages"></div>
          <div class="hia-suggestions" id="hia-suggestions"></div>
          <form class="hia-inputbar" id="hia-form">
            <textarea class="hia-input" id="hia-input" rows="1" placeholder="Pregunta sobre la historia de Cartagena..." aria-label="Escribe tu pregunta"></textarea>
            <button type="submit" class="hia-send" id="hia-send-btn" aria-label="Enviar pregunta">${iconSend()}</button>
          </form>
          <div class="hia-footer">Guía histórico con IA · puede cometer errores</div>
        </section>
      `;
      document.body.appendChild(root);

      root.querySelector('#hia-fab-btn').addEventListener('click', () => this._toggle());
      root.querySelector('#hia-close-btn').addEventListener('click', () => this._toggle(false));
      root.querySelector('#hia-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSubmit();
      });
      const textarea = root.querySelector('#hia-input');
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._handleSubmit();
        }
      });

      this._renderSuggestions();
      this._pushMessage('bot', this._config.welcomeMessage, false);
    },

    _toggle(force) {
      const root = document.getElementById(ROOT_ID);
      const open = typeof force === 'boolean' ? force : !this._state.open;
      this._state.open = open;
      root.classList.toggle('hia-open', open);
      root.querySelector('#hia-fab-btn').setAttribute('aria-expanded', String(open));
      if (open) root.querySelector('#hia-input').focus();
    },

    _renderSuggestions() {
      const wrap = document.getElementById('hia-suggestions');
      wrap.innerHTML = '';
      SUGGESTIONS.forEach((q) => {
        const btn = document.createElement('button');
        btn.className = 'hia-chip';
        btn.type = 'button';
        btn.textContent = q;
        btn.addEventListener('click', () => {
          document.getElementById('hia-input').value = q;
          this._handleSubmit();
        });
        wrap.appendChild(btn);
      });
    },

    _pushMessage(role, text, save = true) {
      const container = document.getElementById('hia-messages');
      const el = document.createElement('div');
      el.className = `hia-msg hia-${role === 'user' ? 'user' : 'bot'}`;
      el.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
      if (save) this._state.history.push({ role: role === 'user' ? 'user' : 'assistant', content: text });
    },

    _setTyping(show) {
      const container = document.getElementById('hia-messages');
      let typingEl = document.getElementById('hia-typing-indicator');
      if (show) {
        if (typingEl) return;
        typingEl = document.createElement('div');
        typingEl.id = 'hia-typing-indicator';
        typingEl.className = 'hia-msg hia-bot hia-typing';
        typingEl.innerHTML = '<span class="hia-dot"></span><span class="hia-dot"></span><span class="hia-dot"></span>';
        container.appendChild(typingEl);
        container.scrollTop = container.scrollHeight;
      } else if (typingEl) {
        typingEl.remove();
      }
    },

    async _handleSubmit() {
      const input = document.getElementById('hia-input');
      const text = input.value.trim();
      if (!text || this._state.loading) return;

      input.value = '';
      document.getElementById('hia-suggestions').innerHTML = '';
      this._pushMessage('user', text);
      this._state.loading = true;
      document.getElementById('hia-send-btn').disabled = true;
      this._setTyping(true);

      try {
        const reply = await this._askBackend(this._state.history);
        this._setTyping(false);
        this._pushMessage('bot', reply);
      } catch (err) {
        this._setTyping(false);
        this._pushMessage(
          'bot',
          'No pude conectarme en este momento. Si quieres reservar un tour para conocer estas historias en persona, escríbenos por WhatsApp.',
          false
        );
        console.error('HistoriaIA error:', err);
      } finally {
        this._state.loading = false;
        document.getElementById('hia-send-btn').disabled = false;
      }
    },

    async _askBackend(history) {
      const res = await fetch(this._config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
      const data = await res.json();
      if (!data || typeof data.reply !== 'string') throw new Error('Respuesta inválida del backend');
      return data.reply;
    }
  };

  global.HistoriaIA = HistoriaIA;
})(window);