const { useState, useEffect, useRef } = React;

const IS_ADMIN = window.location.pathname.startsWith('/admin');

// ============ TWEAKS (faqat admin uchun) ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "density": "comfortable",
  "gridCols": "auto",
  "sidebarStyle": "labeled"
}/*EDITMODE-END*/;

// ============ API HELPER ============
async function apiFetch(url, opts = {}) {
  console.log('[apiFetch]', opts.method || 'GET', url);
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  console.log('[apiFetch] response:', res.status, res.url);
  const text = await res.text();
  console.log('[apiFetch] body preview:', text.slice(0, 120));
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Server xatosi (${res.status}): HTML qaytdi — serverni qayta ishga tushiring`); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ============ STREAM CANVAS ============
function StreamCanvas({ camera, mini = false }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      const r = cvs.getBoundingClientRect();
      w = r.width; h = r.height;
      cvs.width = w * dpr; cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

    const seed = (camera.id * 9973) % 1000;
    const scene = camera.id % 4;

    const render = () => {
      tRef.current += 1;
      const t = tRef.current;
      let g;
      if (scene === 0) { g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#1a2230'); g.addColorStop(1,'#0d141d'); }
      else if (scene === 1) { g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#23201a'); g.addColorStop(1,'#0e0c08'); }
      else if (scene === 2) { g = ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#101a18'); g.addColorStop(1,'#1c2e2a'); }
      else { g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#1d1a23'); g.addColorStop(1,'#0a0810'); }
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      const cx = w/2, vy = h*0.45;
      for (let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(cx+i*(w/2),h);ctx.lineTo(cx,vy);ctx.stroke();}
      for (let i=1;i<6;i++){const yy=vy+(h-vy)*(i*i)/30;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.stroke();}

      if (camera.status==='live'){
        const bx=(Math.sin((t+seed)*0.012)*0.35+0.5)*w, by=h*0.55+Math.cos((t+seed)*0.008)*h*0.05;
        const rg=ctx.createRadialGradient(bx,by,4,bx,by,Math.min(w,h)*0.18);
        rg.addColorStop(0,'rgba(255,235,200,0.55)'); rg.addColorStop(1,'rgba(255,235,200,0)');
        ctx.fillStyle=rg; ctx.fillRect(0,0,w,h);
      }
      if (!mini||t%2===0){
        ctx.fillStyle='rgba(255,255,255,0.04)';
        for(let i=0;i<(mini?80:320);i++) ctx.fillRect(Math.random()*w,Math.random()*h,1,1);
      }
      ctx.fillStyle='rgba(255,255,255,0.025)'; ctx.fillRect(0,(t*1.2)%h,w,1);
      rafRef.current = requestAnimationFrame(render);
    };

    if (camera.status==='live') render();
    else { ctx.fillStyle='#0a0c10'; ctx.fillRect(0,0,w,h); }

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [camera.id, camera.status, mini]);

  return (
    <div className="stream-wrap">
      <canvas ref={canvasRef} className="stream-canvas" />
      {camera.status==='stopped' && (
        <div className="stream-overlay stream-overlay--stopped">
          <div className="stream-overlay__icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/><path d="M3 3l18 18" strokeWidth="1.8"/></svg>
          </div>
          <div className="stream-overlay__title">Stream to'xtatilgan</div>
          <div className="stream-overlay__sub">Admin tomonidan boshlanmagan</div>
        </div>
      )}
      {camera.status==='error' && (
        <div className="stream-overlay stream-overlay--error">
          <div className="stream-overlay__icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/></svg>
          </div>
          <div className="stream-overlay__title">Ulanish xatosi</div>
          <div className="stream-overlay__sub">RTSP javob bermayapti</div>
        </div>
      )}
    </div>
  );
}

// ============ HLS PLAYER ============
function HlsPlayer({ streamUrl }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    let hls;
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: false, lowLatencyMode: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch(()=>{});
    }
    return () => { if (hls) hls.destroy(); };
  }, [streamUrl]);
  return (
    <div className="stream-wrap">
      <video ref={videoRef} className="stream-canvas" autoPlay playsInline style={{objectFit:'cover',background:'#000'}} />
    </div>
  );
}

// ============ STATUS BADGE ============
function StatusBadge({ status }) {
  if (status==='live') return <span className="status status--live"><span className="status__dot"/>LIVE</span>;
  if (status==='stopped') return <span className="status status--stopped"><span className="status__dot"/>To'xtagan</span>;
  return <span className="status status--error"><span className="status__dot"/>Xato</span>;
}

// ============ CAMERA TILE ============
function CameraTile({ camera, onOpen }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(i); }, []);
  return (
    <button className="tile" onClick={() => onOpen(camera)}>
      <div className="tile__video">
        <StreamCanvas camera={camera} mini />
        <div className="tile__osd-tl"><StatusBadge status={camera.status}/></div>
        <div className="tile__osd-tr"><span className="osd-chip">{camera.resolution}</span></div>
        <div className="tile__osd-bl"><span className="osd-chip osd-chip--ghost">CAM-{String(camera.id).padStart(2,'0')}</span></div>
        <div className="tile__osd-br"><span className="osd-chip osd-chip--ghost">{now.toLocaleString('uz-UZ',{hour12:false})}</span></div>
      </div>
      <div className="tile__meta">
        <div>
          <div className="tile__name">{camera.name}</div>
          <div className="tile__loc">{camera.location}</div>
        </div>
        <div style={{textAlign:'right',fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.4}}>
          <div style={{fontVariantNumeric:'tabular-nums'}}>{now.toLocaleTimeString('uz-UZ',{hour12:false})}</div>
          <div>{now.toLocaleDateString('uz-UZ')}</div>
        </div>
      </div>
    </button>
  );
}

// ============ SINGLE VIEW (public) ============
function SingleView({ camera, cameras, onBack, onSwitch }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(i); }, []);
  const showVideo = camera.status==='live' && camera.stream_url;
  return (
    <div className="page single">
      <div className="single__top">
        <button className="ghost-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
          Kameralarga qaytish
        </button>
        <div className="single__title">
          <StatusBadge status={camera.status}/>
          <h2>{camera.name}</h2>
          <span className="muted">· {camera.location}</span>
        </div>
        <div className="single__actions" />
      </div>
      <div className="single__stage">
        {showVideo ? <HlsPlayer streamUrl={camera.stream_url}/> : <StreamCanvas camera={camera}/>}
        <div className="single__osd-tl"><StatusBadge status={camera.status}/></div>
        <div className="single__osd-tr"><span className="osd-chip">{camera.resolution} · {camera.fps}fps</span></div>
        <div className="single__osd-bl"><span className="osd-chip osd-chip--ghost">CAM-{String(camera.id).padStart(2,'0')}</span></div>
        <div className="single__osd-br"><span className="osd-chip osd-chip--ghost">{now.toLocaleString('uz-UZ',{hour12:false})}</span></div>
      </div>
      <div className="single__strip">
        <div className="strip-label">Boshqa kameralar</div>
        <div className="strip-row">
          {cameras.filter(c=>c.id!==camera.id && c.status==='live').slice(0,8).map(c=>(
            <button key={c.id} className="strip-tile" onClick={()=>onSwitch(c)}>
              <div className="strip-tile__video"><StreamCanvas camera={c} mini/></div>
              <div className="strip-tile__name">{c.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ HASH ROUTING ============
function useHashCamId() {
  const get = () => {
    const m = window.location.hash.match(/^#cam-(\d+)$/);
    return m ? parseInt(m[1]) : null;
  };
  const [camId, setCamId] = useState(get);
  useEffect(() => {
    const handler = () => setCamId(get());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const set = (id) => { window.location.hash = id ? `cam-${id}` : ''; };
  return [camId, set];
}

// ======================================================================
// PUBLIC APP  —  faqat viewer, sidebar yo'q
// ======================================================================
function PublicApp() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hashCamId, setHashCamId] = useHashCamId();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () => apiFetch('/api/cameras/').then(d => { setCameras(d); setLoading(false); }).catch(()=>setLoading(false));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const focused = cameras.find(c => c.id === hashCamId) || null;

  const liveCameras = cameras.filter(c => c.status === 'live');
  const liveCount = liveCameras.length;

  const visible = liveCameras.filter(c => {
    if (query && !(`${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  if (focused) {
    return (
      <div style={{minHeight:'100vh', background:'var(--bg)'}}>
        <SingleView camera={focused} cameras={cameras} onBack={()=>setHashCamId(null)} onSwitch={c=>setHashCamId(c.id)}/>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg)', color:'var(--text)'}}>
      {/* Minimal header */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 2rem', height:'56px',
        borderBottom:'1px solid var(--border)',
        background:'var(--surface)',
      }}>
        <div className="logo" style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span className="logo__dot"/>
          <span className="logo__name">Camlive</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <div className="kpi-inline"><span className="dot dot--live"/> {liveCount} jonli efir</div>
        </div>
      </header>

      {/* Content */}
      <div style={{maxWidth:'1400px', margin:'0 auto', padding:'2rem'}}>
        <div className="toolbar" style={{marginBottom:'1.5rem'}}>
          <div className="search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nomi yoki joylashuv bo'yicha qidirish"/>
          </div>
        </div>

        {loading ? (
          <div className="empty">Yuklanmoqda...</div>
        ) : (
          <div className="grid g-cols-auto">
            {visible.map(c=><CameraTile key={c.id} camera={c} onOpen={c=>setHashCamId(c.id)}/>)}
            {visible.length===0 && <div className="empty">Mos kelmadi.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================================================================
// ADMIN APP  —  sidebar + login + boshqaruv
// ======================================================================

// ── Login ──
function LoginPage({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!u||!p) { setErr('Login va parolni kiriting'); return; }
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/login/', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:u,password:p}),
      });
      const data = await res.json();
      if (res.ok) onLogin(data.username);
      else setErr(data.error||"Noto'g'ri login yoki parol");
    } catch { setErr('Server bilan aloqa yo\'q'); }
    finally { setLoading(false); }
  };

  const onKey = e => { if (e.key==='Enter') handleLogin(); };

  return (
    <div className="login-stage">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo"><span className="logo__dot"/><span className="logo__name">Camlive</span></div>
        </div>
        <h2>Admin panel</h2>
        <p className="muted">Boshqaruv paneliga kirish uchun ma'lumotlaringizni kiriting.</p>
        <label className="field"><span>Login</span><input value={u} onChange={e=>setU(e.target.value)} onKeyDown={onKey} placeholder="admin" autoFocus/></label>
        <label className="field"><span>Parol</span><input type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={onKey} placeholder="••••••••"/></label>
        {err && <div style={{color:'#dc2626',fontSize:'0.85em',marginTop:'-4px'}}>{err}</div>}
        <button className="primary-btn primary-btn--full" onClick={handleLogin} disabled={loading}>
          {loading?'Tekshirilmoqda...':'Kirish'}
        </button>
        <div className="login-hint" style={{marginTop:'12px'}}>
          <a href="/" style={{color:'var(--text-2)',fontSize:'0.85em'}}>← Jonli efirga qaytish</a>
        </div>
      </div>
      <div className="login-side">
        <div className="login-side__inner">
          <div className="eyebrow eyebrow--light">Admin panel</div>
          <h1>IP kameralarni boshqarish.</h1>
          <p>Kamera qo'shish, o'chirish, FFmpeg stream boshqarish.</p>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit Modal ──
const EMPTY_FORM = { name:'', location:'', cam_username:'', cam_password:'', ip:'', port:'554', resolution:'1920x1080', fps:25, status:'stopped' };

function CameraModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? {
      name:initial.name||'', location:initial.location||'',
      cam_username:initial.cam_username||'', cam_password:initial.cam_password||'',
      ip:initial.ip||'', port:String(initial.port||554),
      resolution:initial.resolution||'1920x1080', fps:initial.fps||25, status:initial.status||'stopped',
    } : EMPTY_FORM);
  }, [initial, open]);

  if (!open) return null;
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isEdit = !!initial;
  const canSave = form.name && form.ip && form.port && form.cam_username;

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="eyebrow">{isEdit?'Tahrirlash':'Yangi qo\'shish'}</div>
            <h3>{isEdit?form.name:'Yangi kamera'}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <label className="field"><span>Kamera nomi *</span><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Asosiy kirish"/></label>
            <label className="field"><span>Joylashuv / Tavsif</span><input value={form.location} onChange={e=>set('location',e.target.value)} placeholder="1-bino, 1-qavat (ixtiyoriy)"/></label>
            <label className="field"><span>IP manzil *</span><input value={form.ip} onChange={e=>set('ip',e.target.value)} placeholder="172.16.39.56"/></label>
            <label className="field"><span>Port *</span><input type="number" value={form.port} onChange={e=>set('port',e.target.value)} placeholder="554" min="1" max="65535"/></label>
            <label className="field"><span>Foydalanuvchi nomi *</span><input value={form.cam_username} onChange={e=>set('cam_username',e.target.value)} placeholder="admin" autoComplete="off"/></label>
            <label className="field"><span>Parol</span><input value={form.cam_password} onChange={e=>set('cam_password',e.target.value)} placeholder="parol" autoComplete="off"/></label>
            <label className="field"><span>Sifat</span>
              <select value={form.resolution} onChange={e=>set('resolution',e.target.value)}>
                <option>1920x1080</option><option>1280x720</option><option>854x480</option><option>640x360</option>
              </select>
            </label>
            <label className="field"><span>FPS</span>
              <select value={form.fps} onChange={e=>set('fps',+e.target.value)}>
                {[10,15,20,25,30].map(n=><option key={n} value={n}>{n} fps</option>)}
              </select>
            </label>
            <label className="field field--full"><span>RTSP URL (avtomatik)</span>
              <input readOnly value={form.ip?`rtsp://${form.cam_username}:***@${form.ip}:${form.port}`:''}
                style={{opacity:0.6,cursor:'default'}}/>
              <small>FFmpeg komandasi: <code>ffmpeg -i rtsp://user:pass@{form.ip||'IP'}:{form.port} ...</code></small>
            </label>
            <label className="field"><span>Boshlang'ich holat</span>
              <div className="seg seg--sm">
                <button type="button" className={'seg__btn'+(form.status==='stopped'?' is-on':'')} onClick={()=>set('status','stopped')}>To'xtatilgan</button>
                <button type="button" className={'seg__btn'+(form.status==='live'?' is-on':'')} onClick={()=>set('status','live')}>Darhol boshlash</button>
              </div>
            </label>
          </div>
        </div>
        <div className="modal__foot">
          <button className="ghost-btn" onClick={onClose}>Bekor qilish</button>
          <button className="primary-btn" onClick={handleSave} disabled={!canSave||saving}>
            {saving?'Saqlanmoqda...':(isEdit?"O'zgarishlarni saqlash":"Qo'shish")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Dashboard ──
function LogsModal({ camId, camName, onClose }) {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = () => apiFetch(`/api/cameras/${camId}/logs/`).then(d => setLogs(d.logs)).catch(()=>{});
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [camId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:'800px', width:'95vw'}} onClick={e=>e.stopPropagation()}>
        <div className="modal__head">
          <div><div className="eyebrow">FFmpeg loglari</div><h3>{camName}</h3></div>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div style={{
          background:'#0a0c10', color:'#b0c4b8', fontFamily:'JetBrains Mono,monospace',
          fontSize:'0.75rem', lineHeight:'1.5', padding:'1rem',
          height:'420px', overflowY:'auto', borderRadius:'0 0 12px 12px',
        }}>
          {logs.length === 0
            ? <div style={{color:'#666', textAlign:'center', paddingTop:'2rem'}}>Log yo'q — stream ishga tushirilmagan</div>
            : logs.map((line, i) => (
                <div key={i} style={{
                  color: line.includes('Error')||line.includes('error')||line.includes('Failed') ? '#f87171'
                       : line.includes('warning')||line.includes('Warning') ? '#fbbf24'
                       : line.includes('frame=')||line.includes('fps=') ? '#86efac'
                       : '#b0c4b8'
                }}>{line}</div>
              ))
          }
          <div ref={bottomRef}/>
        </div>
      </div>
    </div>
  );
}

// ── Settings Page ──
function SettingsPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [userMsg, setUserMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [userErr, setUserErr] = useState('');
  const [pwErr, setPwErr] = useState('');

  const loadUsers = () => apiFetch('/api/users/').then(setUsers).catch(()=>{});
  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async () => {
    setUserErr(''); setUserMsg('');
    if (!newUser.username || !newUser.password) { setUserErr('Login va parol kiritilsin'); return; }
    try {
      await apiFetch('/api/users/create/', { method:'POST', body: JSON.stringify(newUser) });
      setUserMsg('Foydalanuvchi yaratildi');
      setNewUser({ username:'', password:'' });
      loadUsers();
    } catch(e) { setUserErr(e.message); }
  };

  const handleDeleteUser = async (uid, uname) => {
    if (!confirm(`"${uname}"ni o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await apiFetch(`/api/users/${uid}/delete/`, { method:'POST' });
      loadUsers();
    } catch(e) { alert(e.message); }
  };

  const handleChangePw = async () => {
    setPwErr(''); setPwMsg('');
    if (!pwForm.old_password || !pwForm.new_password) { setPwErr('Barcha maydonlarni to\'ldiring'); return; }
    if (pwForm.new_password !== pwForm.confirm) { setPwErr('Yangi parollar mos kelmaydi'); return; }
    try {
      await apiFetch('/api/change-password/', { method:'POST', body: JSON.stringify(pwForm) });
      setPwMsg('Parol muvaffaqiyatli o\'zgartirildi');
      setPwForm({ old_password:'', new_password:'', confirm:'' });
    } catch(e) { setPwErr(e.message); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Sozlamalar</div><h1 className="page-title">Foydalanuvchilar</h1></div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', alignItems:'start'}}>

        {/* Parol o'zgartirish */}
        <div className="table-card" style={{padding:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem', fontSize:'1rem'}}>Parolni o'zgartirish</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
            <label className="field"><span>Joriy parol</span>
              <input type="password" value={pwForm.old_password} onChange={e=>setPwForm(f=>({...f,old_password:e.target.value}))} placeholder="••••••••"/>
            </label>
            <label className="field"><span>Yangi parol</span>
              <input type="password" value={pwForm.new_password} onChange={e=>setPwForm(f=>({...f,new_password:e.target.value}))} placeholder="••••••••"/>
            </label>
            <label className="field"><span>Yangi parolni takrorlang</span>
              <input type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} placeholder="••••••••"/>
            </label>
            {pwErr && <div style={{color:'#dc2626',fontSize:'0.85em'}}>{pwErr}</div>}
            {pwMsg && <div style={{color:'#16a34a',fontSize:'0.85em'}}>{pwMsg}</div>}
            <button className="primary-btn" onClick={handleChangePw}>Saqlash</button>
          </div>
        </div>

        {/* Yangi foydalanuvchi */}
        <div className="table-card" style={{padding:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem', fontSize:'1rem'}}>Yangi foydalanuvchi qo'shish</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
            <label className="field"><span>Login</span>
              <input value={newUser.username} onChange={e=>setNewUser(f=>({...f,username:e.target.value}))} placeholder="username" autoComplete="off"/>
            </label>
            <label className="field"><span>Parol</span>
              <input type="password" value={newUser.password} onChange={e=>setNewUser(f=>({...f,password:e.target.value}))} placeholder="••••••••" autoComplete="off"/>
            </label>
            {userErr && <div style={{color:'#dc2626',fontSize:'0.85em'}}>{userErr}</div>}
            {userMsg && <div style={{color:'#16a34a',fontSize:'0.85em'}}>{userMsg}</div>}
            <button className="primary-btn" onClick={handleAddUser}>Qo'shish</button>
          </div>
        </div>
      </div>

      {/* Foydalanuvchilar ro'yxati */}
      <div className="table-card" style={{marginTop:'1.5rem'}}>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Login</th><th>Rol</th><th style={{width:80}}>Amal</th></tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id}>
                <td>{u.id}</td>
                <td><strong>{u.username}</strong>{u.username===currentUser && <span className="osd-chip" style={{marginLeft:8}}>siz</span>}</td>
                <td>{u.is_superuser ? <span style={{color:'var(--accent)'}}>Superadmin</span> : 'Admin'}</td>
                <td>
                  {u.username !== currentUser && (
                    <button className="act act--danger" onClick={()=>handleDeleteUser(u.id, u.username)}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length===0 && <tr><td colSpan="4" style={{textAlign:'center',color:'var(--text-2)',padding:'1.5rem'}}>Yuklanmoqda...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminDashboard({ cameras, setCameras, openEditor, openAdd }) {
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState({});
  const [logsCamera, setLogsCamera] = useState(null);

  const toggleAudio = async (cam) => {
    setL(cam.id, 'audio');
    try {
      const d = await apiFetch(`/api/cameras/${cam.id}/toggle-audio/`, { method: 'POST' });
      setCameras(cs => cs.map(c => c.id === cam.id ? { ...c, audio: d.audio } : c));
    } catch(e) { alert('Xato: ' + e.message); }
    finally { setL(cam.id, null); }
  };

  const toggle = id => { const n=new Set(selected); n.has(id)?n.delete(id):n.add(id); setSelected(n); };
  const setL = (id,v) => setLoading(l=>({...l,[id]:v}));

  const visible = cameras.filter(c=>!query||`${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()));

  const startStream = async id => {
    setL(id,'start');
    try { const d=await apiFetch(`/api/cameras/${id}/start/`,{method:'POST'}); setCameras(cs=>cs.map(c=>c.id===id?{...c,status:d.status}:c)); }
    catch(e){ alert('Xato: '+e.message); } finally { setL(id,null); }
  };
  const stopStream = async id => {
    setL(id,'stop');
    try { const d=await apiFetch(`/api/cameras/${id}/stop/`,{method:'POST'}); setCameras(cs=>cs.map(c=>c.id===id?{...c,status:d.status}:c)); }
    catch(e){ alert('Xato: '+e.message); } finally { setL(id,null); }
  };
  const remove = async (id,name) => {
    if (!confirm(`"${name}"ni o'chirishni tasdiqlaysizmi?`)) return;
    try { await apiFetch(`/api/cameras/${id}/delete/`,{method:'POST'}); setCameras(cs=>cs.filter(c=>c.id!==id)); setSelected(s=>{const n=new Set(s);n.delete(id);return n;}); }
    catch(e){ alert('Xato: '+e.message); }
  };

  const liveCount=cameras.filter(c=>c.status==='live').length;
  const stoppedCount=cameras.filter(c=>c.status==='stopped').length;
  const errorCount=cameras.filter(c=>c.status==='error').length;

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Boshqaruv</div><h1 className="page-title">Kameralar boshqaruvi</h1></div>
        <div className="page-head__actions">
          <button className="primary-btn" onClick={openAdd}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
            Yangi kamera
          </button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat"><div className="stat__l">Jami</div><div className="stat__v">{cameras.length}</div></div>
        <div className="stat"><div className="stat__l">Jonli</div><div className="stat__v"><span className="dot dot--live"/> {liveCount}</div></div>
        <div className="stat"><div className="stat__l">To'xtatilgan</div><div className="stat__v"><span className="dot"/> {stoppedCount}</div></div>
        <div className="stat"><div className="stat__l">Xatolik</div><div className="stat__v"><span className="dot dot--err"/> {errorCount}</div></div>
      </div>

      <div className="toolbar">
        <div className="search search--lg">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kamera nomi yoki joylashuvi"/>
        </div>
        {selected.size>0 && (
          <div className="bulk">
            <span className="bulk__n">{selected.size} ta tanlandi</span>
            <button className="bulk__btn" onClick={async()=>{for(const id of selected)await startStream(id);setSelected(new Set());}}>Hammasini ishga tushirish</button>
            <button className="bulk__btn" onClick={async()=>{for(const id of selected)await stopStream(id);setSelected(new Set());}}>Hammasini to'xtatish</button>
            <button className="bulk__btn bulk__btn--danger" onClick={async()=>{if(!confirm(`${selected.size} ta o'chirilsinmi?`))return;for(const id of selected){await apiFetch(`/api/cameras/${id}/delete/`,{method:'POST'}).catch(()=>{});setCameras(cs=>cs.filter(c=>c.id!==id));}setSelected(new Set());}}>O'chirish</button>
          </div>
        )}
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th style={{width:36}}><input type="checkbox" checked={selected.size===visible.length&&visible.length>0} onChange={e=>setSelected(e.target.checked?new Set(visible.map(c=>c.id)):new Set())}/></th>
              <th>Kamera</th><th>IP / Port</th><th>Sifat</th><th>Status</th><th>Ovoz</th><th style={{width:220}}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c=>(
              <tr key={c.id} className={selected.has(c.id)?'is-selected':''}>
                <td><input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)}/></td>
                <td>
                  <div className="cell-cam">
                    <div className="cell-cam__thumb"><StreamCanvas camera={c} mini/></div>
                    <div>
                      <div className="cell-cam__name">{c.name}</div>
                      <div className="cell-cam__loc">{c.location||'—'} · CAM-{String(c.id).padStart(2,'0')}</div>
                    </div>
                  </div>
                </td>
                <td><code className="rtsp">{c.rtsp}</code></td>
                <td>{c.resolution} <span className="muted">/ {c.fps}fps</span></td>
                <td><StatusBadge status={c.status}/></td>
                <td>
                  <button
                    className={'act' + (c.audio ? ' act--start' : '')}
                    disabled={!!loading[c.id]}
                    onClick={() => toggleAudio(c)}
                    title={c.audio ? 'Ovoz yoqilgan — o\'chirish' : 'Ovoz o\'chirilgan — yoqish'}
                  >
                    {c.audio
                      ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                      : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    }
                    {loading[c.id]==='audio' ? '...' : (c.audio ? 'On' : 'Off')}
                  </button>
                </td>
                <td>
                  <div className="actions">
                    {c.status==='live'
                      ? <button className="act act--stop" disabled={!!loading[c.id]} onClick={()=>stopStream(c.id)}><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>{loading[c.id]==='stop'?'...':'Stop'}</button>
                      : <button className="act act--start" disabled={!!loading[c.id]} onClick={()=>startStream(c.id)}><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>{loading[c.id]==='start'?'...':'Start'}</button>
                    }
                    <button className="act" onClick={()=>setLogsCamera(c)} title="FFmpeg loglari">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h10"/></svg> Log
                    </button>
                    <button className="act" onClick={()=>openEditor(c)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg> Edit</button>
                    <button className="act act--danger" onClick={()=>remove(c.id,c.name)}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length===0 && <div className="empty empty--inset">Kamera topilmadi.</div>}
      </div>

      {logsCamera && (
        <LogsModal camId={logsCamera.id} camName={logsCamera.name} onClose={()=>setLogsCamera(null)}/>
      )}
    </div>
  );
}

// ── Admin shell ──
function AdminApp() {
  const t = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, ()=>{}];
  const [tweaks, setTweakRaw] = Array.isArray(t) ? t : [t.t||TWEAK_DEFAULTS, t.setTweak||(()=>{})];
  const setTweak = (k,v) => setTweakRaw(k,v);

  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminView, setAdminView] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return (['cameras', 'viewer', 'settings'].includes(h)) ? h : 'cameras';
  });
  const [cameras, setCameras] = useState([]);
  const [loadingCams, setLoadingCams] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    document.body.dataset.density = tweaks.density;
  }, [tweaks.accent, tweaks.density]);

  // Sessiya tekshirish
  useEffect(() => {
    fetch('/api/me/').then(r=>r.json()).then(d=>{ if(d.authenticated) setCurrentUser(d.username); }).finally(()=>setAuthChecked(true));
  }, []);

  // Kameralarni yuklash
  const fetchCameras = async () => {
    try { const d=await apiFetch('/api/cameras/'); setCameras(d); }
    catch(e){ console.error(e); } finally { setLoadingCams(false); }
  };
  useEffect(() => {
    if (!currentUser) { setLoadingCams(false); return; }
    setLoadingCams(true); fetchCameras();
    const t=setInterval(fetchCameras,10000); return ()=>clearInterval(t);
  }, [currentUser]);

  const saveCamera = async form => {
    try {
      if (editing) {
        const updated = await apiFetch(`/api/cameras/${editing.id}/update/`,{method:'POST',body:JSON.stringify(form)});
        setCameras(cs=>cs.map(c=>c.id===editing.id?updated:c));
      } else {
        const created = await apiFetch('/api/cameras/',{method:'POST',body:JSON.stringify(form)});
        setCameras(cs=>[...cs,created]);
      }
      setModalOpen(false); setEditing(null);
    } catch(e){ alert('Xato: '+e.message); }
  };

  if (!authChecked) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-2)'}}>Yuklanmoqda...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLogin={username=>{ setCurrentUser(username); }}/>;
  }

  const liveCount = cameras.filter(c=>c.status==='live').length;

  return (
    <div className="shell" data-sidebar={tweaks.sidebarStyle}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="logo__dot"/>
          {tweaks.sidebarStyle==='labeled' && <span className="logo__name">Camlive</span>}
        </div>
        <nav className="nav">
          {[
            { id:'cameras',  label:'Kameralar',  badge:liveCount, icon:<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg> },
            { id:'viewer',   label:'Jonli efir', icon:<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> },
            { id:'settings', label:'Sozlamalar', icon:<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
          ].map(item=>(
            <button key={item.id} className={'nav__item'+(adminView===item.id?' is-on':'')} onClick={()=>{ setAdminView(item.id); window.location.hash=item.id; }} title={item.label}>
              <span className="nav__icon">{item.icon}</span>
              {tweaks.sidebarStyle==='labeled' && <span className="nav__label">{item.label}</span>}
              {item.badge!=null && tweaks.sidebarStyle==='labeled' && <span className="nav__badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <button className="nav__item" title="Chiqish" onClick={async()=>{ await fetch('/api/logout/',{method:'POST'}); window.location.href='/'; }}>
            <span className="nav__icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
            </span>
            {tweaks.sidebarStyle==='labeled' && <span className="nav__label">{currentUser}</span>}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <a href="/" style={{color:'var(--text-2)',textDecoration:'none'}} className="crumb">Jonli efir</a>
            <span className="crumb-sep">/</span>
            <span className="crumb crumb--on">Admin panel</span>
          </div>
          <div className="topbar__right">
            <div className="kpi-inline"><span className="dot dot--live"/> {liveCount} ta kamera efirda</div>
          </div>
        </div>

        <div className="main__scroll">
          {loadingCams ? (
            <div className="empty" style={{marginTop:'4rem'}}>Kameralar yuklanmoqda...</div>
          ) : (
            adminView==='cameras'
              ? <AdminDashboard cameras={cameras} setCameras={setCameras} openEditor={c=>{setEditing(c);setModalOpen(true);}} openAdd={()=>{setEditing(null);setModalOpen(true);}}/>
              : adminView==='settings'
              ? <SettingsPage currentUser={currentUser}/>
              : <PublicViewerEmbed cameras={cameras}/>
          )}
        </div>
      </main>

      <CameraModal open={modalOpen} onClose={()=>{setModalOpen(false);setEditing(null);}} onSave={saveCamera} initial={editing}/>
    </div>
  );
}

// Admin ichida viewer preview
function PublicViewerEmbed({ cameras }) {
  const [focused, setFocused] = useState(null);
  const liveCount = cameras.filter(c=>c.status==='live').length;
  const offlineCount = cameras.length - liveCount;
  if (focused) return <SingleView camera={focused} cameras={cameras} onBack={()=>setFocused(null)} onSwitch={c=>setFocused(c)}/>;
  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Jonli efir</div><h1 className="page-title">Kameralar</h1></div>
        <div className="page-head__meta">
          <div className="kpi"><span className="kpi__dot kpi__dot--live"/><span className="kpi__n">{liveCount}</span><span className="kpi__l">jonli</span></div>
          <div className="kpi"><span className="kpi__dot"/><span className="kpi__n">{offlineCount}</span><span className="kpi__l">faolsiz</span></div>
        </div>
      </header>
      <div className="grid g-cols-auto">
        {cameras.map(c=><CameraTile key={c.id} camera={c} onOpen={setFocused}/>)}
        {cameras.length===0 && <div className="empty">Hali kamera qo'shilmagan.</div>}
      </div>
    </div>
  );
}

// ======================================================================
// ENTRY POINT
// ======================================================================
ReactDOM.createRoot(document.getElementById('root')).render(
  IS_ADMIN ? <AdminApp/> : <PublicApp/>
);
