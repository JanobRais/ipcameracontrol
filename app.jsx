const { useState, useEffect, useRef, useMemo } = React;

// ============ TWEAKS ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "density": "comfortable",
  "gridCols": "auto",
  "sidebarStyle": "labeled",
  "showStats": true
}/*EDITMODE-END*/;

// ============ MOCK DATA ============
const SEED_CAMERAS = [
  { id: 1, name: "Asosiy kirish",   location: "1-bino, kirish",       rtsp: "rtsp://192.168.1.101:554/stream1", resolution: "1920x1080", fps: 25, status: "live",    bitrate: 4200, uptime: "12d 4h" },
  { id: 2, name: "Avtoturargoh A",  location: "Tashqi, shimol",       rtsp: "rtsp://192.168.1.102:554/stream1", resolution: "1280x720",  fps: 20, status: "live",    bitrate: 2100, uptime: "5d 2h"  },
  { id: 3, name: "Ombor — Sho'ba 1",location: "2-bino, 1-qavat",      rtsp: "rtsp://192.168.1.103:554/stream1", resolution: "1920x1080", fps: 25, status: "live",    bitrate: 3800, uptime: "21d 7h" },
  { id: 4, name: "Yo'lak — Sharq",  location: "1-bino, 2-qavat",      rtsp: "rtsp://192.168.1.104:554/stream1", resolution: "1280x720",  fps: 15, status: "stopped", bitrate: 0,    uptime: "—"     },
  { id: 5, name: "Server xonasi",   location: "Texnik blok",          rtsp: "rtsp://192.168.1.105:554/stream1", resolution: "1920x1080", fps: 25, status: "live",    bitrate: 4100, uptime: "33d 1h" },
  { id: 6, name: "Yuk maydoni",     location: "Tashqi, g'arb",        rtsp: "rtsp://192.168.1.106:554/stream1", resolution: "1920x1080", fps: 25, status: "error",   bitrate: 0,    uptime: "—"     },
  { id: 7, name: "Qabulxona",       location: "1-bino, 1-qavat",      rtsp: "rtsp://192.168.1.107:554/stream1", resolution: "1280x720",  fps: 20, status: "live",    bitrate: 1900, uptime: "8d 9h"  },
  { id: 8, name: "Avtoturargoh B",  location: "Tashqi, janub",        rtsp: "rtsp://192.168.1.108:554/stream1", resolution: "1280x720",  fps: 20, status: "live",    bitrate: 2200, uptime: "5d 2h"  }
];

// ============ STREAM PLACEHOLDER ============
// Animated noise + grid + corner OSD — stand-in for HLS/MSE feed
function StreamCanvas({ camera, mini = false }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
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
    const scene = camera.id % 4; // pick a "scene" background

    const render = () => {
      tRef.current += 1;
      const t = tRef.current;

      // Background scene (subtle gradient varying by camera id)
      let g;
      if (scene === 0) {
        g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#1a2230"); g.addColorStop(1, "#0d141d");
      } else if (scene === 1) {
        g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#23201a"); g.addColorStop(1, "#0e0c08");
      } else if (scene === 2) {
        g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "#101a18"); g.addColorStop(1, "#1c2e2a");
      } else {
        g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#1d1a23"); g.addColorStop(1, "#0a0810");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Faint perspective floor lines
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const cx = w / 2, vy = h * 0.45;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * (w / 2), h);
        ctx.lineTo(cx, vy);
        ctx.stroke();
      }
      for (let i = 1; i < 6; i++) {
        const yy = vy + (h - vy) * (i * i) / 30;
        ctx.beginPath();
        ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
      }

      // Moving blob (simulated subject)
      if (camera.status === "live") {
        const bx = (Math.sin((t + seed) * 0.012) * 0.35 + 0.5) * w;
        const by = h * 0.55 + Math.cos((t + seed) * 0.008) * h * 0.05;
        const rg = ctx.createRadialGradient(bx, by, 4, bx, by, Math.min(w, h) * 0.18);
        rg.addColorStop(0, "rgba(255,235,200,0.55)");
        rg.addColorStop(1, "rgba(255,235,200,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      // Noise
      if (!mini || t % 2 === 0) {
        const noiseCount = mini ? 80 : 320;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        for (let i = 0; i < noiseCount; i++) {
          const x = Math.random() * w, y = Math.random() * h;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Scan line
      const sy = (t * 1.2) % h;
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(0, sy, w, 1);

      rafRef.current = requestAnimationFrame(render);
    };

    if (camera.status === "live") {
      render();
    } else {
      // Static frozen frame
      ctx.fillStyle = "#0a0c10";
      ctx.fillRect(0, 0, w, h);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [camera.id, camera.status, mini]);

  return (
    <div className="stream-wrap">
      <canvas ref={canvasRef} className="stream-canvas" />
      {camera.status === "stopped" && (
        <div className="stream-overlay stream-overlay--stopped">
          <div className="stream-overlay__icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/><path d="M3 3l18 18" strokeWidth="1.8"/></svg>
          </div>
          <div className="stream-overlay__title">Stream to'xtatilgan</div>
          <div className="stream-overlay__sub">Admin tomonidan boshlanmagan</div>
        </div>
      )}
      {camera.status === "error" && (
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

// ============ LIVE BADGE ============
function StatusBadge({ status }) {
  if (status === "live") return (
    <span className="status status--live"><span className="status__dot" />LIVE</span>
  );
  if (status === "stopped") return (
    <span className="status status--stopped"><span className="status__dot" />To'xtagan</span>
  );
  return (
    <span className="status status--error"><span className="status__dot" />Xato</span>
  );
}

// ============ CAMERA TILE (public) ============
function CameraTile({ camera, onOpen }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const ts = now.toLocaleString("uz-UZ", { hour12: false });
  return (
    <button className="tile" onClick={() => onOpen(camera)}>
      <div className="tile__video">
        <StreamCanvas camera={camera} mini />
        <div className="tile__osd-tl">
          <StatusBadge status={camera.status} />
        </div>
        <div className="tile__osd-tr">
          <span className="osd-chip">{camera.resolution}</span>
        </div>
        <div className="tile__osd-bl">
          <span className="osd-chip osd-chip--ghost">CAM-{String(camera.id).padStart(2, "0")}</span>
        </div>
        <div className="tile__osd-br">
          <span className="osd-chip osd-chip--ghost">{ts}</span>
        </div>
      </div>
      <div className="tile__meta">
        <div>
          <div className="tile__name">{camera.name}</div>
          <div className="tile__loc">{camera.location}</div>
        </div>
        <svg className="tile__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </button>
  );
}

// ============ PUBLIC VIEWER ============
function PublicViewer({ cameras, gridCols }) {
  const [focused, setFocused] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const visible = cameras.filter(c => {
    if (filter === "live" && c.status !== "live") return false;
    if (filter === "offline" && c.status === "live") return false;
    if (query && !(`${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  const liveCount = cameras.filter(c => c.status === "live").length;
  const offlineCount = cameras.length - liveCount;

  const colClass = gridCols === "auto"
    ? "g-cols-auto"
    : `g-cols-${gridCols}`;

  if (focused) {
    return <SingleView camera={focused} cameras={cameras} onBack={() => setFocused(null)} onSwitch={(c) => setFocused(c)} />;
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Jonli efir</div>
          <h1 className="page-title">Kameralar</h1>
        </div>
        <div className="page-head__meta">
          <div className="kpi"><span className="kpi__dot kpi__dot--live" /><span className="kpi__n">{liveCount}</span><span className="kpi__l">jonli</span></div>
          <div className="kpi"><span className="kpi__dot" /><span className="kpi__n">{offlineCount}</span><span className="kpi__l">faolsiz</span></div>
        </div>
      </header>

      <div className="toolbar">
        <div className="seg">
          {[
            { k: "all",     l: `Hammasi · ${cameras.length}` },
            { k: "live",    l: `Jonli · ${liveCount}` },
            { k: "offline", l: `Faolsiz · ${offlineCount}` }
          ].map(o => (
            <button key={o.k} className={"seg__btn" + (filter === o.k ? " is-on" : "")} onClick={() => setFilter(o.k)}>{o.l}</button>
          ))}
        </div>
        <div className="search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nomi yoki joylashuv bo'yicha qidirish" />
        </div>
      </div>

      <div className={"grid " + colClass}>
        {visible.map(c => <CameraTile key={c.id} camera={c} onOpen={setFocused} />)}
        {visible.length === 0 && (
          <div className="empty">Mos kelmadi. Filtrlarni o'zgartiring.</div>
        )}
      </div>
    </div>
  );
}

// ============ SINGLE VIEW ============
function SingleView({ camera, cameras, onBack, onSwitch }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="page single">
      <div className="single__top">
        <button className="ghost-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
          Kameralarga qaytish
        </button>
        <div className="single__title">
          <StatusBadge status={camera.status} />
          <h2>{camera.name}</h2>
          <span className="muted">· {camera.location}</span>
        </div>
        <div className="single__actions">
          <button className="ghost-btn"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Fullscreen</button>
          <button className="ghost-btn"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" fill="currentColor" fillOpacity=".0"/><circle cx="12" cy="12" r="3" fill="#dc2626"/></svg> Snapshot</button>
        </div>
      </div>

      <div className="single__stage">
        <StreamCanvas camera={camera} />
        <div className="single__osd-tl"><StatusBadge status={camera.status} /></div>
        <div className="single__osd-tr">
          <span className="osd-chip">{camera.resolution} · {camera.fps}fps</span>
          <span className="osd-chip">{(camera.bitrate / 1000).toFixed(1)} Mb/s</span>
        </div>
        <div className="single__osd-bl"><span className="osd-chip osd-chip--ghost">CAM-{String(camera.id).padStart(2, "0")}</span></div>
        <div className="single__osd-br"><span className="osd-chip osd-chip--ghost">{now.toLocaleString("uz-UZ", { hour12: false })}</span></div>
      </div>

      <div className="single__meta">
        <div className="meta-card">
            <div className="meta-card__l">Stream sifati</div>
            <div className="meta-card__v">{camera.resolution} @ {camera.fps}fps</div>
        </div>
        <div className="meta-card">
            <div className="meta-card__l">Bitrate</div>
            <div className="meta-card__v">{camera.bitrate ? (camera.bitrate / 1000).toFixed(2) + " Mb/s" : "—"}</div>
        </div>
        <div className="meta-card">
            <div className="meta-card__l">Uptime</div>
            <div className="meta-card__v">{camera.uptime}</div>
        </div>
        <div className="meta-card">
            <div className="meta-card__l">Protokol</div>
            <div className="meta-card__v">RTSP → HLS (FFmpeg)</div>
        </div>
      </div>

      <div className="single__strip">
        <div className="strip-label">Boshqa kameralar</div>
        <div className="strip-row">
          {cameras.filter(c => c.id !== camera.id).slice(0, 8).map(c => (
            <button key={c.id} className="strip-tile" onClick={() => onSwitch(c)}>
              <div className="strip-tile__video"><StreamCanvas camera={c} mini /></div>
              <div className="strip-tile__name">{c.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN ============
function AdminDashboard({ cameras, setCameras, openEditor, openAdd }) {
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");

  const toggle = (id) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const visible = cameras.filter(c =>
    !query || `${c.name} ${c.location} ${c.rtsp}`.toLowerCase().includes(query.toLowerCase())
  );

  const setStatus = (id, status) => {
    setCameras(cs => cs.map(c => c.id === id ? { ...c, status, bitrate: status === "live" ? (c.bitrate || 2000 + Math.round(Math.random()*2000)) : 0, uptime: status === "live" ? c.uptime !== "—" ? c.uptime : "0d 0h" : "—" } : c));
  };
  const remove = (id) => {
    setCameras(cs => cs.filter(c => c.id !== id));
    const n = new Set(selected); n.delete(id); setSelected(n);
  };

  const liveCount = cameras.filter(c => c.status === "live").length;
  const stoppedCount = cameras.filter(c => c.status === "stopped").length;
  const errorCount = cameras.filter(c => c.status === "error").length;
  const totalBitrate = cameras.reduce((s, c) => s + c.bitrate, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Boshqaruv</div>
          <h1 className="page-title">Kameralar boshqaruvi</h1>
        </div>
        <div className="page-head__actions">
          <button className="ghost-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg> Yangilash</button>
          <button className="primary-btn" onClick={openAdd}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
            Yangi kamera
          </button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat">
          <div className="stat__l">Jami kameralar</div>
          <div className="stat__v">{cameras.length}</div>
        </div>
        <div className="stat">
          <div className="stat__l">Jonli efirda</div>
          <div className="stat__v"><span className="dot dot--live" /> {liveCount}</div>
        </div>
        <div className="stat">
          <div className="stat__l">To'xtatilgan</div>
          <div className="stat__v"><span className="dot" /> {stoppedCount}</div>
        </div>
        <div className="stat">
          <div className="stat__l">Xatolik</div>
          <div className="stat__v"><span className="dot dot--err" /> {errorCount}</div>
        </div>
        <div className="stat">
          <div className="stat__l">Umumiy bitrate</div>
          <div className="stat__v">{(totalBitrate / 1000).toFixed(1)} <span className="stat__u">Mb/s</span></div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search search--lg">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Kamera nomi, joylashuvi yoki RTSP URL'i bo'yicha qidirish" />
        </div>
        {selected.size > 0 && (
          <div className="bulk">
            <span className="bulk__n">{selected.size} ta tanlandi</span>
            <button className="bulk__btn" onClick={() => { selected.forEach(id => setStatus(id, "live")); setSelected(new Set()); }}>Hammasini ishga tushirish</button>
            <button className="bulk__btn" onClick={() => { selected.forEach(id => setStatus(id, "stopped")); setSelected(new Set()); }}>Hammasini to'xtatish</button>
            <button className="bulk__btn bulk__btn--danger" onClick={() => { selected.forEach(id => remove(id)); }}>O'chirish</button>
          </div>
        )}
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox"
                  checked={selected.size === visible.length && visible.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map(c => c.id)) : new Set())} />
              </th>
              <th>Kamera</th>
              <th>RTSP manba</th>
              <th>Sifat</th>
              <th>Bitrate</th>
              <th>Uptime</th>
              <th>Status</th>
              <th style={{ width: 240 }}>Amal</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => (
              <tr key={c.id} className={selected.has(c.id) ? "is-selected" : ""}>
                <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td>
                  <div className="cell-cam">
                    <div className="cell-cam__thumb"><StreamCanvas camera={c} mini /></div>
                    <div>
                      <div className="cell-cam__name">{c.name}</div>
                      <div className="cell-cam__loc">{c.location} · CAM-{String(c.id).padStart(2, "0")}</div>
                    </div>
                  </div>
                </td>
                <td><code className="rtsp">{c.rtsp}</code></td>
                <td>{c.resolution} <span className="muted">/ {c.fps}fps</span></td>
                <td>{c.bitrate ? (c.bitrate / 1000).toFixed(2) + " Mb/s" : <span className="muted">—</span>}</td>
                <td>{c.uptime}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>
                  <div className="actions">
                    {c.status === "live" ? (
                      <button className="act act--stop" onClick={() => setStatus(c.id, "stopped")}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop
                      </button>
                    ) : (
                      <button className="act act--start" onClick={() => setStatus(c.id, "live")}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg> Start
                      </button>
                    )}
                    <button className="act" onClick={() => openEditor(c)}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg> Edit
                    </button>
                    <button className="act act--danger" onClick={() => { if (confirm(`${c.name}'ni o'chirishni tasdiqlaysizmi?`)) remove(c.id); }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div className="empty empty--inset">Kamera topilmadi.</div>}
      </div>
    </div>
  );
}

// ============ ADD / EDIT MODAL ============
function CameraModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || {
    name: "", location: "", rtsp: "", resolution: "1920x1080", fps: 25, status: "stopped"
  });
  const [testing, setTesting] = useState(null); // null | 'pending' | 'ok' | 'fail'
  useEffect(() => { setForm(initial || { name: "", location: "", rtsp: "", resolution: "1920x1080", fps: 25, status: "stopped" }); setTesting(null); }, [initial, open]);
  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial;

  const test = () => {
    setTesting("pending");
    setTimeout(() => {
      setTesting(form.rtsp.startsWith("rtsp://") ? "ok" : "fail");
    }, 1100);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="eyebrow">{isEdit ? "Tahrirlash" : "Yangi qo'shish"}</div>
            <h3>{isEdit ? form.name : "Yangi kamera"}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <label className="field">
              <span>Kamera nomi</span>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Masalan: Asosiy kirish" />
            </label>
            <label className="field">
              <span>Joylashuvi</span>
              <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="1-bino, 1-qavat" />
            </label>
            <label className="field field--full">
              <span>RTSP URL</span>
              <input value={form.rtsp} onChange={e => set("rtsp", e.target.value)} placeholder="rtsp://username:password@192.168.1.101:554/stream1" />
              <small>Bu URL FFmpeg'ga uzatiladi: <code>ffmpeg -i {form.rtsp || '<URL>'} -c:v libx264 ...</code></small>
            </label>
            <label className="field">
              <span>Sifat (resolution)</span>
              <select value={form.resolution} onChange={e => set("resolution", e.target.value)}>
                <option>1920x1080</option>
                <option>1280x720</option>
                <option>854x480</option>
                <option>640x360</option>
              </select>
            </label>
            <label className="field">
              <span>FPS</span>
              <select value={form.fps} onChange={e => set("fps", +e.target.value)}>
                {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} fps</option>)}
              </select>
            </label>
            <label className="field">
              <span>Boshlang'ich holat</span>
              <div className="seg seg--sm">
                <button type="button" className={"seg__btn" + (form.status === "stopped" ? " is-on" : "")} onClick={() => set("status", "stopped")}>To'xtatilgan</button>
                <button type="button" className={"seg__btn" + (form.status === "live" ? " is-on" : "")} onClick={() => set("status", "live")}>Avtomatik ishga tushirish</button>
              </div>
            </label>
            <div className="field">
              <span>Ulanishni sinash</span>
              <button type="button" className="ghost-btn" onClick={test} disabled={!form.rtsp || testing === "pending"}>
                {testing === "pending" ? (<><span className="spin" /> Sinaymoqda...</>)
                  : testing === "ok" ? (<><span className="dot dot--live" /> Ulanish muvaffaqiyatli · 25fps</>)
                  : testing === "fail" ? (<><span className="dot dot--err" /> Ulanib bo'lmadi</>)
                  : (<>RTSP'ni sinash</>)}
              </button>
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="ghost-btn" onClick={onClose}>Bekor qilish</button>
          <button className="primary-btn" onClick={() => onSave(form)} disabled={!form.name || !form.rtsp}>
            {isEdit ? "O'zgarishlarni saqlash" : "Qo'shish va saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ LOGIN ============
function LoginPage({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  return (
    <div className="login-stage">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo">
            <span className="logo__dot" />
            <span className="logo__name">Camlive</span>
          </div>
        </div>
        <h2>Tizimga kirish</h2>
        <p className="muted">Boshqaruv paneliga kirish uchun ma'lumotlaringizni kiriting.</p>
        <label className="field"><span>Foydalanuvchi nomi</span><input value={u} onChange={e => setU(e.target.value)} placeholder="admin" /></label>
        <label className="field"><span>Parol</span><input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" /></label>
        <button className="primary-btn primary-btn--full" onClick={onLogin}>Kirish</button>
        <div className="login-hint">Bu prototip — har qanday qiymat bilan kirish mumkin.</div>
      </div>
      <div className="login-side">
        <div className="login-side__inner">
          <div className="eyebrow eyebrow--light">Live monitoring</div>
          <h1>IP kameralarni bitta panel'dan kuzating.</h1>
          <p>RTSP → FFmpeg → HLS pipeline. Onlab kameralar, jonli statistika, oddiy admin.</p>
        </div>
      </div>
    </div>
  );
}

// ============ APP SHELL ============
function App() {
  const t = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : { t: TWEAK_DEFAULTS, setTweak: () => {} };
  const tweaks = t.t || TWEAK_DEFAULTS;
  const setTweak = t.setTweak || (() => {});

  const [view, setView] = useState("viewer"); // viewer | admin | login
  const [cameras, setCameras] = useState(SEED_CAMERAS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.body.dataset.density = tweaks.density;
  }, [tweaks.accent, tweaks.density]);

  // Simulate bitrate fluctuation
  useEffect(() => {
    const i = setInterval(() => {
      setCameras(cs => cs.map(c => c.status === "live"
        ? { ...c, bitrate: Math.max(800, c.bitrate + Math.round((Math.random() - 0.5) * 300)) }
        : c
      ));
    }, 2500);
    return () => clearInterval(i);
  }, []);

  const saveCamera = (form) => {
    if (editing) {
      setCameras(cs => cs.map(c => c.id === editing.id ? { ...c, ...form } : c));
    } else {
      const id = (cameras.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
      setCameras(cs => [...cs, {
        id, ...form,
        bitrate: form.status === "live" ? 2400 : 0,
        uptime: form.status === "live" ? "0d 0h" : "—"
      }]);
    }
    setModalOpen(false); setEditing(null);
  };

  const openEdit = (c) => { setEditing(c); setModalOpen(true); };
  const openAdd = () => { setEditing(null); setModalOpen(true); };

  if (view === "login") {
    return <LoginPage onLogin={() => setView("admin")} />;
  }

  const NavItem = ({ id, label, icon, badge }) => (
    <button className={"nav__item" + (view === id ? " is-on" : "")} onClick={() => setView(id)} title={label}>
      <span className="nav__icon">{icon}</span>
      {tweaks.sidebarStyle === "labeled" && <span className="nav__label">{label}</span>}
      {badge != null && tweaks.sidebarStyle === "labeled" && <span className="nav__badge">{badge}</span>}
    </button>
  );

  const liveCount = cameras.filter(c => c.status === "live").length;

  return (
    <div className="shell" data-sidebar={tweaks.sidebarStyle}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="logo__dot" />
          {tweaks.sidebarStyle === "labeled" && <span className="logo__name">Camlive</span>}
        </div>
        <nav className="nav">
          <NavItem id="viewer" label="Jonli efir" badge={liveCount}
            icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>}
          />
          <NavItem id="admin" label="Boshqaruv"
            icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4"/></svg>}
          />
        </nav>
        <div className="sidebar__foot">
          <button className="nav__item" onClick={() => setView("login")} title="Chiqish">
            <span className="nav__icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
            </span>
            {tweaks.sidebarStyle === "labeled" && <span className="nav__label">admin</span>}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span className="crumb">Camlive</span>
            <span className="crumb-sep">/</span>
            <span className="crumb crumb--on">{view === "viewer" ? "Jonli efir" : "Boshqaruv paneli"}</span>
          </div>
          <div className="topbar__right">
            <div className="kpi-inline"><span className="dot dot--live" /> {liveCount} ta kamera efirda</div>
            {view !== "admin" && (
              <button className="ghost-btn" onClick={() => setView("admin")}>Admin panel</button>
            )}
            {view !== "viewer" && (
              <button className="ghost-btn" onClick={() => setView("viewer")}>Jonli efir</button>
            )}
          </div>
        </div>

        <div className="main__scroll">
          {view === "viewer" && <PublicViewer cameras={cameras} gridCols={tweaks.gridCols} />}
          {view === "admin"  && <AdminDashboard cameras={cameras} setCameras={setCameras} openEditor={openEdit} openAdd={openAdd} />}
        </div>
      </main>

      <CameraModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={saveCamera}
        initial={editing}
      />

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Brand">
            <window.TweakColor label="Accent" value={tweaks.accent} onChange={v => setTweak("accent", v)}
              options={["#2563eb", "#0f766e", "#7c3aed", "#dc2626", "#0f172a"]} />
          </window.TweakSection>
          <window.TweakSection title="Layout">
            <window.TweakRadio label="Density" value={tweaks.density} onChange={v => setTweak("density", v)}
              options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />
            <window.TweakSelect label="Grid columns" value={tweaks.gridCols} onChange={v => setTweak("gridCols", v)}
              options={[
                { value: "auto", label: "Auto (responsive)" },
                { value: "2", label: "2 ustun" },
                { value: "3", label: "3 ustun" },
                { value: "4", label: "4 ustun" }
              ]} />
            <window.TweakRadio label="Sidebar" value={tweaks.sidebarStyle} onChange={v => setTweak("sidebarStyle", v)}
              options={[{ value: "labeled", label: "Labeled" }, { value: "icon", label: "Icon only" }]} />
          </window.TweakSection>
          <window.TweakSection title="Tezkor harakatlar">
            <window.TweakButton onClick={() => setView(view === "viewer" ? "admin" : "viewer")}>
              {view === "viewer" ? "Admin'ga o'tish" : "Jonli efirga o'tish"}
            </window.TweakButton>
            <window.TweakButton onClick={() => setView("login")}>Login sahifasini ko'rish</window.TweakButton>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
