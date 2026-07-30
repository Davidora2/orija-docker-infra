import { useState } from 'react';
import { pickImage } from '../lib/bridge';
import PreviewStage from './PreviewStage.jsx';

const FONTS = [
  'Cormorant Garamond',
  'Libre Baskerville',
  'DM Sans',
  'Georgia',
  'Palatino Linotype',
];

const PRESETS = [
  {
    name: 'Sanctuary Ink',
    lowerThird: {
      backgroundType: 'gradient',
      backgroundColor: '#0c1a24',
      backgroundColor2: '#1a3a4a',
      textColor: '#f5f0e8',
      accentColor: '#c9a227',
      referenceColor: '#c9a227',
      fontFamily: 'Cormorant Garamond',
      showAccentBar: true,
      accentBarPosition: 'left',
      borderRadius: 0,
    },
  },
  {
    name: 'Morning Light',
    lowerThird: {
      backgroundType: 'gradient',
      backgroundColor: '#f7f3ea',
      backgroundColor2: '#e8dcc8',
      textColor: '#1d2a24',
      accentColor: '#2f6b4f',
      referenceColor: '#2f6b4f',
      fontFamily: 'Libre Baskerville',
      showAccentBar: true,
      accentBarPosition: 'top',
      borderRadius: 4,
    },
  },
  {
    name: 'Midnight Glass',
    lowerThird: {
      backgroundType: 'solid',
      backgroundColor: 'rgba(8, 12, 18, 0.88)',
      backgroundColor2: '#081018',
      textColor: '#eef3f6',
      accentColor: '#7eb8c9',
      referenceColor: '#7eb8c9',
      fontFamily: 'DM Sans',
      showAccentBar: false,
      borderRadius: 12,
    },
  },
];

export default function ThemePanel({ settings, onChange }) {
  const [section, setSection] = useState('lowerThird');
  const theme = settings.theme;
  const sampleVerse = {
    reference: 'John 3:16',
    text: 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
  };

  const patch = (key, patchObj) => {
    onChange({
      ...settings,
      theme: {
        ...theme,
        [key]: { ...theme[key], ...patchObj },
      },
    });
  };

  const applyPreset = (preset) => {
    patch('lowerThird', preset.lowerThird);
  };

  const onPickBg = async () => {
    const dataUrl = await pickImage();
    if (dataUrl) {
      patch('lowerThird', { backgroundType: 'image', backgroundImage: dataUrl });
    }
  };

  const lt = theme.lowerThird;
  const cap = theme.captions;

  return (
    <div className="theme-layout">
      <div className="theme-controls">
        <section className="panel">
          <div className="panel-head">
            <h2>Graphics</h2>
          </div>
          <p className="panel-copy">
            Customize lower-third and caption looks. Changes sync live to OBS Browser Sources.
          </p>

          <div className="segmented">
            <button
              type="button"
              className={section === 'lowerThird' ? 'active' : ''}
              onClick={() => setSection('lowerThird')}
            >
              Lower third
            </button>
            <button
              type="button"
              className={section === 'captions' ? 'active' : ''}
              onClick={() => setSection('captions')}
            >
              Captions
            </button>
          </div>

          {section === 'lowerThird' && (
            <div className="form-grid">
              <div className="preset-row">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="chip" onClick={() => applyPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>

              <label>
                Background
                <select
                  value={lt.backgroundType}
                  onChange={(e) => patch('lowerThird', { backgroundType: e.target.value })}
                >
                  <option value="gradient">Gradient</option>
                  <option value="solid">Solid</option>
                  <option value="image">Image</option>
                </select>
              </label>

              <div className="color-row">
                <label>
                  Color A
                  <input
                    type="color"
                    value={toHex(lt.backgroundColor)}
                    onChange={(e) => patch('lowerThird', { backgroundColor: e.target.value })}
                  />
                </label>
                <label>
                  Color B
                  <input
                    type="color"
                    value={toHex(lt.backgroundColor2)}
                    onChange={(e) => patch('lowerThird', { backgroundColor2: e.target.value })}
                  />
                </label>
                <label>
                  Text
                  <input
                    type="color"
                    value={toHex(lt.textColor)}
                    onChange={(e) => patch('lowerThird', { textColor: e.target.value })}
                  />
                </label>
                <label>
                  Accent
                  <input
                    type="color"
                    value={toHex(lt.accentColor)}
                    onChange={(e) =>
                      patch('lowerThird', {
                        accentColor: e.target.value,
                        referenceColor: e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              {lt.backgroundType === 'image' && (
                <button type="button" className="btn ghost" onClick={onPickBg}>
                  Choose background image
                </button>
              )}

              <label>
                Verse font
                <select
                  value={lt.fontFamily}
                  onChange={(e) => patch('lowerThird', { fontFamily: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Reference font
                <select
                  value={lt.referenceFontFamily}
                  onChange={(e) => patch('lowerThird', { referenceFontFamily: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Verse size ({lt.fontSize}px)
                <input
                  type="range"
                  min="18"
                  max="48"
                  value={lt.fontSize}
                  onChange={(e) => patch('lowerThird', { fontSize: Number(e.target.value) })}
                />
              </label>

              <label>
                Position
                <select
                  value={lt.position}
                  onChange={(e) => patch('lowerThird', { position: e.target.value })}
                >
                  <option value="bottom-left">Bottom left</option>
                  <option value="bottom-center">Bottom center</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                </select>
              </label>

              <label>
                Animation
                <select
                  value={lt.animation}
                  onChange={(e) => patch('lowerThird', { animation: e.target.value })}
                >
                  <option value="slide-up">Slide up</option>
                  <option value="fade">Fade</option>
                </select>
              </label>

              <label>
                Corner radius ({lt.borderRadius}px)
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={lt.borderRadius}
                  onChange={(e) => patch('lowerThird', { borderRadius: Number(e.target.value) })}
                />
              </label>

              <label>
                Max width ({lt.maxWidth}px)
                <input
                  type="range"
                  min="420"
                  max="1100"
                  step="10"
                  value={lt.maxWidth}
                  onChange={(e) => patch('lowerThird', { maxWidth: Number(e.target.value) })}
                />
              </label>

              <div className="toggle-row">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={lt.showAccentBar}
                    onChange={(e) => patch('lowerThird', { showAccentBar: e.target.checked })}
                  />
                  Accent bar
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={lt.shadow}
                    onChange={(e) => patch('lowerThird', { shadow: e.target.checked })}
                  />
                  Shadow
                </label>
              </div>

              {lt.showAccentBar && (
                <label>
                  Accent placement
                  <select
                    value={lt.accentBarPosition}
                    onChange={(e) => patch('lowerThird', { accentBarPosition: e.target.value })}
                  >
                    <option value="left">Left</option>
                    <option value="top">Top</option>
                  </select>
                </label>
              )}
            </div>
          )}

          {section === 'captions' && (
            <div className="form-grid">
              <div className="color-row">
                <label>
                  Background
                  <input
                    type="color"
                    value={rgbaToHex(cap.backgroundColor)}
                    onChange={(e) =>
                      patch('captions', { backgroundColor: hexToRgba(e.target.value, 0.72) })
                    }
                  />
                </label>
                <label>
                  Text
                  <input
                    type="color"
                    value={toHex(cap.textColor)}
                    onChange={(e) => patch('captions', { textColor: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Font
                <select
                  value={cap.fontFamily}
                  onChange={(e) => patch('captions', { fontFamily: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Size ({cap.fontSize}px)
                <input
                  type="range"
                  min="16"
                  max="40"
                  value={cap.fontSize}
                  onChange={(e) => patch('captions', { fontSize: Number(e.target.value) })}
                />
              </label>

              <label>
                Position
                <select
                  value={cap.position}
                  onChange={(e) => patch('captions', { position: e.target.value })}
                >
                  <option value="bottom">Bottom</option>
                  <option value="bottom-high">Above lower third</option>
                  <option value="top">Top</option>
                </select>
              </label>

              <label>
                Corner radius ({cap.borderRadius}px)
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={cap.borderRadius}
                  onChange={(e) => patch('captions', { borderRadius: Number(e.target.value) })}
                />
              </label>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={cap.shadow}
                  onChange={(e) => patch('captions', { shadow: e.target.checked })}
                />
                Shadow
              </label>
            </div>
          )}
        </section>
      </div>

      <PreviewStage
        theme={theme}
        verse={sampleVerse}
        captions="Blessed are the peacemakers, for they shall be called children of God."
        overlayInfo={null}
        forceVisible
      />
    </div>
  );
}

function toHex(color) {
  if (!color) return '#000000';
  if (color.startsWith('#') && color.length === 7) return color;
  const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#0c1a24';
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbaToHex(color) {
  return toHex(color);
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
