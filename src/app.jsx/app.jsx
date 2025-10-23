import React from 'react';
import '../index.css';
import StudioDashboard from './components/StudioDashboard';
import AddCharacter from './components/AddCharacter';
import UploadCharacters from './components/UploadCharacters';

function App() {
  return (
    <div className="app-wrap">
      <h1 className="site-h1">🎬 Charactermaker Verse</h1>
      <div className="dashboard">
        <StudioDashboard />
      </div>
      <div style={{ marginTop: 18 }}>
        <AddCharacter />
        <UploadCharacters />
      </div>
    </div>
  );
}

export default App;
