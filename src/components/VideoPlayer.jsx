import React from 'react';

export default function VideoPlayer({ src, title }) {
  if (!src) return <div className="muted" style={{ padding: 12 }}>No video source</div>;
  return (
    <div style={{ maxWidth: 720 }}>
      <h4>{title}</h4>
      <div className="video">
        <video controls style={{ width: '100%', height: '100%' }}>
          <source src={src} />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
