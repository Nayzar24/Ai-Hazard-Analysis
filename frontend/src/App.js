import React, { useState, useEffect } from 'react';
import './App.css';
import { FaFlask, FaInfoCircle, FaEnvelope, FaBars, FaUserCircle, FaSearch, FaSignOutAlt, FaGoogle, FaComments, FaTimes } from 'react-icons/fa';
import logo from './logo.svg';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { API_ENDPOINTS } from './config';

function cleanLine(line) {
  // Remove hashtags, asterisks, dashes, and excessive punctuation/whitespace
  return line
    .replace(/[#*\-•]+/g, '') // Remove #, *, -, •
    .replace(/^[\s\d.]+/, '') // Remove leading whitespace, numbers, dots
    .replace(/[\s]+$/, '') // Remove trailing whitespace
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .replace(/\s*([.,;:])\s*/g, '$1 ') // Clean up punctuation spacing
    .replace(/\s+([.,;:])/g, '$1') // Remove space before punctuation
    .replace(/\s{2,}/g, ' ') // Collapse again
    .trim();
}

function parseReport(report) {
  // Split report into Hazards and Safeguards sections
  const hazardsMatch = report.match(/Hazards:?([\s\S]*?)(Safeguards:|$)/i);
  const safeguardsMatch = report.match(/Safeguards:?([\s\S]*)/i);
  const hazards = hazardsMatch ? hazardsMatch[1].trim().split(/\n|\r/).map(cleanLine).filter(l => l.length > 0) : [];
  const safeguards = safeguardsMatch ? safeguardsMatch[1].trim().split(/\n|\r/).map(cleanLine).filter(l => l.length > 0) : [];
  return { hazards, safeguards };
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
      <div className="lds-ring" style={{ width: 40, height: 40 }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" stroke="#0d6efd" strokeWidth="4" fill="none" strokeDasharray="80" strokeDashoffset="60">
            <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    </div>
  );
}

function Sidebar({ currentTab, setTab, navTabs }) {
  const nav = navTabs.map(item => (
    <button
      key={item.key}
      className={currentTab === item.key ? 'sidebar-nav-btn active' : 'sidebar-nav-btn'}
      onClick={() => setTab(item.key)}
      tabIndex={0}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  ));
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="Logo" className="sidebar-logo-img" />
      </div>
      <nav className="sidebar-nav">
        {nav}
      </nav>
    </aside>
  );
}

function TopBar({ user, onLogout, onShowAuth, onToggleChat }) {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <FaSearch className="topbar-search-icon" />
        <input className="topbar-search-input" placeholder="Search..." />
      </div>
      <div className="topbar-user">
        <button 
          className="chat-toggle-btn" 
          onClick={onToggleChat} 
          title="Safety Analysis Chat"
        >
          <FaComments />
        </button>
        {user ? (
          <>
            <FaUserCircle size={32} />
            <span className="topbar-username">{user.displayName || user.email}</span>
            <button className="logout-btn" onClick={onLogout} title="Sign out"><FaSignOutAlt /></button>
          </>
        ) : (
          <button className="cta-btn" style={{padding: '8px 18px', fontSize: '1rem', marginLeft: 8}} onClick={onShowAuth}>Sign In</button>
        )}
      </div>
    </header>
  );
}

function AuthModal({ show, onClose, onAuth }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!show) return null;
  return (
    <div className="auth-modal-bg">
      <div className="auth-modal">
        <h2>{isSignup ? 'Sign Up' : 'Sign In'}</h2>
        <form onSubmit={handleEmailAuth}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="cta-btn">{isSignup ? 'Sign Up' : 'Sign In'}</button>
        </form>
        <button className="google-btn" onClick={handleGoogle}><FaGoogle /> Continue with Google</button>
        <div className="auth-switch">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setIsSignup(!isSignup)}>{isSignup ? 'Sign In' : 'Sign Up'}</button>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="auth-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
}

function capitalizeSentence(str) {
  if (!str) return '';
  let s = str.trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function joinWithAnd(arr) {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

function isSubheading(line) {
  // Subheading: short, not a full sentence, may end with colon/period, not just a bullet
  const trimmed = line.trim();
  // Remove trailing colon/period for detection
  const base = trimmed.replace(/[:.]+$/, '');
  // Not a full sentence, not empty, not just a bullet
  return (
    base.length > 0 &&
    /^[A-Z][A-Za-z0-9\s]+$/.test(base) &&
    base.length < 50 &&
    !/[.!?]$/.test(base)
  );
}

function cleanHazardsOrSafeguards(arr) {
  // Remove nonsense or prompt artifact bullets
  return arr.filter(
    l => l &&
      !/^and recommended safeguards/i.test(l) &&
      !/^hazards?$/i.test(l) &&
      !/^safeguards?$/i.test(l)
  );
}

function HumanReport({ unit, temp, tempUnit, pressure, pressureUnit, chemicals, hazards, safeguards, flowRate, operationPhase, equipmentVolume, phase, location, utilities }) {
  const chemList = chemicals.filter(Boolean);
  // Clean and split hazards/safeguards into subheadings and explanations
  const cleanedHazards = cleanHazardsOrSafeguards(hazards);
  const cleanedSafeguards = cleanHazardsOrSafeguards(safeguards);

  function renderSection(arr) {
    const elements = [];
    let i = 0;
    while (i < arr.length) {
      if (isSubheading(arr[i])) {
        // Render as subheading
        const heading = arr[i].replace(/[:.]+$/, '') + ':';
        elements.push(
          <div key={i} style={{ fontWeight: 700, fontSize: '1.13em', marginTop: 18, marginBottom: 2 }}>
            {heading}
          </div>
        );
        i++;
        // Render following lines as bullets until next subheading or end
        const bullets = [];
        while (i < arr.length && !isSubheading(arr[i])) {
          // Only add as bullet if not a subheading or empty
          if (arr[i].trim().length > 0) {
            bullets.push(
              <li key={i} style={{ marginBottom: 8 }}>{capitalizeSentence(arr[i])}</li>
            );
          }
          i++;
        }
        if (bullets.length > 0) {
          elements.push(<ul className="styled-list" style={{ marginTop: 0 }}>{bullets}</ul>);
        }
      } else {
        // If not a subheading, just render as a bullet
        if (arr[i].trim().length > 0) {
          elements.push(
            <ul className="styled-list" key={i} style={{ marginTop: 0 }}>
              <li>{capitalizeSentence(arr[i])}</li>
            </ul>
          );
        }
        i++;
      }
    }
    return elements;
  }

  return (
    <div className="human-report">
      <div className="report-section">
        <div className="section-title">Process Overview</div>
        <div className="section-body">
          <p>
            <strong>Unit:</strong> <span className="highlight">{unit}</span><br />
            <strong>Operating Conditions:</strong> <span className="highlight">{temp} {tempUnit}</span>, <span className="highlight">{pressure} {pressureUnit}</span><br />
            {flowRate && <><strong>Flow Rate:</strong> <span className="highlight">{flowRate}</span><br /></>}
            {operationPhase && <><strong>Operation Phase:</strong> <span className="highlight">{operationPhase}</span><br /></>}
            {equipmentVolume && <><strong>Equipment Volume:</strong> <span className="highlight">{equipmentVolume}</span><br /></>}
            {phase && <><strong>Phase:</strong> <span className="highlight">{phase}</span><br /></>}
            {location && <><strong>Location:</strong> <span className="highlight">{location}</span><br /></>}
            {utilities && utilities.length > 0 && <><strong>Utilities:</strong> <span className="highlight">{utilities.join(', ')}</span><br /></>}
            {chemList.length > 0 && (
              <><strong>Chemicals:</strong> <span className="highlight">{joinWithAnd(chemList)}</span></>
            )}
          </p>
        </div>
      </div>
      <div className="divider" />
      <div className="report-section">
        <div className="section-title">Identified Hazards</div>
        <div className="section-body">
          {cleanedHazards.length > 0 ? (
            renderSection(cleanedHazards)
          ) : (
            <p>No significant hazards identified based on the provided data.</p>
          )}
        </div>
      </div>
      <div className="divider" />
      <div className="report-section">
        <div className="section-title">Recommended Safeguards</div>
        <div className="section-body">
          {cleanedSafeguards.length > 0 ? (
            renderSection(cleanedSafeguards)
          ) : (
            <p>No specific safeguards recommended for the current scenario.</p>
          )}
        </div>
      </div>
      <div className="divider" />
      <div className="report-section">
        <div className="section-body" style={{ color: '#888', fontSize: '0.98rem', marginTop: 18 }}>
          <em>This report is generated based on the provided process data and current best practices in process safety engineering. Please review all recommendations with your safety team.</em>
        </div>
      </div>
    </div>
  );
}

function HazardAnalysisTab({ onSubmit, loading, error, report, unit, setUnit, temp, setTemp, tempUnit, setTempUnit, pressure, setPressure, pressureUnit, setPressureUnit, chemicals, setChemicals, resetLoadingState }) {
  const [flowRate, setFlowRate] = useState('');
  const [flowRateUnit, setFlowRateUnit] = useState('L/min');
  const [operationPhase, setOperationPhase] = useState('');
  const [equipmentVolume, setEquipmentVolume] = useState('');
  const [volumeUnit, setVolumeUnit] = useState('L');
  const [phase, setPhase] = useState('');
  const [location, setLocation] = useState('');
  const [locationProximity, setLocationProximity] = useState('');
  const { hazards, safeguards } = report ? parseReport(report) : { hazards: [], safeguards: [] };
  
  return (
    <>
      <form className="card" onSubmit={e => onSubmit(e, tempUnit, pressureUnit, flowRate, flowRateUnit, operationPhase, equipmentVolume, volumeUnit, phase, location, locationProximity, [])}>
        <div>
          <label htmlFor="unit">Unit operation</label>
          <input 
            id="unit" 
            value={unit} 
            onChange={e => setUnit(e.target.value)} 
            required 
            placeholder="e.g., Reactor"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e1e5e9',
              fontSize: '14px',
              width: '100%',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007bff'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>
        
        <div>
          <label htmlFor="temp">Temperature</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              id="temp" 
              type="number" 
              value={temp} 
              onChange={e => setTemp(e.target.value)} 
              required 
              style={{ 
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
            <select 
              value={tempUnit} 
              onChange={e => setTempUnit(e.target.value)} 
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '12px auto',
                minWidth: '80px'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              <option value="K">K</option>
              <option value="°C">°C</option>
              <option value="°F">°F</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="pressure">Pressure</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              id="pressure" 
              type="number" 
              value={pressure} 
              onChange={e => setPressure(e.target.value)} 
              required 
              style={{ 
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
            <select 
              value={pressureUnit} 
              onChange={e => setPressureUnit(e.target.value)} 
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '12px auto',
                minWidth: '80px'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              <option value="atm">atm</option>
              <option value="bar">bar</option>
              <option value="Pa">Pa</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="flowRate">Flow Rate (optional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              id="flowRate" 
              type="number" 
              value={flowRate} 
              onChange={e => setFlowRate(e.target.value)} 
              style={{ 
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }} 
              placeholder="e.g., 100"
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
            <select 
              value={flowRateUnit} 
              onChange={e => setFlowRateUnit(e.target.value)} 
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '12px auto',
                minWidth: '100px'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              <option value="L/min">L/min</option>
              <option value="L/hr">L/hr</option>
              <option value="m³/hr">m³/hr</option>
              <option value="kg/hr">kg/hr</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="operationPhase">Operation Phase (optional)</label>
          <select 
            id="operationPhase" 
            value={operationPhase} 
            onChange={e => setOperationPhase(e.target.value)}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e1e5e9',
              backgroundColor: '#ffffff',
              fontSize: '14px',
              width: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '12px auto'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007bff'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          >
            <option value="">Select operation phase...</option>
            <option value="startup">🚀 Startup</option>
            <option value="steady">⚖️ Steady State</option>
            <option value="shutdown">🛑 Shutdown</option>
            <option value="maintenance">🔧 Maintenance</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="equipmentVolume">Equipment Volume (optional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              id="equipmentVolume" 
              type="number" 
              value={equipmentVolume} 
              onChange={e => setEquipmentVolume(e.target.value)} 
              style={{ 
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }} 
              placeholder="e.g., 1000"
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
            <select 
              value={volumeUnit} 
              onChange={e => setVolumeUnit(e.target.value)} 
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '12px auto',
                minWidth: '80px'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              <option value="L">L</option>
              <option value="m³">m³</option>
              <option value="gal">gal</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="phase">Phase (optional)</label>
          <select 
            id="phase" 
            value={phase} 
            onChange={e => setPhase(e.target.value)}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e1e5e9',
              backgroundColor: '#ffffff',
              fontSize: '14px',
              width: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '12px auto'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007bff'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          >
            <option value="">Select material phase...</option>
            <option value="vapor">💨 Vapor</option>
            <option value="liquid">💧 Liquid</option>
            <option value="two-phase">🌊 Two-Phase</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="location">Location (optional)</label>
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <select 
              id="location" 
              value={location} 
              onChange={e => setLocation(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                width: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '12px auto'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            >
              <option value="">Select location type...</option>
              <option value="indoor">🏢 Indoor</option>
              <option value="outdoor">🌳 Outdoor</option>
            </select>
            {location && (
              <input 
                type="text" 
                value={locationProximity} 
                onChange={e => setLocationProximity(e.target.value)} 
                placeholder="Proximity details (e.g., near control room, 50m from residential area)"
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e1e5e9',
                  fontSize: '14px',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            )}
          </div>
        </div>
        

        
        <div>
          <label htmlFor="chemicals">Chemicals (comma separated)</label>
          <input 
            id="chemicals" 
            value={chemicals} 
            onChange={e => setChemicals(e.target.value)} 
            required 
            placeholder="e.g., H2, O2, N2"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e1e5e9',
              fontSize: '14px',
              width: '100%',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007bff'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>
        
        <button className="cta-btn" type="submit" disabled={loading}>
          {loading ? <Spinner /> : <><span role="img" aria-label="search">🔍</span> Analyze Hazards</>}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      {loading && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button 
            onClick={resetLoadingState}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Reset
          </button>
        </div>
      )}
      {report && (
        <div className="result-card">
          <button className="export-btn" onClick={() => exportReportPDF({ unit, temp, tempUnit, pressure, pressureUnit, chemicals: chemicals.split(',').map(c => c.trim()), hazards, safeguards })}>
            Export as PDF
          </button>
          <HumanReport
            unit={unit}
            temp={temp}
            tempUnit={tempUnit}
            pressure={pressure}
            pressureUnit={pressureUnit}
            chemicals={chemicals.split(',').map(c => c.trim())}
            hazards={hazards}
            safeguards={safeguards}
            flowRate={flowRate ? `${flowRate} ${flowRateUnit}` : null}
            operationPhase={operationPhase}
            equipmentVolume={equipmentVolume ? `${equipmentVolume} ${volumeUnit}` : null}
            phase={phase}
            location={location ? (locationProximity ? `${location} - ${locationProximity}` : location) : null}
            utilities={[]}
          />
        </div>
      )}
    </>
  );
}

function AboutTab() {
  return (
    <div className="info-card">
      <h2>About</h2>
      <p>This application helps process engineers quickly identify hazards and recommended safeguards for various unit operations using advanced AI. It is designed to support safer, more efficient process design and operation.</p>
    </div>
  );
}

function HowItWorksTab() {
  return (
    <div className="info-card">
      <h2>How it Works</h2>
      <ol>
        <li>Enter your process data (unit, temperature, pressure, chemicals).</li>
        <li>The AI analyzes your input using best practices in process safety.</li>
        <li>You receive a clear, human-readable report with hazards and safeguards.</li>
      </ol>
    </div>
  );
}

function ContactTab() {
  return (
    <div className="info-card">
      <h2>Contact</h2>
      <p>For support, feedback, or partnership inquiries, please email <a href="mailto:support@processsafetyai.com">support@processsafetyai.com</a>.</p>
    </div>
  );
}

function ChatInterface({ isOpen, onClose, currentAnalysis, processData }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = { type: 'user', content: message, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: message,
          currentAnalysis: currentAnalysis
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        const assistantMessage = { 
          type: 'assistant', 
          content: data.response, 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = { 
          type: 'error', 
          content: 'Sorry, I encountered an error. Please try again.', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { 
        type: 'error', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const clearChat = () => {
    setMessages([]);
    fetch(API_ENDPOINTS.CHAT_SESSION(sessionId), { method: 'DELETE' });
  };

  const suggestedQuestions = [
    "Why is this high-risk?",
    "What assumptions are you using?",
    "What would change if pressure went to 25 bar?",
    "What if cooling water failed?",
    "What are the most critical safeguards?",
    "How would this change during startup?"
  ];

  return (
    <div className={`chat-interface ${isOpen ? 'open' : ''}`}>
      <div className="chat-header">
        <h3>Safety Analysis Chat</h3>
        <button onClick={onClose} className="chat-close-btn">
          <FaTimes />
        </button>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Ask me about your hazard analysis! I can help with:</p>
            <ul>
              <li>Explaining risk factors and assumptions</li>
              <li>What-if scenario analysis</li>
              <li>Practical safeguard recommendations</li>
              <li>Operator action guidance</li>
            </ul>
            <div className="suggested-questions">
              <p>Try asking:</p>
              {suggestedQuestions.map((question, index) => (
                <button 
                  key={index} 
                  onClick={() => sendMessage(question)}
                  className="suggested-question-btn"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.type}`}>
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about your hazard analysis..."
            disabled={isLoading}
            className="chat-input"
          />
          <button type="submit" disabled={isLoading || !inputMessage.trim()} className="chat-send-btn">
            Send
          </button>
        </form>
        {messages.length > 0 && (
          <button onClick={clearChat} className="chat-clear-btn">
            Clear Chat
          </button>
        )}
      </div>
    </div>
  );
}

function MyReports({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setReports([]);
      return;
    }
    
    const fetchReports = async () => {
      try {
      setLoading(true);
        setError(null);
        console.log('Fetching reports for user:', user.uid);
        
        const q = query(
          collection(db, 'reports'), 
          where('uid', '==', user.uid), 
          orderBy('created', 'desc')
        );
        
      const snap = await getDocs(q);
        console.log('Found reports:', snap.docs.length);
        
        const reportsData = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        setReports(reportsData);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setError('Failed to load reports. Please try again.');
      } finally {
      setLoading(false);
      }
    };
    
    fetchReports();
  }, [user]);

  const handleRefresh = () => {
    if (user) {
      setLoading(true);
      setError(null);
      const fetchReports = async () => {
        try {
          console.log('Refreshing reports for user:', user.uid);
          
          const q = query(
            collection(db, 'reports'), 
            where('uid', '==', user.uid), 
            orderBy('created', 'desc')
          );
          
          const snap = await getDocs(q);
          console.log('Found reports after refresh:', snap.docs.length);
          
          const reportsData = snap.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }));
          
          setReports(reportsData);
        } catch (err) {
          console.error('Error refreshing reports:', err);
          setError('Failed to refresh reports. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchReports();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2>My Reports</h2>
        {user && (
          <button 
            onClick={handleRefresh}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0d6efd',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Refresh
          </button>
        )}
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7DD3FC' }}>
          <Spinner />
          <div style={{ marginTop: '10px' }}>Loading your reports...</div>
        </div>
      ) : error ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          {error}
          <br />
          <button 
            onClick={handleRefresh}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#7DD3FC',
          backgroundColor: 'rgba(125, 211, 252, 0.1)',
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>No reports yet</div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            Run your first hazard analysis to see your reports here!
          </div>
        </div>
      ) : (
        <div className="my-reports-container">
            {reports.map(r => (
            <div key={r.id} className="my-reports-item">
              <div className="my-reports-header">
                <div className="my-reports-title">
                  <strong>{r.unit}</strong>
                  <span className="my-reports-conditions">
                    | {r.temp} {r.tempUnit}, {r.pressure} {r.pressureUnit}
                  </span>
                </div>
                <div className="my-reports-date">
                  {new Date(r.created).toLocaleString()}
                </div>
              </div>
              <div className="my-reports-chem">
                <strong>Chemicals:</strong> {Array.isArray(r.chemicals) ? r.chemicals.join(', ') : r.chemicals}
              </div>
              {r.flowRate && (
                <div className="my-reports-detail">
                  <strong>Flow Rate:</strong> {r.flowRate}
                </div>
              )}
              {r.operationPhase && (
                <div className="my-reports-detail">
                  <strong>Operation Phase:</strong> {r.operationPhase}
                </div>
              )}
              <div className="my-reports-content">
                <div dangerouslySetInnerHTML={{ __html: r.report.replace(/\n/g, '<br/>') }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function exportReportPDF({ unit, temp, tempUnit, pressure, pressureUnit, chemicals, hazards, safeguards }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  let y = margin + 30;
  const lineHeight = 16;
  const headingLineHeight = 20;
  const footerHeight = 40;

  function checkPageBreak(extra = 0) {
    if (y + extra + footerHeight > pageHeight) {
      addFooter();
      doc.addPage();
      y = margin;
    }
  }

  function addFooter() {
    doc.setDrawColor(200);
    doc.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('Generated by Process Safety AI | Confidential', margin, pageHeight - footerHeight + 20);
    doc.setTextColor(0);
  }

  function isSubheadingPDF(line) {
    const trimmed = line.trim();
    const base = trimmed.replace(/[:.]+$/, '');
    return (
      base.length > 0 &&
      /^[A-Z][A-Za-z0-9\s]+$/.test(base) &&
      base.length < 50 &&
      !/[.!?]$/.test(base)
    );
  }

  function cleanHazardsOrSafeguardsPDF(arr) {
    return arr.filter(
      l => l &&
        !/^and recommended safeguards/i.test(l) &&
        !/^hazards?$/i.test(l) &&
        !/^safeguards?$/i.test(l)
    );
  }

  // Logo
  const logoUrl = `${window.location.origin}/logo192.png`;
  doc.addImage(logoUrl, 'PNG', margin, margin, 40, 40);

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Process Safety Assessment Report', margin + 50, margin + 30, { maxWidth: usableWidth - 50 });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  y += 40;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Process Overview
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Process Overview', margin, y);
  y += headingLineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const overviewLines = [
    `Unit: ${unit}`,
    `Operating Conditions: ${temp} ${tempUnit}, ${pressure} ${pressureUnit}`,
    chemicals.filter(Boolean).length > 0 ? `Chemicals: ${chemicals.filter(Boolean).join(', ')}` : null
  ].filter(Boolean);
  overviewLines.forEach(line => {
    const lines = doc.splitTextToSize(line, usableWidth);
    lines.forEach(l => {
      checkPageBreak(lineHeight);
      doc.text(l, margin, y);
      y += lineHeight;
    });
  });
  y += 4;

  // Hazards Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  checkPageBreak(headingLineHeight);
  doc.text('Identified Hazards', margin, y);
  y += headingLineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const cleanedHazards = cleanHazardsOrSafeguardsPDF(hazards);
  let i = 0;
  while (i < cleanedHazards.length) {
    if (isSubheadingPDF(cleanedHazards[i])) {
      // Subheading
      const heading = cleanedHazards[i].replace(/[:.]+$/, '') + ':';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      checkPageBreak(headingLineHeight);
      doc.text(heading, margin + 8, y);
      y += headingLineHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      i++;
      // Bullets under this subheading
      let bullets = [];
      while (i < cleanedHazards.length && !isSubheadingPDF(cleanedHazards[i])) {
        if (cleanedHazards[i].trim().length > 0) {
          bullets.push(cleanedHazards[i]);
        }
        i++;
      }
      bullets.forEach(bullet => {
        const text = '\u2022 ' + bullet.charAt(0).toUpperCase() + bullet.slice(1);
        const lines = doc.splitTextToSize(text, usableWidth - 18);
        lines.forEach(l => {
          checkPageBreak(lineHeight);
          doc.text(l, margin + 18, y);
          y += lineHeight;
        });
      });
    } else {
      // Just a bullet
      if (cleanedHazards[i].trim().length > 0) {
        const text = '\u2022 ' + cleanedHazards[i].charAt(0).toUpperCase() + cleanedHazards[i].slice(1);
        const lines = doc.splitTextToSize(text, usableWidth - 18);
        lines.forEach(l => {
          checkPageBreak(lineHeight);
          doc.text(l, margin + 18, y);
          y += lineHeight;
        });
      }
      i++;
    }
  }
  y += 8;

  // Safeguards Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  checkPageBreak(headingLineHeight);
  doc.text('Recommended Safeguards', margin, y);
  y += headingLineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const cleanedSafeguards = cleanHazardsOrSafeguardsPDF(safeguards);
  i = 0;
  while (i < cleanedSafeguards.length) {
    if (isSubheadingPDF(cleanedSafeguards[i])) {
      // Subheading
      const heading = cleanedSafeguards[i].replace(/[:.]+$/, '') + ':';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      checkPageBreak(headingLineHeight);
      doc.text(heading, margin + 8, y);
      y += headingLineHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      i++;
      // Bullets under this subheading
      let bullets = [];
      while (i < cleanedSafeguards.length && !isSubheadingPDF(cleanedSafeguards[i])) {
        if (cleanedSafeguards[i].trim().length > 0) {
          bullets.push(cleanedSafeguards[i]);
        }
        i++;
      }
      bullets.forEach(bullet => {
        const text = '\u2022 ' + bullet.charAt(0).toUpperCase() + bullet.slice(1);
        const lines = doc.splitTextToSize(text, usableWidth - 18);
        lines.forEach(l => {
          checkPageBreak(lineHeight);
          doc.text(l, margin + 18, y);
          y += lineHeight;
        });
      });
    } else {
      // Just a bullet
      if (cleanedSafeguards[i].trim().length > 0) {
        const text = '\u2022 ' + cleanedSafeguards[i].charAt(0).toUpperCase() + cleanedSafeguards[i].slice(1);
        const lines = doc.splitTextToSize(text, usableWidth - 18);
        lines.forEach(l => {
          checkPageBreak(lineHeight);
          doc.text(l, margin + 18, y);
          y += lineHeight;
        });
      }
      i++;
    }
  }
  y += 8;

  // Always add footer to last page
  addFooter();

  doc.save('Process_Safety_Report.pdf');
}

function App() {
  const [tab, setTab] = useState('analyze');
  const [unit, setUnit] = useState('');
  const [temp, setTemp] = useState('');
  const [tempUnit, setTempUnit] = useState('K');
  const [pressure, setPressure] = useState('');
  const [pressureUnit, setPressureUnit] = useState('atm');
  const [chemicals, setChemicals] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleSubmit = async (e, tempUnit, pressureUnit, flowRate, flowRateUnit, operationPhase, equipmentVolume, volumeUnit, phase, location, locationProximity, utilities) => {
    e.preventDefault();
    
    console.log('Form submitted, setting loading to true');
    
    // Reset states
    setLoading(true);
    setError('');
    setReport('');
    
    // Add a timeout to prevent stuck loading state
    const timeoutId = setTimeout(() => {
      console.log('Timeout reached, setting loading to false');
      setLoading(false);
    }, 30000); // 30 second timeout
    
    try {
      // Build location string
      let locationString = '';
      if (location) {
        locationString = location;
        if (locationProximity) {
          locationString += ` - ${locationProximity}`;
        }
      }
      
      // Build flow rate string
      let flowRateString = '';
      if (flowRate) {
        flowRateString = `${flowRate} ${flowRateUnit}`;
      }
      
      // Build equipment volume string
      let equipmentVolumeString = '';
      if (equipmentVolume) {
        equipmentVolumeString = `${equipmentVolume} ${volumeUnit}`;
      }
      
      console.log('Making API request...');
      
      const response = await fetch(API_ENDPOINTS.HAZARD_ANALYSIS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit,
          temp,
          tempUnit,
          pressure,
          pressureUnit,
          chemicals: chemicals.split(',').map(c => c.trim()),
          flowRate: flowRateString || null,
          operationPhase: operationPhase || null,
          equipmentVolume: equipmentVolumeString || null,
          phase: phase || null,
          location: locationString || null,
          utilities: utilities
        })
      });
      
      console.log('Response received:', response.status);
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Request successful, setting report');
        setReport(data.report);
        if (user) {
          try {
            const reportData = {
            uid: user.uid,
            unit,
            temp,
            tempUnit,
            pressure,
            pressureUnit,
            chemicals,
              flowRate: flowRateString,
              operationPhase,
              equipmentVolume: equipmentVolumeString,
              phase,
              location: locationString,
              utilities,
            report: data.report,
            created: Date.now()
            };
            
            console.log('Saving report to database:', {
              uid: user.uid,
              unit,
              temp,
              pressure,
              chemicals: chemicals.length
            });
            
            const docRef = await addDoc(collection(db, 'reports'), reportData);
            console.log('Report saved to database with ID:', docRef.id);
          } catch (dbError) {
            console.error('Database save error:', dbError);
            // Don't fail the whole request if DB save fails
        }
      } else {
          console.log('User not logged in, skipping database save');
        }
      } else {
        console.log('Request failed:', data.error);
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Request error:', err);
      setError('Failed to connect to backend. Please try again.');
    } finally {
      console.log('Finally block reached, setting loading to false');
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);
  
  const resetLoadingState = () => {
    console.log('Manually resetting loading state');
    setLoading(false);
    setError('');
  };

  // Add My Reports tab only if user is logged in
  const navTabs = [
    { key: 'analyze', label: 'Hazard Analysis', icon: <FaFlask /> },
    ...(user ? [{ key: 'myreports', label: 'My Reports', icon: <FaFlask /> }] : []),
    { key: 'about', label: 'About', icon: <FaInfoCircle /> },
    { key: 'contact', label: 'Contact', icon: <FaEnvelope /> },
  ];

  return (
    <div className="dashboard-root">
      <Sidebar currentTab={tab} setTab={setTab} navTabs={navTabs} />
      <div className="dashboard-main">
        <TopBar 
          user={user} 
          onLogout={handleLogout} 
          onShowAuth={() => setShowAuth(true)} 
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
        />
        <ChatInterface 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentAnalysis={report}
          processData={{
            unit,
            temp,
            tempUnit,
            pressure,
            pressureUnit,
            chemicals
          }}
        />
        <main className="dashboard-content">
          <div className="dashboard-grid" style={{ maxWidth: tab === 'analyze' ? 'none' : undefined, margin: tab === 'analyze' ? '0' : undefined, gridTemplateColumns: '1fr' }}>
            {showAuth && (
              <AuthModal show={true} onClose={() => setShowAuth(false)} onAuth={() => setShowAuth(false)} />
            )}
            {tab === 'analyze' && (
              <>
              <div className="dashboard-card dashboard-card-form">
                <HazardAnalysisTab
                  onSubmit={handleSubmit}
                  loading={loading}
                  error={error}
                  report={report}
                  unit={unit}
                  setUnit={setUnit}
                  temp={temp}
                  setTemp={setTemp}
                    tempUnit={tempUnit}
                    setTempUnit={setTempUnit}
                  pressure={pressure}
                  setPressure={setPressure}
                    pressureUnit={pressureUnit}
                    setPressureUnit={setPressureUnit}
                  chemicals={chemicals}
                  setChemicals={setChemicals}
                    resetLoadingState={resetLoadingState}
                />
                </div>
                {report && (
                  <div className="dashboard-card dashboard-card-report" style={{ marginTop: 32 }}>
                    <HumanReport
                      unit={unit}
                      temp={temp}
                      tempUnit={tempUnit}
                      pressure={pressure}
                      pressureUnit={pressureUnit}
                      chemicals={chemicals.split(',').map(c => c.trim())}
                      hazards={parseReport(report).hazards}
                      safeguards={parseReport(report).safeguards}
                    />
                  </div>
                )}
              </>
            )}
            {tab === 'myreports' && user && (
              <div className="dashboard-card"><MyReports user={user} /></div>
            )}
            {tab === 'about' && <div className="dashboard-card"><AboutTab /></div>}
            {tab === 'contact' && <div className="dashboard-card"><ContactTab /></div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
