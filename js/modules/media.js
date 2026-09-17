/**
 * EVENTORA 3.0 — Media Gallery Module
 */
window.MediaModule = (() => {
  // Sample media items for demo
  const SAMPLE_MEDIA = [
    {id:'m1',name:'Venue Walkthrough',type:'photo',url:'outdoor',date:'Oct 10, 2026',tag:'Venue'},
    {id:'m2',name:'Decor Inspiration',type:'photo',url:'decor',date:'Oct 11, 2026',tag:'Decor'},
    {id:'m3',name:'Invitation Card Design',type:'photo',url:'wedding',date:'Oct 12, 2026',tag:'Invitations'},
    {id:'m4',name:'Catering Tasting',type:'photo',url:'catering',date:'Oct 13, 2026',tag:'Catering'},
    {id:'m5',name:'Stage Setup',type:'photo',url:'lighting',date:'Oct 14, 2026',tag:'Venue'},
    {id:'m6',name:'Photographer Portfolio',type:'photo',url:'photography',date:'Oct 15, 2026',tag:'Vendors'},
    {id:'m7',name:'Candid Moments',type:'photo',url:'party',date:'Oct 16, 2026',tag:'Event'},
    {id:'m8',name:'Guest Arrivals',type:'photo',url:'corporate',date:'Oct 17, 2026',tag:'Event'},
    {id:'m9',name:'DJ Setup',type:'photo',url:'dj',date:'Oct 18, 2026',tag:'Entertainment'},
    {id:'m10',name:'Floral Arrangements',type:'photo',url:'wedding2',date:'Oct 19, 2026',tag:'Decor'},
    {id:'m11',name:'Venue Exterior',type:'photo',url:'hotel',date:'Oct 20, 2026',tag:'Venue'},
    {id:'m12',name:'Food Display',type:'photo',url:'food1',date:'Oct 21, 2026',tag:'Catering'},
  ];

  let activeFilter = 'All';
  const TAGS = ['All','Venue','Decor','Catering','Vendors','Event','Entertainment','Invitations','Other'];

  const render = (evId) => {
    const c = document.getElementById('tab-media');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);

    const filtered = activeFilter === 'All' ? SAMPLE_MEDIA : SAMPLE_MEDIA.filter(m=>m.tag===activeFilter);

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">📷 Media Gallery</div>
          <div class="mod-subtitle">${SAMPLE_MEDIA.length} files · Photos, videos, documents</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="MediaModule.downloadAll('${evId}')">⬇️ Download All</button>
          <button class="btn btn-primary btn-sm" onclick="MediaModule.openUpload('${evId}')">+ Upload Files</button>
        </div>
      </div>

      <!-- Upload Drop Zone -->
      <div class="upload-drop-zone" style="margin-bottom:20px" onclick="MediaModule.openUpload('${evId}')">
        <div style="font-size:40px;margin-bottom:10px">📁</div>
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Drag & drop files here or click to upload</div>
        <div style="font-size:13px;color:var(--text-muted)">Photos (JPG, PNG, WEBP), Videos (MP4), Documents (PDF, DOCX) — Max 50MB each</div>
      </div>

      <!-- Storage Usage -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">Storage Used</span>
          <span style="font-size:13px;font-weight:700">2.4 GB of 10 GB</span>
        </div>
        <div class="prog-track" style="height:8px">
          <div class="prog-fill gradient" style="width:24%"></div>
        </div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;color:var(--text-muted)">
          <span>📸 18 Photos (1.8GB)</span>
          <span>🎥 2 Videos (0.5GB)</span>
          <span>📄 6 Docs (0.1GB)</span>
        </div>
      </div>

      <!-- Filter tags -->
      <div class="filter-bar" style="margin-bottom:16px">
        ${TAGS.map(tag=>`<div class="filter-chip ${activeFilter===tag?'active':''}" onclick="MediaModule.setFilter('${tag}','${evId}')">${tag}</div>`).join('')}
      </div>

      <!-- Media Grid -->
      <div class="media-grid">
        ${filtered.map(m=>`
          <div class="media-item img-hover-zoom" onclick="MediaModule.viewMedia('${m.id}','${m.url}','${m.name}')">
            <img src="${IMGS[m.url]}?w=400&q=75&auto=format&fit=crop" alt="${m.name}" loading="lazy">
            <div class="media-item-overlay">
              <button class="btn" style="background:rgba(255,255,255,0.9);color:var(--text-primary);font-size:12px;padding:6px 12px;border-radius:var(--r-sm)" onclick="event.stopPropagation();MediaModule.viewMedia('${m.id}','${m.url}','${m.name}')">👁️ View</button>
              <button class="btn" style="background:rgba(255,255,255,0.9);color:var(--danger);font-size:12px;padding:6px 12px;border-radius:var(--r-sm)" onclick="event.stopPropagation();Toast.show('info','Deleted','${m.name} removed.')">🗑️</button>
            </div>
            <!-- Tag badge -->
            <div style="position:absolute;top:8px;left:8px">
              <span class="badge badge-violet" style="font-size:9px">${m.tag}</span>
            </div>
          </div>`).join('')}

        <!-- Upload placeholder -->
        <div class="media-item" style="background:var(--bg-subtle);border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:140px" onclick="MediaModule.openUpload('${evId}')">
          <div style="text-align:center;color:var(--text-subtle)">
            <div style="font-size:28px;margin-bottom:4px">+</div>
            <div style="font-size:12px;font-weight:600">Add File</div>
          </div>
        </div>
      </div>

      <!-- Shared Albums Section -->
      <div style="margin-top:28px">
        <div class="workspace-section-title" style="margin-bottom:14px">📂 Shared Albums</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
          ${[
            {name:'Pre-Event Prep',count:'6 photos',icon:'📸',color:'var(--brand-light)'},
            {name:'Day-Of Moments',count:'12 photos',icon:'🎉',color:'var(--warning-bg)'},
            {name:'Vendor Portfolio',count:'8 photos',icon:'🤝',color:'var(--success-bg)'},
            {name:'Documents & Contracts',count:'4 files',icon:'📄',color:'var(--info-bg)'},
          ].map(album=>`
            <div class="card hover-lift-sm" style="background:${album.color};border-color:transparent;padding:20px;cursor:pointer" onclick="Toast.show('info','Album','${album.name}')">
              <div style="font-size:32px;margin-bottom:10px">${album.icon}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${album.name}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${album.count}</div>
            </div>`).join('')}
        </div>
      </div>`;
  };

  const setFilter = (f, evId) => { activeFilter = f; render(evId); };

  const viewMedia = (id, urlKey, name) => {
    Modal.open(name, `
      <img src="${IMGS[urlKey]}?w=900&q=85&auto=format&fit=crop" style="width:100%;border-radius:var(--r-md);max-height:500px;object-fit:contain" alt="${name}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
        <span style="font-size:13px;color:var(--text-muted)">📷 ${name}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="Toast.show('info','Share','Sharing link copied!')">🔗 Share</button>
          <button class="btn btn-primary btn-sm" onclick="Toast.show('info','Download','Downloading...')">⬇️ Download</button>
        </div>
      </div>`);
  };

  const openUpload = (evId) => {
    Modal.open('Upload Files',
      `<div class="upload-drop-zone" style="margin-bottom:16px;cursor:pointer">
         <div style="font-size:40px;margin-bottom:10px">📤</div>
         <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Click to choose files</div>
         <div style="font-size:13px;color:var(--text-muted)">Photos, videos, or documents</div>
         <input type="file" multiple accept="image/*,video/*,.pdf,.docx" style="display:none" onchange="Toast.show('success','Uploading!',this.files.length+' file(s) selected')">
       </div>
       <div class="form-group"><label class="form-label">Tag / Album</label>
         <select class="input" id="uploadTag">
           ${['Venue','Decor','Catering','Vendors','Event','Entertainment','Documents'].map(t=>`<option>${t}</option>`).join('')}
         </select>
       </div>`,
      () => Toast.show('success','Upload Complete', 'Files added to your media gallery.'), 'Upload');
  };

  const downloadAll = (evId) => Toast.show('info','Download All','Preparing zip file for download...');

  return { render, setFilter, viewMedia, openUpload, downloadAll };
})();
