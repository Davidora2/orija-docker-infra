/**
 * Speech recognition + caption buffer using the Chromium Web Speech API.
 * Works in Electron on Windows and Mac when a mic / loopback device is available.
 */
export function createSpeechSession({
  onTranscript,
  onInterim,
  onError,
  onStatus,
  lang = 'en-US',
  continuous = true,
}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.(new Error('Speech recognition is not available in this environment.'));
    return null;
  }

  let recognition = null;
  let running = false;
  let intentionalStop = false;
  let restartTimer = null;

  function start() {
    if (running) return;
    intentionalStop = false;
    recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      running = true;
      onStatus?.('listening');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) finalChunk += text;
        else interim += text;
      }
      if (interim) onInterim?.(interim.trim());
      if (finalChunk.trim()) onTranscript?.(finalChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      onError?.(new Error(event.error || 'Speech recognition error'));
    };

    recognition.onend = () => {
      running = false;
      onStatus?.('idle');
      if (!intentionalStop) {
        restartTimer = setTimeout(() => {
          if (!intentionalStop) start();
        }, 350);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      onError?.(err);
    }
  }

  function stop() {
    intentionalStop = true;
    if (restartTimer) clearTimeout(restartTimer);
    try {
      recognition?.stop();
    } catch {
      /* ignore */
    }
    running = false;
    onStatus?.('idle');
  }

  return { start, stop, get running() { return running; } };
}

export function createCaptionBuffer({ maxChars = 140, onUpdate }) {
  let lines = [];

  function push(text) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    lines.push(cleaned);
    let combined = lines.join(' ');
    while (combined.length > maxChars && lines.length > 1) {
      lines.shift();
      combined = lines.join(' ');
    }
    if (combined.length > maxChars) {
      combined = combined.slice(combined.length - maxChars);
      const space = combined.indexOf(' ');
      if (space > 0 && space < 24) combined = combined.slice(space + 1);
      lines = [combined];
    }
    onUpdate?.(combined);
  }

  function setInterim(text) {
    const base = lines.join(' ');
    const combined = [base, text].filter(Boolean).join(' ').trim();
    onUpdate?.(combined.slice(-maxChars));
  }

  function clear() {
    lines = [];
    onUpdate?.('');
  }

  return { push, setInterim, clear };
}
