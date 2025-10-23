import React, { useEffect, useState } from 'react';
import VideoPlayer from './VideoPlayer';

export default function EpisodesList() {
  const [episodes, setEpisodes] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/episodes')
      .then(r => r.json())
      .then(j => setEpisodes((j && j.data) || []))
      .catch(() => setEpisodes([]));
  }, []);

  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
      <div style={{ width: 320 }}>
        <h4>Episodes</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {episodes.length === 0 && <div className="muted">No episodes found</div>}
          {episodes.map(ep => (
            <div key={ep.id} className="list-item" onClick={() => setSelected(ep)}>
              <strong>{ep.title}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{new Date(ep.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {selected ? (
          <div>
            <VideoPlayer src={selected.preview} title={selected.title} />
            <pre className="pre" style={{ marginTop: 8 }}>{JSON.stringify(selected, null, 2)}</pre>
          </div>
        ) : (
          <div className="muted">Select an episode to preview</div>
        )}
      </div>
    </div>
  );
}
