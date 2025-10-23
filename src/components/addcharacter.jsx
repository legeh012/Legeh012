import React, { useState } from 'react';
import axios from 'axios';

function AddCharacter() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await axios.post('/api/characters', { name: name.trim() });
    setStatus(`✅ ${name} added to cast`);
    setName('');
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>➕ Add New Character</h2>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Enter character name"
        style={{ padding: '0.5rem', marginRight: '1rem' }}
      />
      <button onClick={handleAdd} style={{ padding: '0.5rem 1rem' }}>Add</button>
      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
    </div>
  );
}

export default AddCharacter;
