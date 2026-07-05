'use client';

import { useState, useEffect, useMemo } from 'react';
import { getConductors } from './actions';

export default function PoleLoadCalculator() {
  const [conductorsData, setConductorsData] = useState([]);
  
  // Global Inputs
  const [windPressure, setWindPressure] = useState(500); // Pa (N/m^2)
  const [windAngle, setWindAngle] = useState(90); // Degrees (0 = North, 90 = East, 180 = South, 270 = West)
  const [poleTopWidth, setPoleTopWidth] = useState(0.2); // m
  const [poleBottomWidth, setPoleBottomWidth] = useState(0.4); // m
  const [poleDragCoefficient, setPoleDragCoefficient] = useState(1.0);
  const [poleHeight, setPoleHeight] = useState(10.0); // m

  // Levels State
  const [levels, setLevels] = useState([
    {
      id: 1,
      height: 10,
      sides: {
        North: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 0 },
        East: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 90 },
        South: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 180 },
        West: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 270 },
      }
    }
  ]);

  useEffect(() => {
    async function loadData() {
      const data = await getConductors();
      setConductorsData(data);
    }
    loadData();
  }, []);

  const addLevel = () => {
    setLevels([...levels, {
      id: Date.now(),
      height: 0,
      sides: {
        North: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 0 },
        East: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 90 },
        South: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 180 },
        West: { conductorId: '', span: 50, sag: 1, count: 0, lineAngle: 270 },
      }
    }]);
  };

  const removeLevel = (id) => {
    setLevels(levels.filter(l => l.id !== id));
  };

  const updateLevel = (id, field, value) => {
    setLevels(levels.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const updateSide = (levelId, side, field, value) => {
    setLevels(levels.map(l => {
      if (l.id === levelId) {
        return {
          ...l,
          sides: {
            ...l.sides,
            [side]: { ...l.sides[side], [field]: value }
          }
        };
      }
      return l;
    }));
  };

  // Calculations
  const results = useMemo(() => {
    let totalFx = 0;
    let totalFy = 0;
    let totalMx = 0;
    let totalMy = 0;

    const rad = (deg) => deg * (Math.PI / 180);

    levels.forEach(level => {
      let levelFx = 0;
      let levelFy = 0;

      const directions = {
        North: { angle: 0 },
        East: { angle: 90 },
        South: { angle: 180 },
        West: { angle: 270 }
      };

      Object.entries(level.sides).forEach(([dirName, sideData]) => {
        if (sideData.count > 0 && sideData.conductorId) {
          const conductor = conductorsData.find(c => c.id.toString() === sideData.conductorId.toString());
          if (conductor) {
            // Use custom line angle if defined, otherwise fallback to default direction angle
            const dirAngle = sideData.lineAngle !== undefined ? sideData.lineAngle : directions[dirName].angle;
            
            // Wind angle of attack relative to conductor direction
            const attackAngle = windAngle - dirAngle;
            
            // Wind force per meter on conductor (W_w) = P * d * sin^2(attack_angle)
            // Or simpler standard: P * d
            // Using simplified: W_w = P * (d/1000) * |sin(attack_angle)|
            const w_w = windPressure * (conductor.diameter_mm / 1000) * Math.abs(Math.sin(rad(attackAngle)));
            
            // Conductor weight per meter (W_c) in Newtons
            const w_c = conductor.weight_kg_m * 9.81;
            
            // Resultant weight per meter (W_r)
            const w_r = Math.sqrt(Math.pow(w_c, 2) + Math.pow(w_w, 2));
            
            // Tension (T)
            const tension = (w_r * Math.pow(sideData.span, 2)) / (8 * sideData.sag);
            
            // Transverse Wind Force to Pole (half of the span wind force)
            const f_tw = (w_w * sideData.span) / 2;

            // Decompose Tension into X and Y (X is East, Y is North)
            const t_x = tension * Math.sin(rad(dirAngle));
            const t_y = tension * Math.cos(rad(dirAngle));

            // Transverse wind force direction is perpendicular to conductor, influenced by wind direction
            // Wind force pushes in the direction of the wind
            const tw_x = f_tw * Math.sin(rad(windAngle));
            const tw_y = f_tw * Math.cos(rad(windAngle));

            // Add to level forces, multiplied by number of conductors
            levelFx += (t_x + tw_x) * sideData.count;
            levelFy += (t_y + tw_y) * sideData.count;
          }
        }
      });

      totalFx += levelFx;
      totalFy += levelFy;
      totalMx += levelFx * level.height;
      totalMy += levelFy * level.height;
    });

    // Wind on Pole Calculation
    // Pole profile is a trapezoid. Area = (top + bottom) / 2 * height
    const poleArea = ((poleTopWidth + poleBottomWidth) / 2) * poleHeight;
    
    // Wind force = pressure * area * drag coefficient
    const windForceOnPole = windPressure * poleArea * poleDragCoefficient;
    
    // The force acts at the centroid of the trapezoid
    // y_c = (h / 3) * (2*a + b) / (a + b) where a = top width, b = bottom width
    const poleCentroidHeight = (poleHeight / 3) * ((2 * poleTopWidth + poleBottomWidth) / (poleTopWidth + poleBottomWidth));
    
    // Decompose wind force into X and Y based on wind angle
    const poleWindFx = windForceOnPole * Math.sin(rad(windAngle));
    const poleWindFy = windForceOnPole * Math.cos(rad(windAngle));
    
    totalFx += poleWindFx;
    totalFy += poleWindFy;
    totalMx += poleWindFx * poleCentroidHeight;
    totalMy += poleWindFy * poleCentroidHeight;

    // Total Force magnitude
    const totalForce = Math.sqrt(Math.pow(totalFx, 2) + Math.pow(totalFy, 2));
    const totalMoment = Math.sqrt(Math.pow(totalMx, 2) + Math.pow(totalMy, 2));

    return {
      Fx: totalFx.toFixed(2),
      Fy: totalFy.toFixed(2),
      Mx: totalMx.toFixed(2),
      My: totalMy.toFixed(2),
      TotalForce: totalForce.toFixed(2),
      TotalMoment: totalMoment.toFixed(2)
    };
  }, [levels, windPressure, windAngle, conductorsData, poleTopWidth, poleBottomWidth, poleDragCoefficient, poleHeight]);

  return (
    <div className="app-container">
      <header>
        <h1>Pole Load Calculator</h1>
        <p className="subtitle">Interactive dead-end pole force and bending moment analysis</p>
      </header>

      <div className="glass-panel">
        <h2 className="section-title">Global Environmental Inputs</h2>
        <div className="grid-layout">
          <div className="form-group">
            <label>Wind Pressure (Pa)</label>
            <input 
              type="number" 
              value={windPressure} 
              onChange={(e) => setWindPressure(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Wind Angle (Degrees) [0=N, 90=E, 180=S, 270=W]</label>
            <input 
              type="number" 
              value={windAngle} 
              onChange={(e) => setWindAngle(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <h2 className="section-title">Pole Properties</h2>
        <div className="grid-layout">
          <div className="form-group">
            <label>Pole Height (m)</label>
            <input 
              type="number" 
              step="0.1"
              value={poleHeight} 
              onChange={(e) => setPoleHeight(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Top Width (m)</label>
            <input 
              type="number" 
              step="0.01"
              value={poleTopWidth} 
              onChange={(e) => setPoleTopWidth(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Bottom Width (m)</label>
            <input 
              type="number" 
              step="0.01"
              value={poleBottomWidth} 
              onChange={(e) => setPoleBottomWidth(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Drag Coefficient</label>
            <input 
              type="number" 
              step="0.1"
              value={poleDragCoefficient} 
              onChange={(e) => setPoleDragCoefficient(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel results-panel" style={{ border: '1px solid var(--accent-color)' }}>
        <h2 className="section-title">Total Base Reactions</h2>
        <div className="results-grid">
          <div className="result-item">
            <div className="result-label">Resultant Force (N)</div>
            <div className="result-value" style={{ color: 'var(--accent-color)' }}>{results.TotalForce}</div>
          </div>
          <div className="result-item">
            <div className="result-label">Resultant Moment (N.m)</div>
            <div className="result-value" style={{ color: 'var(--accent-color)' }}>{results.TotalMoment}</div>
          </div>
          <div className="result-item">
            <div className="result-label">Force X [East] (N)</div>
            <div className="result-value">{results.Fx}</div>
          </div>
          <div className="result-item">
            <div className="result-label">Force Y [North] (N)</div>
            <div className="result-value">{results.Fy}</div>
          </div>
          <div className="result-item">
            <div className="result-label">Moment X (N.m)</div>
            <div className="result-value">{results.Mx}</div>
          </div>
          <div className="result-item">
            <div className="result-label">Moment Y (N.m)</div>
            <div className="result-value">{results.My}</div>
          </div>
        </div>
      </div>

      <div className="levels-container">
        {levels.map((level, index) => (
          <div key={level.id} className="glass-panel level-card">
            <button className="remove-level-btn" onClick={() => removeLevel(level.id)} title="Remove Level">
              ✕
            </button>
            <h2 className="section-title">Level {index + 1}</h2>
            
            <div className="form-group" style={{ maxWidth: '250px', marginBottom: '1.5rem' }}>
              <label>Attachment Height (m)</label>
              <input 
                type="number" 
                value={level.height}
                onChange={(e) => updateLevel(level.id, 'height', Number(e.target.value))}
              />
            </div>

            <div className="direction-grid">
              {['North', 'East', 'South', 'West'].map(dir => (
                <div key={dir} className="direction-box">
                  <h3 className="direction-title">{dir} Dead-End</h3>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Conductor Type</label>
                    <select 
                      value={level.sides[dir].conductorId}
                      onChange={(e) => updateSide(level.id, dir, 'conductorId', e.target.value)}
                    >
                      <option value="">Select Conductor...</option>
                      {conductorsData.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Number of Conductors</label>
                    <input 
                      type="number" 
                      min="0"
                      value={level.sides[dir].count}
                      onChange={(e) => updateSide(level.id, dir, 'count', Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Line Angle (deg)</label>
                    <input 
                      type="number" 
                      value={level.sides[dir].lineAngle}
                      onChange={(e) => updateSide(level.id, dir, 'lineAngle', Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Span (m)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={level.sides[dir].span}
                      onChange={(e) => updateSide(level.id, dir, 'span', Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Sag (m)</label>
                    <input 
                      type="number" 
                      min="0.1" step="0.1"
                      value={level.sides[dir].sag}
                      onChange={(e) => updateSide(level.id, dir, 'sag', Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="add-level-container">
        <button onClick={addLevel}>
          <span style={{ fontSize: '1.2rem' }}>+</span> Add New Conductor Level
        </button>
      </div>
    </div>
  );
}
