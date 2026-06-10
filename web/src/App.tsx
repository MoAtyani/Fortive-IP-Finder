import { useState, useEffect } from 'react';
import { Search, Settings, Server, Shield, Activity, Save, Play, RefreshCw, CheckCircle } from 'lucide-react';
import './index.css';

interface ScanResult {
  url: string;
  ip: string;
  source: string;
  title: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'settings'>('scanner');
  
  // Scan State
  const [domains, setDomains] = useState('');
  const [options, setOptions] = useState({
    censys: true,
    securitytrails: true,
    shodan: true,
    zoomeye: true,
    ja3: '',
    user_agent: ''
  });
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<ScanResult[]>([]);
  
  // Config State
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string[] }>({
    censys: [''],
    securitytrails: [''],
    shodan: [''],
    zoomeye: ['']
  });
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          setApiKeys({
            censys: data.censys || [''],
            securitytrails: data.securitytrails || [''],
            shodan: data.shodan || [''],
            zoomeye: data.zoomeye || ['']
          });
        })
        .catch(err => console.error(err));
    }
  }, [activeTab]);

  const handleSaveConfig = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeys)
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async () => {
    if (!domains.trim()) return;
    setIsScanning(true);
    setResults([]);
    setStatus('Initializing scan...');
    
    const domainList = domains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d)
      .map(d => {
        let url = d;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        try {
          const parsed = new URL(url);
          return parsed.protocol + '//' + parsed.host;
        } catch (e) {
          return url;
        }
      });
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domains: domainList,
          ...options
        })
      });

      if (!response.body) throw new Error('No readable stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        
        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let eventData = '';
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.substring(6);
            }
          }
          
          if (eventType === 'status') {
            setStatus(eventData);
          } else if (eventType === 'result') {
            const res = JSON.parse(eventData);
            setResults(prev => [...prev, res]);
          } else if (eventType === 'done') {
            setIsScanning(false);
            setStatus('Scan Complete');
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('Error occurred during scan.');
      setIsScanning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{ padding: '24px 40px', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)' }}>
        <Shield size={32} color="var(--primary)" />
        <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>Fortive IP Finder <span style={{ color: 'var(--primary)', fontWeight: '300' }}>Dashboard</span></h1>
        <div style={{ flex: 1 }} />
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'scanner' ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab('scanner')}
            style={{ borderRadius: '20px' }}
          >
            <Activity size={16} /> Scanner
          </button>
          <button 
            className={`btn ${activeTab === 'settings' ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab('settings')}
            style={{ borderRadius: '20px' }}
          >
            <Settings size={16} /> API Keys
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {activeTab === 'scanner' ? (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px', maxWidth: '100%', margin: '0 auto', width: '100%' }}>
            
            {/* Left Column: Input */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Search size={20}/> Target Domains</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>Enter URLs to scan (one per line). Must start with http:// or https://</p>
                <textarea 
                  className="input-field" 
                  value={domains}
                  onChange={e => setDomains(e.target.value)}
                  placeholder="https://example.com&#10;https://target.net"
                  style={{ height: '160px', fontFamily: 'monospace' }}
                  disabled={isScanning}
                />
              </div>

              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Server size={20}/> Intelligence Sources</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {['censys', 'shodan', 'zoomeye', 'securitytrails'].map(source => (
                    <label key={source} className="checkbox-container">
                      <input 
                        type="checkbox" 
                        checked={options[source as keyof typeof options] as boolean}
                        onChange={e => setOptions({...options, [source]: e.target.checked})}
                        disabled={isScanning}
                      />
                      <div className="checkbox-custom" />
                      <span style={{ textTransform: 'capitalize' }}>{source}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Advanced</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Custom JA3 (optional)" 
                    value={options.ja3}
                    onChange={e => setOptions({...options, ja3: e.target.value})}
                    disabled={isScanning}
                  />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Custom User-Agent (optional)" 
                    value={options.user_agent}
                    onChange={e => setOptions({...options, user_agent: e.target.value})}
                    disabled={isScanning}
                  />
                </div>
              </div>

              <button 
                className={`btn ${isScanning ? '' : 'btn-pulse'}`} 
                onClick={handleScan}
                disabled={isScanning || !domains.trim()}
                style={{ padding: '16px', fontSize: '16px', marginTop: 'auto' }}
              >
                {isScanning ? <><RefreshCw size={20} className="spinner" /> Scanning...</> : <><Play size={20} /> Start Discovery</>}
              </button>
            </div>

            {/* Right Column: Results */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  Live Results
                  {status && <span className="badge badge-info">{status}</span>}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Found: <strong style={{ color: 'white' }}>{results.length}</strong>
                </div>
              </div>
              
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid var(--glass-border)', overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 3.5fr 3fr', minWidth: '900px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, fontSize: '14px' }}>
                  <div>Target</div>
                  <div>Origin IP</div>
                  <div>Source</div>
                  <div>Match Title</div>
                </div>
                
                {/* Table Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {results.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      {isScanning ? 'Awaiting discoveries...' : 'No results yet. Start a scan to find origin IPs.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {results.map((res, idx) => (
                        <div key={idx} className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 3.5fr 3fr', minWidth: '900px', padding: '12px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '14px', alignItems: 'center' }}>
                          <div style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{res.url}</div>
                          <div style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>{res.ip}</div>
                          <div><span className="badge badge-warning">{res.source}</span></div>
                          <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        ) : (
          /* Settings Tab */
          <div className="animate-fade-in glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <Settings size={24} color="var(--primary)" /> API Configuration
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {['zoomeye', 'securitytrails', 'shodan', 'censys'].map(source => (
                <div key={source}>
                  <label style={{ display: 'block', marginBottom: '8px', textTransform: 'capitalize', fontWeight: 500 }}>{source} API Key</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder={`Enter ${source} key...`}
                    value={apiKeys[source]?.[0] || ''}
                    onChange={e => setApiKeys({...apiKeys, [source]: [e.target.value]})}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button className="btn" onClick={handleSaveConfig}>
                <Save size={18} /> Save Configuration
              </button>
              {configSaved && (
                <span className="animate-fade-in" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Saved to ~/.config/fortive-ip-finder.yaml
                </span>
              )}
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
