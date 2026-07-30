export default function PreviewStage({ theme, verse, captions, overlayInfo, forceVisible }) {
  const lt = theme.lowerThird;
  const cap = theme.captions;
  const showVerse = forceVisible || Boolean(verse);
  const showCaptions = forceVisible || Boolean(captions);

  const ltStyle = {
    '--lt-bg': lt.backgroundColor,
    '--lt-bg2': lt.backgroundColor2,
    '--lt-text': lt.textColor,
    '--lt-accent': lt.accentColor,
    '--lt-ref': lt.referenceColor || lt.accentColor,
    '--lt-font': `'${lt.fontFamily}', Georgia, serif`,
    '--lt-ref-font': `'${lt.referenceFontFamily || 'DM Sans'}', sans-serif`,
    '--lt-size': `${Math.round(lt.fontSize * 0.72)}px`,
    '--lt-ref-size': `${Math.round(lt.referenceFontSize * 0.85)}px`,
    '--lt-pad-x': `${Math.round(lt.paddingX * 0.7)}px`,
    '--lt-pad-y': `${Math.round(lt.paddingY * 0.7)}px`,
    '--lt-radius': `${lt.borderRadius}px`,
    '--lt-max': `${Math.round(lt.maxWidth * 0.55)}px`,
    '--lt-opacity': String(lt.opacity ?? 0.96),
    backgroundImage:
      lt.backgroundType === 'image' && lt.backgroundImage
        ? `linear-gradient(rgba(8,16,22,0.55), rgba(8,16,22,0.55)), url(${lt.backgroundImage})`
        : undefined,
  };

  const capStyle = {
    '--cap-bg': cap.backgroundColor,
    '--cap-text': cap.textColor,
    '--cap-font': `'${cap.fontFamily}', sans-serif`,
    '--cap-size': `${Math.round(cap.fontSize * 0.7)}px`,
    '--cap-pad-x': `${Math.round(cap.paddingX * 0.7)}px`,
    '--cap-pad-y': `${Math.round(cap.paddingY * 0.7)}px`,
    '--cap-radius': `${cap.borderRadius}px`,
    '--cap-max': `${Math.round(cap.maxWidth * 0.55)}px`,
  };

  const ltClasses = [
    'lower-third',
    `bg-${lt.backgroundType || 'gradient'}`,
    `pos-${lt.position || 'bottom-left'}`,
    lt.shadow ? 'has-shadow' : '',
    lt.showAccentBar ? (lt.accentBarPosition === 'top' ? 'show-accent-top' : 'show-accent-left') : '',
    lt.animation === 'fade' ? 'anim-fade' : 'anim-slide-up',
    showVerse ? 'visible' : 'hidden',
  ]
    .filter(Boolean)
    .join(' ');

  const capClasses = [
    'captions',
    `pos-${cap.position || 'bottom'}`,
    cap.shadow ? 'has-shadow' : '',
    showCaptions && captions ? 'visible' : 'hidden',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="preview-panel">
      <div className="preview-head">
        <h2>Program preview</h2>
        {overlayInfo && <span className="muted">Port {overlayInfo.port}</span>}
      </div>
      <div className="preview-frame">
        <div className="preview-canvas">
          <div className={`mini ${ltClasses}`} style={ltStyle}>
            <div className="lt-accent" />
            <div className="lt-body">
              <div className="lt-reference">{verse?.reference || 'John 3:16'}</div>
              <div className="lt-text">
                {verse?.text ||
                  'For God so loved the world, that he gave his only born Son…'}
              </div>
            </div>
          </div>
          <div className={`mini ${capClasses}`} style={capStyle}>
            <div className="captions-text" style={{ WebkitLineClamp: cap.lines || 2 }}>
              {captions || 'Captions appear here'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
