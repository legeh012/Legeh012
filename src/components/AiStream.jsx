import React, { useEffect, useRef, useState } from 'react';

export default function AiStream({ prompt = '', name = 'director', style = 'neutral' }) {
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }
  }, []);

  function start() {
    if (!prompt) return;
    setLines([]);
    setRunning(true);
    // build URL
    const params = new URLSearchParams({ prompt, name, style });
    const url = (window.__MY_API_BASE__ ? window.__MY_API_BASE__ : '') + `/ai/stream?${params.toString()}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (e) => {
      // append token
      setLines(prev => [...prev, e.data]);
    };
    es.addEventListener('done', () => {
      setRunning(false);
      es.close();
      esRef.current = null;
    });
    es.onerror = (err) => {
      console.warn('SSE error', err);
      setRunning(false);
      try { es.close(); } catch (_) {}
      esRef.current = null;
    };
  }

  function stop() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setRunning(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="btn" onClick={start} disabled={running || !prompt}>{running ? 'Listening...' : 'Start Stream'}</button>
        <button className="btn secondary" onClick={stop} disabled={!running}>Stop</button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, minHeight: 80 }}>
        {lines.length === 0 ? <span className="muted">No stream yet</span> : lines.join(' ')}
      </div>
    </div>
  );
}
