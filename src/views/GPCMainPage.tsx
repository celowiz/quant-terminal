import { tc } from '../lib/themeRuntime'
 

function GPCMainPage() {
  return (
    <div className="terminal-root homepage-root min-h-screen lg:min-h-0 lg:flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="homepage-center-panel">
          <h1 style={{ color: tc('#FFA028'), fontWeight: 700, fontSize: '2.2rem', textAlign: 'center', marginBottom: 18 }}>Candle Graph</h1>
          <p className="homepage-desc" style={{ color: tc('#fff'), textAlign: 'center', fontSize: '1.2rem', fontWeight: 500 }}>
            Please, select ticker above to load chart.
          </p>
        </div>
      </div>
    </div>
  );
}

export default GPCMainPage; 