/**
 * EVENTORA 3.0 — Venue & Floor Plan Module
 * Drag-and-drop floor plan designer with properties panel
 */
window.VenueModule = (() => {
  let elements = {}; let selectedId = null; let dragging = null; let offset = {x:0,y:0};
  const PALETTE = [
    {type:'table-round',  icon:'⭕', label:'Round Table'},
    {type:'table-rect',   icon:'⬛', label:'Rect Table'},
    {type:'chair',        icon:'🪑', label:'Chair'},
    {type:'stage',        icon:'🎤', label:'Stage'},
    {type:'dance',        icon:'💃', label:'Dance Floor'},
    {type:'bar',          icon:'🍹', label:'Bar Counter'},
    {type:'booth',        icon:'📷', label:'Photo Booth'},
    {type:'entrance',     icon:'🚪', label:'Entrance/Exit'},
    {type:'buffet',       icon:'🍽️', label:'Buffet Station'},
    {type:'restroom',     icon:'🚻', label:'Restroom'},
    {type:'plant',        icon:'🌿', label:'Plant'},
    {type:'speaker',      icon:'🔊', label:'Speaker'},
    {type:'projector',    icon:'📽️', label:'Projector'},
    {type:'sofa',         icon:'🛋️', label:'Lounge Sofa'},
    {type:'reception',    icon:'💼', label:'Reception Desk'},
  ];

  const render = (evId) => {
    const c = document.getElementById('tab-venue');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);
    elements = { ...EventoraDB.getFloorElements(evId) };

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">🏠 Venue & Floor Plan</div>
          <div class="mod-subtitle">${ev?.venueName || 'Your Venue'} · Drag items to design your layout</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="VenueModule.clearCanvas('${evId}')">🗑️ Clear</button>
          <button class="btn btn-primary btn-sm" onclick="VenueModule.saveLayout('${evId}')">💾 Save Layout</button>
        </div>
      </div>

      <!-- Venue Info Card -->
      ${ev?.venueName ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        ${[
          {icon:'📍', label:'Venue', val:ev.venueName},
          {icon:'🌆', label:'City', val:ev.venueCity||'—'},
          {icon:'👥', label:'Capacity', val:ev.venueCapacity ? ev.venueCapacity+' people' : '—'},
          {icon:'🏠', label:'Type', val:(ev.venueType||'').charAt(0).toUpperCase()+(ev.venueType||'').slice(1)},
        ].map(item => `
          <div class="card-sm card" style="padding:14px">
            <div style="font-size:20px;margin-bottom:6px">${item.icon}</div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-subtle);margin-bottom:2px">${item.label}</div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${item.val}</div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Tips -->
      <div style="background:var(--brand-light);border:1px solid var(--brand-mid);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--brand)">
        💡 <strong>How to use:</strong> Drag items from the palette onto the canvas. Click any item to select it (shows resize handles). Use the properties panel to rename items.
      </div>

      <!-- Floor Plan Designer -->
      <div class="floor-plan-wrapper" style="height:620px">
        <!-- Palette -->
        <div class="fp-palette">
          <div class="fp-palette-header">Elements</div>
          <div class="fp-palette-items">
            ${PALETTE.map(p => `
              <div class="fp-palette-item"
                draggable="true"
                data-type="${p.type}"
                ondragstart="VenueModule.paletteDragStart(event,'${p.type}','${p.label}')">
                <span class="fp-palette-item-icon">${p.icon}</span>${p.label}
              </div>`).join('')}
          </div>
        </div>

        <!-- Canvas column -->
        <div style="flex:1;display:flex;flex-direction:column">
          <!-- Toolbar -->
          <div class="fp-toolbar">
            <button class="btn btn-secondary btn-xs" onclick="VenueModule.deleteSelected('${evId}')" id="fpDeleteBtn" style="display:none">🗑️ Delete Selected</button>
            <button class="btn btn-secondary btn-xs" onclick="VenueModule.duplicateSelected('${evId}')" id="fpDupBtn" style="display:none">📋 Duplicate</button>
            <div style="margin-left:auto;font-size:12px;color:var(--text-muted)">${Object.keys(elements).length} elements on canvas</div>
          </div>

          <!-- Canvas -->
          <div class="fp-canvas" id="fpCanvas"
            ondragover="event.preventDefault()"
            ondrop="VenueModule.canvasDrop(event,'${evId}')"
            onclick="VenueModule.canvasClick(event,'${evId}')">
            <!-- Grid label -->
            <div style="position:absolute;top:10px;right:10px;font-size:11px;color:var(--text-subtle);user-select:none;pointer-events:none">
              ${ev?.venueName||'Floor Plan Canvas'} — ${Object.keys(elements).length} elements
            </div>
            <!-- Render elements -->
            ${Object.values(elements).map(el => renderElement(el)).join('')}
          </div>
        </div>

        <!-- Properties Panel -->
        <div class="fp-prop-panel" id="fpPropPanel">
          <div class="fp-prop-panel-title">Properties</div>
          <div id="fpPropContent" style="font-size:13px;color:var(--text-muted)">Select an element to edit its properties.</div>
        </div>
      </div>`;

    // Init drag events on existing canvas elements
    setTimeout(() => initCanvasEvents(evId), 100);
  };

  const renderElement = (el) => `
    <div class="fp-element ${el.id === selectedId ? 'selected' : ''}"
      id="el-${el.id}"
      style="left:${el.x||50}px;top:${el.y||50}px;width:${el.w||80}px;height:${el.h||50}px;
             background:${el.color||'var(--bg-white)'};border-color:${el.id===selectedId?'var(--brand)':'var(--border-md)'}"
      draggable="false"
      onmousedown="VenueModule.startDrag(event,'${el.id}')">
      <span style="font-size:16px">${getIcon(el.type)}</span>
      <span style="font-size:10px;font-weight:700;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el.label||el.type}</span>
      ${el.count ? `<span style="position:absolute;top:-5px;right:-5px;background:var(--brand);color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${el.count}</span>` : ''}
    </div>`;

  const getIcon = (type) => {
    const icons = {'table-round':'⭕','table-rect':'⬛','chair':'🪑','stage':'🎤','dance':'💃','bar':'🍹','booth':'📷','entrance':'🚪','buffet':'🍽️','restroom':'🚻','plant':'🌿','speaker':'🔊','projector':'📽️','sofa':'🛋️','reception':'💼'};
    return icons[type] || '⬛';
  };

  let dragType = null, dragLabel = null;
  const paletteDragStart = (e, type, label) => { dragType = type; dragLabel = label; e.dataTransfer.effectAllowed = 'copy'; };

  const canvasDrop = (e, evId) => {
    e.preventDefault();
    const canvas = document.getElementById('fpCanvas');
    if (!canvas || !dragType) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - 40) / 24) * 24;
    const y = Math.round((e.clientY - rect.top - 20) / 24) * 24;
    const id = EventoraDB.uid();
    elements[id] = { id, type:dragType, label:dragLabel||dragType, x:Math.max(0,x), y:Math.max(0,y), w:96, h:56, color:'var(--bg-white)' };
    dragType = null; dragLabel = null;
    rerenderCanvas(evId);
  };

  const canvasClick = (e, evId) => {
    if (e.target.id === 'fpCanvas' || e.target.closest('#fpCanvas') === document.getElementById('fpCanvas') && !e.target.classList.contains('fp-element') && !e.target.closest('.fp-element')) {
      selectedId = null;
      document.getElementById('fpPropContent').innerHTML = 'Select an element to edit its properties.';
      document.getElementById('fpDeleteBtn').style.display = 'none';
      document.getElementById('fpDupBtn').style.display = 'none';
      rerenderCanvas(evId);
    }
  };

  const startDrag = (e, elId) => {
    e.stopPropagation();
    selectedId = elId;
    const el = elements[elId];
    if (!el) return;
    const dom = document.getElementById(`el-${elId}`);
    if (!dom) return;
    const canvas = document.getElementById('fpCanvas');
    const rect = canvas.getBoundingClientRect();
    offset = { x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y };
    dragging = elId;
    showPropPanel(elId);
    document.getElementById('fpDeleteBtn').style.display = 'flex';
    document.getElementById('fpDupBtn').style.display = 'flex';

    const onMove = (e2) => {
      if (!dragging) return;
      const r = canvas.getBoundingClientRect();
      const nx = Math.round((e2.clientX - r.left - offset.x) / 8) * 8;
      const ny = Math.round((e2.clientY - r.top - offset.y) / 8) * 8;
      elements[dragging].x = Math.max(0, Math.min(nx, 900));
      elements[dragging].y = Math.max(0, Math.min(ny, 480));
      const domEl = document.getElementById(`el-${dragging}`);
      if (domEl) { domEl.style.left = elements[dragging].x + 'px'; domEl.style.top = elements[dragging].y + 'px'; }
    };
    const onUp = () => { dragging = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    rerenderCanvas(String(''));
    updateSelectionStyle(elId);
  };

  const updateSelectionStyle = (elId) => {
    document.querySelectorAll('.fp-element').forEach(el => {
      el.style.borderColor = el.id === `el-${elId}` ? 'var(--brand)' : 'var(--border-md)';
      el.style.boxShadow = el.id === `el-${elId}` ? '0 0 0 3px var(--brand-light)' : '';
    });
  };

  const showPropPanel = (elId) => {
    const el = elements[elId];
    if (!el) return;
    const pp = document.getElementById('fpPropContent');
    if (!pp) return;
    pp.innerHTML = `
      <div class="form-group mb-3"><label class="form-label">Label</label><input class="input input-sm" value="${el.label||''}" oninput="VenueModule.updateProp('label',this.value,'${elId}')"></div>
      <div class="form-group mb-3"><label class="form-label">Width (px)</label><input class="input input-sm" type="number" value="${el.w||80}" min="40" max="300" oninput="VenueModule.updateProp('w',+this.value,'${elId}')"></div>
      <div class="form-group mb-3"><label class="form-label">Height (px)</label><input class="input input-sm" type="number" value="${el.h||50}" min="30" max="200" oninput="VenueModule.updateProp('h',+this.value,'${elId}')"></div>
      <div class="form-group mb-3"><label class="form-label">Count / Seats</label><input class="input input-sm" type="number" value="${el.count||''}" min="0" max="99" placeholder="e.g., 8" oninput="VenueModule.updateProp('count',+this.value,'${elId}')"></div>
      <div class="form-group"><label class="form-label">Color</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
          ${['var(--bg-white)','#EDE9FE','#DBEAFE','#D1FAE5','#FEF3C7','#FCE7F3','#FEE2E2','#F3F4F6'].map(col => `
            <div onclick="VenueModule.updateProp('color','${col}','${elId}')"
              style="width:24px;height:24px;border-radius:4px;background:${col};border:2px solid ${el.color===col?'var(--brand)':'var(--border)'};cursor:pointer"></div>`).join('')}
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-subtle);margin-top:12px">Position: ${el.x}, ${el.y}</div>`;
  };

  const updateProp = (key, val, elId) => {
    if (elements[elId]) {
      elements[elId][key] = val;
      const dom = document.getElementById(`el-${elId}`);
      if (dom) {
        if (key === 'w') dom.style.width = val + 'px';
        if (key === 'h') dom.style.height = val + 'px';
        if (key === 'color') dom.style.background = val;
        if (key === 'label') { const span = dom.querySelectorAll('span')[1]; if (span) span.textContent = val; }
        if (key === 'count') {
          let badge = dom.querySelector('.fp-count-badge');
          if (!badge) { badge = document.createElement('span'); badge.className = 'fp-count-badge'; badge.style.cssText = 'position:absolute;top:-5px;right:-5px;background:var(--brand);color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700'; dom.appendChild(badge); }
          badge.textContent = val || '';
          badge.style.display = val ? 'flex' : 'none';
        }
      }
    }
  };

  const rerenderCanvas = (evId) => {
    const canvas = document.getElementById('fpCanvas');
    if (!canvas) return;
    canvas.innerHTML = `
      <div style="position:absolute;top:10px;right:10px;font-size:11px;color:var(--text-subtle);user-select:none;pointer-events:none">${Object.keys(elements).length} elements</div>
      ${Object.values(elements).map(el => renderElement(el)).join('')}`;
    initCanvasEvents(evId);
  };

  const initCanvasEvents = (evId) => {
    document.querySelectorAll('.fp-element').forEach(dom => {
      const elId = dom.id.replace('el-','');
      dom.onmousedown = (e) => startDrag(e, elId);
    });
  };

  const deleteSelected = (evId) => {
    if (!selectedId || !elements[selectedId]) return;
    const label = elements[selectedId].label;
    delete elements[selectedId]; selectedId = null;
    document.getElementById('fpDeleteBtn').style.display = 'none';
    document.getElementById('fpDupBtn').style.display = 'none';
    document.getElementById('fpPropContent').innerHTML = 'Select an element to edit.';
    rerenderCanvas(evId); Toast.show('info','Deleted',label);
  };

  const duplicateSelected = (evId) => {
    if (!selectedId || !elements[selectedId]) return;
    const orig = elements[selectedId];
    const id = EventoraDB.uid();
    elements[id] = { ...orig, id, x: orig.x+24, y: orig.y+24 };
    selectedId = id; rerenderCanvas(evId);
  };

  const clearCanvas = (evId) => {
    Modal.open('Clear Floor Plan', '<p>This will remove all elements from the canvas. Continue?</p>',
      () => { elements = {}; selectedId = null; rerenderCanvas(evId); EventoraDB.saveFloorElements(evId, {}); Toast.show('info','Canvas Cleared',''); }, 'Clear All');
  };

  const saveLayout = (evId) => {
    EventoraDB.saveFloorElements(evId, elements);
    Toast.show('success','Layout Saved', `${Object.keys(elements).length} elements saved.`);
  };

  return { render, paletteDragStart, canvasDrop, canvasClick, startDrag, updateProp, deleteSelected, duplicateSelected, clearCanvas, saveLayout };
})();
