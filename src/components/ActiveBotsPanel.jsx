import React, { useEffect, useState } from 'react';
import AiStream from './AiStream';
import { Director, Play } from './Icons';

function ActiveBotsPanel({ episodeId }) {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [isRunning, setIsRunning] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  // configurable local endpoint (MYLOCAL ENDPOINT)
  const [apiBase, setApiBase] = useState('');
  const [apiInput, setApiInput] = useState('');

  useEffect(() => {
    // load existing characters file from project
    fetch('/src/data/characters.json')
      .then(r => r.json())
      .then(list => setCharacters(Array.isArray(list) ? list : []))
      .catch(() => setCharacters([]));

    const saved = localStorage.getItem('myLocalEndpoint') || '';
    setApiBase(saved);
    setApiInput(saved);
  }, []);

  function toggleCharacter(name) {
    setSelectedCharacters(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  }

  function buildUrl(name) {
    const prefix = (apiBase || '').replace(/\/$/, '');
    if (!prefix) return `/functions/v1/${name}`;
    return `${prefix}/functions/v1/${name}`;
  }

  async function invokeFunction(name, body) {
    setIsRunning(name);
    setLastResult(null);
    try {
      const url = buildUrl(name);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const data = await res.json();
      setLastResult({ name, url, data });
      return data;
    } catch (err) {
      setLastResult({ name, error: err.message || String(err) });
      return null;
    } finally {
      setIsRunning(null);
    }
  }

  function saveApiBase() {
    const v = (apiInput || '').trim();
    setApiBase(v);
    localStorage.setItem('myLocalEndpoint', v);
  }

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>AI Bots & Characters</h3>

      <div className="grid">
        <div className="card">
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>Local API endpoint</label>
            <div className="endpoint-input" style={{ marginTop: 6 }}>
              <input
                value={apiInput}
                onChange={(e) => setApiInput(e.target.value)}
                placeholder="http://localhost:5000"
              />
              <button className="btn secondary" onClick={saveApiBase}>Save</button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>Using: <strong>{apiBase || 'same origin'}</strong></div>
          </div>

          <h4 style={{ marginTop: 12 }}>Characters</h4>
          {characters.length === 0 ? (
            <p className="muted">No characters found</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {characters.map((c) => (
                <label key={c} className="list-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedCharacters.includes(c)}
                    onChange={() => toggleCharacter(c)}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h4>Expert Director</h4>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a creative prompt for the director"
            style={{ width: '100%', borderRadius: 8, padding: 8, background: 'rgba(255,255,255,0.02)', color: 'inherit', border: '1px solid rgba(255,255,255,0.03)'}}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => invokeFunction('generate-director-guidance', { prompt, episodeId, characters: selectedCharacters })} disabled={isRunning}><Director /> {isRunning === 'generate-director-guidance' ? 'Running...' : 'Run Director'}</button>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Quick prompt for streaming" style={{ display: 'none' }} />
            </div>
          </div>

          <h4 style={{ marginTop: 16 }}>Scene Orchestration</h4>
          <textarea
            rows={3}
            value={scenePrompt}
            onChange={(e) => setScenePrompt(e.target.value)}
            placeholder="Short scene prompt, e.g. 'Amal exposes Nasra at brunch'"
            style={{ width: '100%', borderRadius: 8, padding: 8, background: 'rgba(255,255,255,0.02)', color: 'inherit', border: '1px solid rgba(255,255,255,0.03)'}}
          />
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => invokeFunction('scene-orchestration', { shortPrompt: scenePrompt, episodeId, characters: selectedCharacters })} disabled={isRunning}>{isRunning === 'scene-orchestration' ? 'Generating...' : 'Generate Scene'}</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>Live Director Stream</h4>
            <AiStream prompt={prompt} name={(selectedCharacters[0]||'director')} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="card">
        <h4>Last result</h4>
        <pre className="pre" style={{ maxHeight: 220, overflow: 'auto' }}>{lastResult ? JSON.stringify(lastResult, null, 2) : 'No results yet'}</pre>
      </div>
    </div>
  );
}

export default ActiveBotsPanel;
