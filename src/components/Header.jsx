export default function Header({ platform, listening, electron, saveFlash }) {
  const platformLabel =
    platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'web' ? 'Web preview' : platform;

  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark">VerseCast</div>
        <p className="brand-tag">Live scripture & captions for church streams</p>
      </div>
      <div className="header-meta">
        {saveFlash && <span className="pill pill-save">Saved</span>}
        <span className={`pill ${listening ? 'pill-live' : ''}`}>
          {listening ? 'Listening' : 'Standby'}
        </span>
        <span className="pill">{platformLabel}{electron ? '' : ' · limited'}</span>
      </div>
    </header>
  );
}
