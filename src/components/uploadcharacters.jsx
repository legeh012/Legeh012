import React, { useState } from 'react';
import axios from 'axios';

function UploadCharacters() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload-characters', formData);
      setStatus(`✅ Uploaded ${res.data.count} characters`);
    } catch (err) {
      setStatus('❌ Upload failed. Check file format.');
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>📤 Upload Cast List</h2>
      <input type="file" accept=".json,.txt" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}>Upload</button>
      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
    </div>
  );
}

export default UploadCharacters;
