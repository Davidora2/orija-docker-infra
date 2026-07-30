function initOverlay({ mode }) {
  const lt = document.getElementById('lower-third');
  const captions = document.getElementById('captions');
  let theme = null;

  function applyLowerThirdTheme(t) {
    if (!lt || !t?.lowerThird) return;
    const ltTheme = t.lowerThird;
    lt.style.setProperty('--lt-bg', ltTheme.backgroundColor);
    lt.style.setProperty('--lt-bg2', ltTheme.backgroundColor2 || ltTheme.backgroundColor);
    lt.style.setProperty('--lt-text', ltTheme.textColor);
    lt.style.setProperty('--lt-accent', ltTheme.accentColor);
    lt.style.setProperty('--lt-ref', ltTheme.referenceColor || ltTheme.accentColor);
    lt.style.setProperty('--lt-font', `'${ltTheme.fontFamily}', Georgia, serif`);
    lt.style.setProperty('--lt-ref-font', `'${ltTheme.referenceFontFamily || 'DM Sans'}', sans-serif`);
    lt.style.setProperty('--lt-size', `${ltTheme.fontSize}px`);
    lt.style.setProperty('--lt-ref-size', `${ltTheme.referenceFontSize}px`);
    lt.style.setProperty('--lt-pad-x', `${ltTheme.paddingX}px`);
    lt.style.setProperty('--lt-pad-y', `${ltTheme.paddingY}px`);
    lt.style.setProperty('--lt-radius', `${ltTheme.borderRadius}px`);
    lt.style.setProperty('--lt-max', `${ltTheme.maxWidth}px`);
    lt.style.setProperty('--lt-opacity', String(ltTheme.opacity ?? 0.96));

    lt.classList.remove(
      'bg-solid', 'bg-gradient', 'bg-image',
      'pos-bottom-left', 'pos-bottom-center', 'pos-bottom-right', 'pos-top-left', 'pos-top-right',
      'show-accent-left', 'show-accent-top', 'has-shadow',
      'anim-slide-up', 'anim-fade'
    );

    const bgType = ltTheme.backgroundType || 'gradient';
    lt.classList.add(`bg-${bgType}`);
    if (bgType === 'image' && ltTheme.backgroundImage) {
      lt.style.backgroundImage = `linear-gradient(rgba(8,16,22,0.55), rgba(8,16,22,0.55)), url(${ltTheme.backgroundImage})`;
    } else {
      lt.style.backgroundImage = '';
    }

    lt.classList.add(`pos-${ltTheme.position || 'bottom-left'}`);
    if (ltTheme.shadow) lt.classList.add('has-shadow');
    if (ltTheme.showAccentBar) {
      lt.classList.add(ltTheme.accentBarPosition === 'top' ? 'show-accent-top' : 'show-accent-left');
    }
    lt.classList.add(ltTheme.animation === 'fade' ? 'anim-fade' : 'anim-slide-up');
  }

  function applyCaptionsTheme(t) {
    if (!captions || !t?.captions) return;
    const c = t.captions;
    captions.style.setProperty('--cap-bg', c.backgroundColor);
    captions.style.setProperty('--cap-text', c.textColor);
    captions.style.setProperty('--cap-font', `'${c.fontFamily}', sans-serif`);
    captions.style.setProperty('--cap-size', `${c.fontSize}px`);
    captions.style.setProperty('--cap-pad-x', `${c.paddingX}px`);
    captions.style.setProperty('--cap-pad-y', `${c.paddingY}px`);
    captions.style.setProperty('--cap-radius', `${c.borderRadius}px`);
    captions.style.setProperty('--cap-max', `${c.maxWidth}px`);

    captions.classList.remove('pos-bottom', 'pos-bottom-high', 'pos-top', 'has-shadow');
    captions.classList.add(`pos-${c.position || 'bottom'}`);
    if (c.shadow) captions.classList.add('has-shadow');

    const textEl = captions.querySelector('.captions-text');
    if (textEl) {
      textEl.style.webkitLineClamp = String(c.lines || 2);
    }
  }

  function showVerse(verse) {
    if (!lt) return;
    if (!verse) {
      lt.classList.remove('visible');
      lt.classList.add('hidden');
      return;
    }
    lt.querySelector('.lt-reference').textContent = verse.reference || '';
    lt.querySelector('.lt-text').textContent = verse.text || '';
    lt.classList.remove('hidden');
    requestAnimationFrame(() => lt.classList.add('visible'));
  }

  function showCaptions(text) {
    if (!captions) return;
    const el = captions.querySelector('.captions-text');
    const value = (text || '').trim();
    if (!value) {
      captions.classList.remove('visible');
      captions.classList.add('hidden');
      if (el) el.textContent = '';
      return;
    }
    if (el) el.textContent = value;
    captions.classList.remove('hidden');
    requestAnimationFrame(() => captions.classList.add('visible'));
  }

  function handleMessage(msg) {
    if (msg.type === 'theme') {
      theme = msg.payload;
      applyLowerThirdTheme(theme);
      applyCaptionsTheme(theme);
    } else if (msg.type === 'verse' && (mode === 'lower-third' || mode === 'preview')) {
      showVerse(msg.payload);
    } else if (msg.type === 'captions' && (mode === 'captions' || mode === 'preview')) {
      showCaptions(msg.payload);
    }
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}`);
    ws.addEventListener('message', (ev) => {
      try {
        handleMessage(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener('close', () => setTimeout(connect, 1200));
  }

  // Initial HTTP state in case WS is slow
  fetch('/api/state')
    .then((r) => r.json())
    .then((state) => {
      handleMessage({ type: 'theme', payload: state.theme });
      if (mode === 'lower-third' || mode === 'preview') {
        handleMessage({ type: 'verse', payload: state.verse });
      }
      if (mode === 'captions' || mode === 'preview') {
        handleMessage({ type: 'captions', payload: state.captions });
      }
    })
    .catch(() => {});

  connect();
}

window.initOverlay = initOverlay;
