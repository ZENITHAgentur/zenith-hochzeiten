import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://eiyceqesfhmzpxmzazzk.supabase.co";
const SUPABASE_KEY = "sb_publishable_5S325jD6pDOOJT62f8RBSw_GGLRoOt4";
const TABLE = "hochzeiten";

async function dbGetAll() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows.map(r => ({ ...r.data, id: r.id }));
}

async function dbUpsert(wedding) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id: wedding.id, data: wedding }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function dbDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
}

const PAKETE = [
  { label: "8 Stunden", preis: 1800 },
  { label: "10 Stunden", preis: 2200 },
  { label: "12 Stunden", preis: 2500 },
  { label: "14 Stunden", preis: 2800 },
];

const emptyForm = {
  id: null,
  erstgespraechDatum: "",
  erstgespraechAdresse: "",
  partner1: "",
  partner2: "",
  adresse: "",
  telefon: "",
  email: "",
  hochzeitsDatum: "",
  hochzeitsUhrzeit: "",
  trauungArt: "",
  trauungAdresse: "",
  feierAdresse: "",
  dauer: "",
  gettingReady: false,
  fotobuch: false,
  fotobox: false,
  fotoboxDetails: "",
  drohne: false,
  gaeste: "",
  paket: "",
  individualPreis: "",
  videoArt: "",
  videoStunden: "",
  angebotGewuenscht: false,
  anzahlungVereinbart: false,
  anzahlungBetrag: "",
  notizen: "",
  status: "Anfrage",
  foto: "",
};

const STATUS_COLORS = {
  Anfrage: "#f59e0b",
  Gebucht: "#10b981",
  Abgeschlossen: "#6366f1",
  Storniert: "#ef4444",
};

function formatDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}.${m}.${y}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86400000);
}

function formatEuro(val) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);
}

function calcPreis(form) {
  let total = 0;
  const paket = PAKETE.find(p => p.label === form.paket);
  if (paket) total += paket.preis;
  else if (form.individualPreis) total += parseFloat(form.individualPreis);
  if (form.videoArt === "zusammenfassung" || form.videoArt === "trauung") total += 990;
  else if (form.videoArt === "nurVideo" && form.videoStunden) total += parseFloat(form.videoStunden) * 350;
  if (form.fotobox) total += 250;
  return total;
}

const APP_PASSWORD = "Zenith2025!";

export default function App() {
  const [weddings, setWeddings] = useState([]);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("datum");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);
  const [toast, setToast] = useState(null);

  // ── LOGIN ─────────────────────────────────────────────────
  const [dark, setDark] = useState(() => localStorage.getItem("zenith_dark") === "true");

  const toggleDark = () => setDark(d => {
    const next = !d;
    localStorage.setItem("zenith_dark", next ? "true" : "false");
    return next;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("zenith_auth") === "true";
  });
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const handleLogin = () => {
    if (pwInput === APP_PASSWORD) {
      sessionStorage.setItem("zenith_auth", "true");
      setIsLoggedIn(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("zenith_auth");
    setIsLoggedIn(false);
    setPwInput("");
    setWeddings([]);
  };

  // Load from Supabase – nur wenn eingeloggt
  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    setLoading(true);
    dbGetAll()
      .then(data => { setWeddings(data); setLoading(false); })
      .catch(err => { setSyncError("Verbindung zu Supabase fehlgeschlagen: " + err.message); setLoading(false); });
  }, [isLoggedIn]);

  const D = dark ? darkStyles : {};

  if (!isLoggedIn) return (
    <div style={{ ...styles.loginPage, ...(dark ? { background: "#1c1c1e" } : {}) }}>
      <div style={{ ...styles.loginCard, ...(dark ? { background: "#2c2c2e", borderColor: "#3a3a3c" } : {}) }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <img src={LOGO_SRC} alt="ZENITH" style={{ height: 36, width: "auto", filter: dark ? "none" : "none" }} />
        </div>
        <div style={{ fontSize: 14, color: dark ? "#8e8e93" : "#64748b", textAlign: "center", marginBottom: 24 }}>
          Bitte melde dich an um fortzufahren
        </div>
        <div style={styles.fieldGroup}>
          <label style={{ ...styles.label, color: dark ? "#8e8e93" : undefined }}>Passwort</label>
          <input
            style={{ ...styles.input, ...(dark ? { background: "#3a3a3c", borderColor: "#48484a", color: "#f2f2f7" } : {}), fontSize: 16, textAlign: "center", letterSpacing: "0.1em" }}
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="••••••••••"
            autoFocus
          />
          {pwError && (
            <div style={{ color: "#ef4444", fontSize: 13, marginTop: 6, textAlign: "center" }}>
              ❌ Falsches Passwort – bitte nochmal versuchen
            </div>
          )}
        </div>
        <button
          style={{ ...styles.btn, ...styles.btnPrimary, width: "100%", fontSize: 16, padding: "12px" }}
          onClick={handleLogin}
        >
          🔓 Anmelden
        </button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={toggleDark} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }} title="Dark/Light Mode">
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </div>
  );

  const showToast = (msg, color = "#10b981") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  const openNew = () => { setForm({ ...emptyForm, id: Date.now() }); setView("form"); setSelected(null); };
  const openEdit = (w) => { setForm({ ...w }); setSelected(w.id); setView("form"); };
  const openDetail = (w) => { setSelected(w.id); setView("detail"); };

  const saveForm = async () => {
    setSaving(true);
    try {
      await dbUpsert(form);
      const exists = weddings.find(w => w.id === form.id);
      const updated = exists ? weddings.map(w => w.id === form.id ? form : w) : [...weddings, form];
      setWeddings(updated);
      setView("list");
      showToast("✅ Gespeichert & synchronisiert!");
    } catch (err) {
      showToast("❌ Fehler beim Speichern: " + err.message, "#ef4444");
    }
    setSaving(false);
  };

  const deleteWedding = async (id) => {
    if (!confirm("Hochzeit wirklich löschen?")) return;
    try {
      await dbDelete(id);
      setWeddings(weddings.filter(w => w.id !== id));
      setView("list");
      showToast("🗑 Gelöscht", "#ef4444");
    } catch (err) {
      showToast("❌ Fehler beim Löschen: " + err.message, "#ef4444");
    }
  };

  const reload = async () => {
    setLoading(true);
    setSyncError(null);
    try {
      const data = await dbGetAll();
      setWeddings(data);
      showToast("🔄 Daten aktualisiert!");
    } catch (err) {
      setSyncError("Sync fehlgeschlagen: " + err.message);
    }
    setLoading(false);
  };

  const filtered = weddings
    .filter(w => {
      const q = search.toLowerCase();
      return w.partner1?.toLowerCase().includes(q) || w.partner2?.toLowerCase().includes(q) || w.hochzeitsDatum?.includes(q);
    })
    .sort((a, b) => sortBy === "datum"
      ? (a.hochzeitsDatum || "").localeCompare(b.hochzeitsDatum || "")
      : (a.partner1 || "").localeCompare(b.partner1 || ""));

  const upcoming = weddings
    .filter(w => w.hochzeitsDatum && daysUntil(w.hochzeitsDatum) >= 0 && w.status !== "Storniert")
    .sort((a, b) => a.hochzeitsDatum.localeCompare(b.hochzeitsDatum));

  const detailWedding = weddings.find(w => w.id === selected);

  const field = (label, key, type = "text", opts = {}) => (
    <div style={styles.fieldGroup}>
      {label ? <label style={styles.label}>{label}</label> : null}
      {type === "textarea" ? (
        <textarea style={{ ...styles.input, minHeight: 80, resize: "vertical" }} value={form[key] || ""}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={opts.placeholder || ""} />
      ) : type === "select" ? (
        <select style={styles.input} value={form[key] || ""}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
          {opts.options.map(o => <option key={o.val ?? o} value={o.val ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : type === "checkbox" ? (
        <div style={styles.checkRow}>
          <input type="checkbox" id={key} checked={!!form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} style={styles.checkbox} />
          <label htmlFor={key} style={styles.checkLabel}>{opts.checkLabel}</label>
        </div>
      ) : (
        <input style={styles.input} type={type} value={form[key] || ""}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={opts.placeholder || ""} />
      )}
    </div>
  );

  // ── FORM VIEW ────────────────────────────────────────────
  if (view === "form") {
    const preisGesamt = calcPreis(form);
    return (
      <div style={{ ...styles.page, ...(dark ? darkStyles.page : {}) }}>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
        <div style={{ ...styles.header, ...(dark ? darkStyles.header : {}) }}>
          <div style={styles.headerLeft}>
            <button style={{ ...styles.backBtn, ...(dark ? darkStyles.backBtn : {}) }} onClick={() => setView("list")}>← Zurück</button>
            <ZenithLogo compact dark={dark} />
          </div>
          <button style={{ ...styles.btn, ...styles.btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={saveForm} disabled={saving}>
            {saving ? "⏳ Speichern…" : "☁️ Speichern"}
          </button>
        </div>

        <div style={styles.formBody}>
          <Section title="📋 Erstgespräch">
            <div style={styles.row2}>
              {field("Datum Erstgespräch", "erstgespraechDatum", "date")}
              {field("Adresse / Ort", "erstgespraechAdresse", "text", { placeholder: "z.B. online, Café…" })}
            </div>
          </Section>

          <Section title="💑 Das Brautpaar">
            <div style={styles.row2}>
              {field("Partner/in 1", "partner1", "text", { placeholder: "Vorname Nachname" })}
              {field("Partner/in 2", "partner2", "text", { placeholder: "Vorname Nachname" })}
            </div>
            {field("Adresse", "adresse", "text", { placeholder: "Straße, PLZ Ort" })}
            <div style={styles.row2}>
              {field("Telefon", "telefon", "tel", { placeholder: "+49 …" })}
              {field("E-Mail", "email", "email", { placeholder: "name@example.de" })}
            </div>
          </Section>

          <Section title="💒 Hochzeitstag">
            <div style={styles.row2}>
              {field("Datum der Hochzeit", "hochzeitsDatum", "date")}
              {field("Uhrzeit (Trauung)", "hochzeitsUhrzeit", "time")}
            </div>
            {field("Art der Trauung", "trauungArt", "select", {
              options: ["","Standesamtliche Trauung","Kirchliche Trauung","Freie Trauung","Standesamtlich + Frei","Standesamtlich + Kirchlich"]
            })}
            <div style={styles.row2}>
              {field("Adresse Trauung", "trauungAdresse", "text", { placeholder: "Standesamt / Kirche / Location" })}
              {field("Adresse Feier", "feierAdresse", "text", { placeholder: "Scheune, Schloss, Restaurant…" })}
            </div>
            {field("Anzahl Gäste", "gaeste", "number", { placeholder: "z.B. 100" })}
          </Section>

          <Section title="💰 Paket & Preis">
            <label style={styles.label}>Fotopaket wählen</label>
            <div style={styles.paketGrid}>
              {PAKETE.map(p => (
                <button key={p.label}
                  style={{ ...styles.paketBtn, ...(form.paket === p.label ? styles.paketBtnActive : {}) }}
                  onClick={() => setForm(f => ({ ...f, paket: f.paket === p.label ? "" : p.label, individualPreis: "" }))}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</span>
                  <span style={{ fontSize: 13, color: form.paket === p.label ? "#fff" : "#64748b" }}>{formatEuro(p.preis)}</span>
                </button>
              ))}
            </div>

            {/* Individueller Preis */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Individueller Preis (z.B. Freundschaftspreis)</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...styles.input, paddingLeft: 28 }}
                  type="number"
                  value={form.individualPreis || ""}
                  onChange={e => setForm(f => ({ ...f, individualPreis: e.target.value, paket: "" }))}
                  placeholder="z.B. 1200"
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>€</span>
              </div>
              {form.paket && form.individualPreis && (
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>⚠️ Paket wird ignoriert wenn individueller Preis gesetzt ist</div>
              )}
            </div>

            {calcPreis(form) > 0 && (
              <div style={styles.preisBox}>
                <div style={{ fontSize: 12, color: "#166534", marginBottom: 2 }}>Gesamtpreis (kalkuliert)</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#14532d" }}>{formatEuro(calcPreis(form))}</div>
                {form.paket && !form.individualPreis && <div style={styles.preisLine}>📷 Foto {form.paket}: {formatEuro(PAKETE.find(p=>p.label===form.paket)?.preis)}</div>}
                {form.individualPreis && <div style={styles.preisLine}>📷 Individueller Preis: {formatEuro(parseFloat(form.individualPreis))}</div>}
                {form.fotobox && <div style={styles.preisLine}>📦 Fotobox: {formatEuro(250)}</div>}
                {(form.videoArt === "zusammenfassung" || form.videoArt === "trauung") && <div style={styles.preisLine}>🎬 Video-Add-on: {formatEuro(990)}</div>}
                {form.videoArt === "nurVideo" && form.videoStunden && <div style={styles.preisLine}>🎬 Nur Video ({form.videoStunden} Std.): {formatEuro(parseFloat(form.videoStunden)*350)}</div>}
              </div>
            )}

            {/* Angebot & Anzahlung */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={styles.checkRow}>
                <input type="checkbox" id="angebotGewuenscht" checked={!!form.angebotGewuenscht}
                  onChange={e => setForm(f => ({ ...f, angebotGewuenscht: e.target.checked }))} style={styles.checkbox} />
                <label htmlFor="angebotGewuenscht" style={styles.checkLabel}>📄 Schriftliches Angebot gewünscht</label>
              </div>
              <div style={styles.checkRow}>
                <input type="checkbox" id="anzahlungVereinbart" checked={!!form.anzahlungVereinbart}
                  onChange={e => setForm(f => ({ ...f, anzahlungVereinbart: e.target.checked }))} style={styles.checkbox} />
                <label htmlFor="anzahlungVereinbart" style={styles.checkLabel}>💶 Anzahlung vereinbart</label>
              </div>
              {form.anzahlungVereinbart && (
                <div style={{ paddingLeft: 24 }}>
                  {field("Anzahlungsbetrag", "anzahlungBetrag", "number", { placeholder: "z.B. 500" })}
                </div>
              )}
            </div>
          </Section>

          <Section title="📦 Leistungen / Extras">
            <div style={styles.checkGrid}>
              {field("", "gettingReady", "checkbox", { checkLabel: "Getting Ready" })}
              {field("", "fotobuch", "checkbox", { checkLabel: "Fotobuch" })}
              {field("", "fotobox", "checkbox", { checkLabel: "Fotobox" })}
              {field("", "drohne", "checkbox", { checkLabel: "🚁 Drohnenfotos / Gruppenfotos" })}
            </div>
            {form.fotobox && field("Fotobox Details", "fotoboxDetails", "text", { placeholder: "z.B. als USB teilhaben" })}
          </Section>

          <Section title="🎬 Video">
            <label style={styles.label}>Videowunsch</label>
            <div style={styles.videoOptList}>
              {[
                { val: "", label: "Kein Video" },
                { val: "zusammenfassung", label: "Zusammenfassung des ganzen Tages", sub: "+ 990 € zur Fotoreportage" },
                { val: "trauung", label: "Gesamte Trauung (Langvideo)", sub: "+ 990 € zur Fotoreportage" },
                { val: "nurVideo", label: "Nur Video (ohne Fotoproduktion)", sub: "350 € / Std. inkl. Videoschnitt" },
              ].map(opt => (
                <button key={opt.val}
                  style={{ ...styles.videoOptBtn, ...(form.videoArt === opt.val ? styles.videoOptBtnActive : {}) }}
                  onClick={() => setForm(f => ({ ...f, videoArt: opt.val, videoStunden: "" }))}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${form.videoArt === opt.val ? "#fff" : "#cbd5e1"}`, background: form.videoArt === opt.val ? "#fff" : "transparent", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                      {opt.sub && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{opt.sub}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {form.videoArt === "nurVideo" && (
              <div style={{ marginTop: 10 }}>
                {field("Stunden vor Ort", "videoStunden", "number", { placeholder: "z.B. 4" })}
                {form.videoStunden && <div style={{ fontSize: 13, color: "#64748b", marginTop: -6 }}>= {formatEuro(parseFloat(form.videoStunden)*350)} inkl. Videoschnitt</div>}
              </div>
            )}
          </Section>

          <Section title="📝 Notizen">
            {field("Status", "status", "select", { options: ["Anfrage","Gebucht","Abgeschlossen","Storniert"] })}
            {field("Notizen", "notizen", "textarea", { placeholder: "Besondere Wünsche, Vereinbarungen, Infos…" })}
          </Section>

          <Section title="📸 Foto des Brautpaars">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {form.foto ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={form.foto}
                    alt="Brautpaar"
                    style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 16, border: `3px solid ${dark ? "#3a3a3c" : "#e2e8f0"}` }}
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, foto: "" }))}
                    style={{ position: "absolute", top: -8, right: -8, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >✕</button>
                </div>
              ) : (
                <label style={{
                  width: 160, height: 160, borderRadius: 16,
                  border: `2px dashed ${dark ? "#48484a" : "#cbd5e1"}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", gap: 8, color: dark ? "#636366" : "#94a3b8",
                }}>
                  <span style={{ fontSize: 36 }}>📷</span>
                  <span style={{ fontSize: 12, textAlign: "center" }}>Foto hochladen</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          const max = 400;
                          let w = img.width, h = img.height;
                          if (w > h) { h = Math.round(h * max / w); w = max; }
                          else { w = Math.round(w * max / h); h = max; }
                          canvas.width = w; canvas.height = h;
                          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                          setForm(f => ({ ...f, foto: canvas.toDataURL("image/jpeg", 0.7) }));
                        };
                        img.src = ev.target.result;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
              <p style={{ fontSize: 12, color: dark ? "#636366" : "#94a3b8", textAlign: "center", margin: 0 }}>
                Wird direkt in der Datenbank gespeichert
              </p>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────
  if (view === "detail" && detailWedding) {
    const w = detailWedding;
    const days = daysUntil(w.hochzeitsDatum);
    const preisGesamt = calcPreis(w);
    const leistungen = [
      w.gettingReady && "Getting Ready",
      w.fotobuch && "Fotobuch",
      w.fotobox && `Fotobox${w.fotoboxDetails ? `: ${w.fotoboxDetails}` : ""}`,
      w.drohne && "🚁 Drohnenfotos",
    ].filter(Boolean);
    const videoLabel = { zusammenfassung: "Zusammenfassung des ganzen Tages", trauung: "Gesamte Trauung (Langvideo)", nurVideo: `Nur Video${w.videoStunden ? ` · ${w.videoStunden} Std.` : ""}` }[w.videoArt] || null;

    return (
      <div style={styles.page}>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button style={styles.backBtn} onClick={() => setView("list")}>← Zurück</button>
            <ZenithLogo compact />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => openEdit(w)}>✏️</button>
            <button style={{ ...styles.btn, background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5" }} onClick={() => deleteWedding(w.id)}>🗑</button>
          </div>
        </div>

        <div style={styles.formBody}>
          {w.hochzeitsDatum && (
            <div style={{ ...styles.card, background: days !== null && days < 14 ? "linear-gradient(135deg,#fef3c7,#fde68a)" : "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderColor: days !== null && days < 14 ? "#f59e0b" : "#10b981" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>Hochzeitstag</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif" }}>{formatDate(w.hochzeitsDatum)} {w.hochzeitsUhrzeit && `· ${w.hochzeitsUhrzeit} Uhr`}</div>
                </div>
                {days !== null && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: days < 14 ? "#b45309" : "#15803d" }}>{days}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{days === 1 ? "Tag" : "Tage"} noch</div>
                  </div>
                )}
              </div>
              <CalendarButtons wedding={w} />
            </div>
          )}

          {(preisGesamt > 0 || w.angebotGewuenscht || w.anzahlungVereinbart) && (
            <div style={{ ...styles.card, background: "linear-gradient(135deg,#1e293b,#334155)", borderColor: "#1e293b" }}>
              {preisGesamt > 0 && (
                <>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Gesamtpreis</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{formatEuro(preisGesamt)}</div>
                  {w.paket && !w.individualPreis && <div style={{ fontSize: 13, color: "#cbd5e1" }}>📷 Foto {w.paket}: {formatEuro(PAKETE.find(p=>p.label===w.paket)?.preis)}</div>}
                  {w.individualPreis && <div style={{ fontSize: 13, color: "#cbd5e1" }}>📷 Individueller Preis: {formatEuro(parseFloat(w.individualPreis))}</div>}
                  {w.fotobox && <div style={{ fontSize: 13, color: "#cbd5e1" }}>📦 Fotobox: {formatEuro(250)}</div>}
                  {(w.videoArt === "zusammenfassung" || w.videoArt === "trauung") && <div style={{ fontSize: 13, color: "#cbd5e1" }}>🎬 Video-Add-on: {formatEuro(990)}</div>}
                  {w.videoArt === "nurVideo" && w.videoStunden && <div style={{ fontSize: 13, color: "#cbd5e1" }}>🎬 Nur Video ({w.videoStunden} Std.): {formatEuro(parseFloat(w.videoStunden)*350)}</div>}
                </>
              )}
              {(w.angebotGewuenscht || w.anzahlungVereinbart) && (
                <div style={{ marginTop: preisGesamt > 0 ? 12 : 0, paddingTop: preisGesamt > 0 ? 12 : 0, borderTop: preisGesamt > 0 ? "1px solid #475569" : "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {w.angebotGewuenscht && (
                    <div style={{ fontSize: 13, color: "#fde68a", display: "flex", alignItems: "center", gap: 6 }}>
                      📄 Schriftliches Angebot gewünscht
                    </div>
                  )}
                  {w.anzahlungVereinbart && (
                    <div style={{ fontSize: 13, color: "#86efac", display: "flex", alignItems: "center", gap: 6 }}>
                      💶 Anzahlung vereinbart{w.anzahlungBetrag ? `: ${formatEuro(parseFloat(w.anzahlungBetrag))}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DetailCard title="💑 Brautpaar" dark={dark}>
            {w.foto && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <img src={w.foto} alt="Brautpaar" style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 14, border: `3px solid ${dark ? "#3a3a3c" : "#e2e8f0"}` }} />
              </div>
            )}
            <DetailRow label="Partner 1" val={w.partner1} dark={dark} />
            <DetailRow label="Partner 2" val={w.partner2} dark={dark} />
            <DetailRow label="Adresse" val={w.adresse} dark={dark} />
            <DetailRow label="Telefon" val={w.telefon} dark={dark} />
            <DetailRow label="E-Mail" val={w.email} dark={dark} />
          </DetailCard>

          <DetailCard title="💒 Hochzeitstag">
            <DetailRow label="Datum" val={formatDate(w.hochzeitsDatum)} />
            <DetailRow label="Uhrzeit" val={w.hochzeitsUhrzeit ? `${w.hochzeitsUhrzeit} Uhr` : null} />
            <DetailRow label="Trauung" val={w.trauungArt} />
            <DetailRow label="Ort Trauung" val={w.trauungAdresse} />
            <DetailRow label="Ort Feier" val={w.feierAdresse} />
            <DetailRow label="Gäste" val={w.gaeste ? `ca. ${w.gaeste} Gäste` : null} />
          </DetailCard>

          <DetailCard title="📦 Leistungen & Video">
            {leistungen.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: videoLabel ? 10 : 0 }}>{leistungen.map(tag => <span key={tag} style={styles.tag}>{tag}</span>)}</div>}
            {videoLabel && <span style={{ ...styles.tag, background: "#fdf4ff", color: "#7c3aed", borderColor: "#e9d5ff" }}>🎬 {videoLabel}</span>}
            {leistungen.length === 0 && !videoLabel && <span style={{ color: "#94a3b8" }}>Keine Zusatzleistungen</span>}
          </DetailCard>

          {w.notizen && <DetailCard title="📝 Notizen" dark={dark}><p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, color: dark ? "#f2f2f7" : "#1e293b" }}>{w.notizen}</p></DetailCard>}

          <MailButtons w={w} dark={dark} />

          <DetailCard title="📋 Erstgespräch" dark={dark}>
            <DetailRow label="Datum" val={formatDate(w.erstgespraechDatum)} dark={dark} />
            <DetailRow label="Ort" val={w.erstgespraechAdresse} dark={dark} />
          </DetailCard>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────
  const booked = weddings.filter(w => w.status === "Gebucht").length;
  const thisYear = weddings.filter(w => w.hochzeitsDatum?.startsWith(new Date().getFullYear().toString())).length;
  const nextWedding = upcoming[0];
  const umsatzGesamt = weddings
    .filter(w => w.status !== "Storniert")
    .reduce((sum, w) => sum + calcPreis(w), 0);

  return (
    <div style={{ ...styles.page, ...(dark ? darkStyles.page : {}) }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      <div style={{ ...styles.header, ...(dark ? darkStyles.header : {}) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <ZenithLogo dark={dark} />
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ width: 32, height: 32, borderRadius: 9, border: "none", fontSize: 14, cursor: "pointer", background: dark ? "#3a3a3c" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={toggleDark} title="Dark/Light Mode">{dark ? "☀️" : "🌙"}</button>
            <button style={{ width: 32, height: 32, borderRadius: 9, border: "none", fontSize: 14, cursor: "pointer", background: dark ? "#3a3a3c" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={reload} title="Aktualisieren">{loading ? "⏳" : "🔄"}</button>
            <button style={{ width: 32, height: 32, borderRadius: 9, border: "none", fontSize: 14, cursor: "pointer", background: dark ? "#3a3a3c" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={handleLogout} title="Abmelden">🔒</button>
          </div>
        </div>
        <button style={{ ...styles.btn, background: "#F7A800", color: "#1c1c1e", width: "100%", fontSize: 15, fontWeight: 700, borderRadius: 12 }} onClick={openNew}>+ Neue Hochzeit anlegen</button>
      </div>

      {syncError && (
        <div style={styles.errorBanner}>
          ⚠️ {syncError}
          <button style={{ marginLeft: 10, fontSize: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", textDecoration: "underline" }} onClick={reload}>Erneut versuchen</button>
        </div>
      )}

      <div style={{ padding: "8px 20px 0" }}>
        <div style={{ ...styles.syncBadge, ...(dark ? darkStyles.syncBadge : {}) }}>☁️ Echtzeit-Sync · alle Geräte</div>
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Gesamt" val={loading ? "…" : weddings.length} icon="💍" dark={dark} />
        <StatCard label="Gebucht" val={loading ? "…" : booked} icon="✅" dark={dark} />
        <StatCard label={`${new Date().getFullYear()}`} val={loading ? "…" : thisYear} icon="📅" dark={dark} />
        {nextWedding ? (
          <StatCard label="Nächste Hochzeit" val={`in ${daysUntil(nextWedding.hochzeitsDatum)} Tagen`} sub={`${nextWedding.partner1} & ${nextWedding.partner2}`} icon="💒" dark={dark} />
        ) : (
          <StatCard label="Keine anstehend" val="—" icon="💒" dark={dark} />
        )}
      </div>

      {/* Umsatz Banner */}
      {!loading && umsatzGesamt > 0 && (
        <div style={{ ...styles.umsatzBanner, ...(dark ? darkStyles.umsatzBanner : {}) }}>
          <div style={{ fontSize: 12, color: "#30d158", marginBottom: 2 }}>📊 Gesamtumsatz (alle aktiven Hochzeiten)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: dark ? "#f2f2f7" : "#fff" }}>{formatEuro(umsatzGesamt)}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {weddings.filter(w => w.status !== "Storniert" && calcPreis(w) > 0).length} Hochzeiten mit Preisangabe
          </div>
        </div>
      )}

      <div style={styles.toolbar}>
        <input style={{ ...styles.input, flex: 1, marginBottom: 0 }} placeholder="🔍 Name oder Datum suchen…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...styles.input, width: "auto", marginBottom: 0 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="datum">Nach Datum</option>
          <option value="name">Nach Name</option>
        </select>
      </div>

      {loading ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ color: "#64748b" }}>Daten werden geladen…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💍</div>
          <div style={{ fontWeight: 600, color: "#64748b" }}>Noch keine Hochzeiten angelegt</div>
          <div style={{ color: "#94a3b8", marginTop: 4, fontSize: 13 }}>Klicke auf „+ Neu" um zu starten</div>
        </div>
      ) : (
        <div style={styles.cardList}>
          {filtered.map(w => {
            const days = daysUntil(w.hochzeitsDatum);
            const isUpcoming = days !== null && days >= 0 && w.status !== "Storniert";
            const preis = calcPreis(w);
            return (
              <div key={w.id} style={{ ...styles.card, ...(dark ? darkStyles.card : {}), cursor: "pointer" }} onClick={() => openDetail(w)}>
                <div style={styles.cardTop}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                    {w.foto && (
                      <img src={w.foto} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `2px solid ${dark ? "#3a3a3c" : "#e2e8f0"}` }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ ...styles.cardNames, ...(dark ? darkStyles.cardNames : {}) }}>{w.partner1 || "Partner 1"} & {w.partner2 || "Partner 2"}</div>
                      <div style={{ ...styles.cardDate, ...(dark ? darkStyles.cardDate : {}) }}>{formatDate(w.hochzeitsDatum)}{w.hochzeitsUhrzeit ? ` · ${w.hochzeitsUhrzeit} Uhr` : ""}</div>
                      {w.feierAdresse && <div style={{ ...styles.cardLocation, ...(dark ? darkStyles.cardLocation : {}) }}>📍 {w.feierAdresse}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ ...styles.badge, background: STATUS_COLORS[w.status] + "22", color: STATUS_COLORS[w.status], borderColor: STATUS_COLORS[w.status] + "55" }}>{w.status}</span>
                    {isUpcoming && days !== null && <span style={{ ...styles.badge, background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>{days === 0 ? "Heute! 🎉" : `noch ${days}d`}</span>}
                    {preis > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "#f2f2f7" : "#1e293b" }}>{formatEuro(preis)}</span>}
                  </div>
                </div>
                {(w.gettingReady || w.fotobuch || w.fotobox || w.drohne || w.videoArt) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {w.gettingReady && <span style={styles.tagSmall}>Getting Ready</span>}
                    {w.fotobuch && <span style={styles.tagSmall}>Fotobuch</span>}
                    {w.fotobox && <span style={styles.tagSmall}>Fotobox</span>}
                    {w.drohne && <span style={styles.tagSmall}>🚁 Drohne</span>}
                    {w.videoArt === "zusammenfassung" && <span style={{ ...styles.tagSmall, color: "#7c3aed" }}>🎬 Zusammenfassung</span>}
                    {w.videoArt === "trauung" && <span style={{ ...styles.tagSmall, color: "#7c3aed" }}>🎬 Trauungsvideo</span>}
                    {w.videoArt === "nurVideo" && <span style={{ ...styles.tagSmall, color: "#7c3aed" }}>🎬 Nur Video</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MailButtons({ w, dark }) {
  const preis = calcPreis(w);

  const buildMailto = (type) => {
    const isAnzahlung = type === "anzahlung";
    const anzahlung = w.anzahlungBetrag ? parseFloat(w.anzahlungBetrag) : null;

    const subject = isAnzahlung
      ? `Anzahlungsrechnung – Hochzeit ${w.partner1} & ${w.partner2} am ${formatDate(w.hochzeitsDatum)}`
      : `Angebotsanfrage – Hochzeit ${w.partner1} & ${w.partner2} am ${formatDate(w.hochzeitsDatum)}`;

    const lines = isAnzahlung ? [
      `Hallo,`,
      ``,
      `bitte eine Anzahlungsrechnung für folgende Hochzeit erstellen:`,
      ``,
      `── BRAUTPAAR ──────────────────────`,
      `Partner 1:     ${w.partner1 || "–"}`,
      `Partner 2:     ${w.partner2 || "–"}`,
      `Adresse:       ${w.adresse || "–"}`,
      `Telefon:       ${w.telefon || "–"}`,
      `E-Mail:        ${w.email || "–"}`,
      ``,
      `── HOCHZEIT ───────────────────────`,
      `Datum:         ${formatDate(w.hochzeitsDatum)}${w.hochzeitsUhrzeit ? ` · ${w.hochzeitsUhrzeit} Uhr` : ""}`,
      `Paket:         ${w.paket || (w.individualPreis ? `Individuell: ${formatEuro(parseFloat(w.individualPreis))}` : "–")}`,
      ``,
      `── RECHNUNG ───────────────────────`,
      `Gesamtpreis:   ${preis > 0 ? formatEuro(preis) : "–"}`,
      `Anzahlung:     ${anzahlung ? formatEuro(anzahlung) : "Betrag vereinbart – bitte erfragen"}`,
      `Restbetrag:    ${anzahlung && preis ? formatEuro(preis - anzahlung) : "–"}`,
      ``,
      w.notizen ? `── NOTIZEN ────────────────────────\n${w.notizen}\n` : null,
      `Bitte Anzahlungsrechnung zeitnah erstellen und an den Kunden senden.`,
      ``,
      `Viele Grüße`,
      `Philipp Nolte`,
    ] : [
      `Hallo,`,
      ``,
      `bitte ein Angebot für folgende Hochzeit erstellen:`,
      ``,
      `── BRAUTPAAR ──────────────────────`,
      `Partner 1:     ${w.partner1 || "–"}`,
      `Partner 2:     ${w.partner2 || "–"}`,
      `Adresse:       ${w.adresse || "–"}`,
      `Telefon:       ${w.telefon || "–"}`,
      `E-Mail:        ${w.email || "–"}`,
      ``,
      `── HOCHZEIT ───────────────────────`,
      `Datum:         ${formatDate(w.hochzeitsDatum)}${w.hochzeitsUhrzeit ? ` · ${w.hochzeitsUhrzeit} Uhr` : ""}`,
      `Trauung:       ${w.trauungArt || "–"}`,
      `Ort Trauung:   ${w.trauungAdresse || "–"}`,
      `Ort Feier:     ${w.feierAdresse || "–"}`,
      `Gäste:         ${w.gaeste ? `ca. ${w.gaeste}` : "–"}`,
      ``,
      `── LEISTUNGEN ─────────────────────`,
      `Paket:         ${w.paket || (w.individualPreis ? `Individuell: ${formatEuro(parseFloat(w.individualPreis))}` : "–")}`,
      w.gettingReady ? `Getting Ready: Ja` : null,
      w.fotobuch ? `Fotobuch:      Ja` : null,
      w.fotobox ? `Fotobox:       Ja${w.fotoboxDetails ? ` (${w.fotoboxDetails})` : ""}` : null,
      w.drohne ? `Drohne:        Ja` : null,
      w.videoArt ? `Video:         ${w.videoArt === "zusammenfassung" ? "Zusammenfassung des ganzen Tages" : w.videoArt === "trauung" ? "Gesamte Trauung (Langvideo)" : `Nur Video (${w.videoStunden} Std.)`}` : null,
      ``,
      `── PREIS ──────────────────────────`,
      `Gesamtpreis:   ${preis > 0 ? formatEuro(preis) : "Noch nicht festgelegt"}`,
      ``,
      w.notizen ? `── NOTIZEN ────────────────────────\n${w.notizen}\n` : null,
      `Bitte Angebot zeitnah erstellen und an den Kunden senden.`,
      ``,
      `Viele Grüße`,
      `Philipp Nolte`,
    ];

    const body = lines.filter(l => l !== null).join("\n");
    return `mailto:buchhaltung@zenith-agentur.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div style={{ ...styles.card, ...(dark ? darkStyles.card : {}) }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15, color: dark ? "#f2f2f7" : "#1e293b" }}>📧 Buchhaltung benachrichtigen</div>
      <p style={{ fontSize: 12, color: dark ? "#636366" : "#94a3b8", marginBottom: 12, lineHeight: 1.5 }}>
        Öffnet deine Mail-App mit allen Infos vorausgefüllt – du tippst nur noch auf „Senden".
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Angebot */}
        <a href={buildMailto("angebot")} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          borderRadius: 12, textDecoration: "none",
          background: dark ? "#052e16" : "#f0fdf4",
          border: `1px solid ${dark ? "#166534" : "#86efac"}`,
        }}>
          <span style={{ fontSize: 24 }}>📄</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: dark ? "#4ade80" : "#166534" }}>Angebot anfordern</div>
            <div style={{ fontSize: 11, color: dark ? "#16a34a" : "#4ade80", marginTop: 1 }}>buchhaltung@zenith-agentur.de</div>
          </div>
        </a>

        {/* Anzahlung */}
        {w.anzahlungVereinbart ? (
          <a href={buildMailto("anzahlung")} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 12, textDecoration: "none",
            background: dark ? "#0c1a2e" : "#eff6ff",
            border: `1px solid ${dark ? "#1d4ed8" : "#93c5fd"}`,
          }}>
            <span style={{ fontSize: 24 }}>💶</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: dark ? "#60a5fa" : "#1d4ed8" }}>Anzahlungsrechnung anfordern</div>
              <div style={{ fontSize: 11, color: dark ? "#3b82f6" : "#60a5fa", marginTop: 1 }}>
                {w.anzahlungBetrag ? `${formatEuro(parseFloat(w.anzahlungBetrag))} vereinbart · ` : ""}buchhaltung@zenith-agentur.de
              </div>
            </div>
          </a>
        ) : (
          <div style={{ fontSize: 12, color: dark ? "#48484a" : "#cbd5e1", padding: "8px 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <span>💶</span> Keine Anzahlung vereinbart – im Formular aktivierbar
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarButtons({ wedding: w }) {
  // Build start/end datetime strings
  const date = w.hochzeitsDatum; // "YYYY-MM-DD"
  const time = w.hochzeitsUhrzeit || "10:00";
  const [hh, mm] = time.split(":").map(Number);

  // ICS date format: YYYYMMDDTHHMMSS
  const pad = n => String(n).padStart(2, "0");
  const dateStr = date.replace(/-/g, "");
  const startTime = `${dateStr}T${pad(hh)}${pad(mm)}00`;
  // End = start + 10 hours (full wedding day)
  const endHh = (hh + 10) % 24;
  const endStr = `${dateStr}T${pad(endHh)}${pad(mm)}00`;

  const title = encodeURIComponent(`Hochzeit ${w.partner1} & ${w.partner2}`);
  const location = encodeURIComponent(w.feierAdresse || w.trauungAdresse || "");
  const details = encodeURIComponent(
    [
      w.trauungArt && `Trauung: ${w.trauungArt}`,
      w.trauungAdresse && `Ort Trauung: ${w.trauungAdresse}`,
      w.feierAdresse && `Ort Feier: ${w.feierAdresse}`,
      w.gaeste && `Gäste: ca. ${w.gaeste}`,
      w.paket && `Paket: ${w.paket}`,
      w.notizen && `Notizen: ${w.notizen}`,
    ].filter(Boolean).join("\n")
  );

  // Google Calendar URL
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endStr}&location=${location}&details=${details}`;

  // ICS file (Apple Kalender / Outlook)
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZENITH Hochzeiten//DE",
    "BEGIN:VEVENT",
    `DTSTART:${startTime}`,
    `DTEND:${endStr}`,
    `SUMMARY:Hochzeit ${w.partner1} & ${w.partner2}`,
    `LOCATION:${(w.feierAdresse || w.trauungAdresse || "").replace(/,/g, "\\,")}`,
    `DESCRIPTION:${[
      w.trauungArt && `Trauung: ${w.trauungArt}`,
      w.trauungAdresse && `Ort Trauung: ${w.trauungAdresse}`,
      w.feierAdresse && `Ort Feier: ${w.feierAdresse}`,
      w.gaeste && `Gäste: ca. ${w.gaeste}`,
      w.paket && `Paket: ${w.paket}`,
    ].filter(Boolean).join("\\n")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const downloadIcs = () => {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hochzeit-${w.partner1}-${w.partner2}.ics`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={downloadIcs}
        style={calBtnStyle("#1e293b")}
        title="Apple Kalender / Outlook"
      >
        📅 Apple & Outlook
      </button>
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...calBtnStyle("#4285F4"), textDecoration: "none" }}
      >
        🗓 Google Kalender
      </a>
    </div>
  );
}

function calBtnStyle(bg) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 10, border: "none",
    background: bg, color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

const LOGO_SRC = "data:image/webp;base64,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";

function ZenithLogo({ compact = false, dark = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <img
        src={LOGO_SRC}
        alt="ZENITH"
        style={{
          height: compact ? 22 : 30,
          width: "auto",
          objectFit: "contain",
          filter: dark ? "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(5deg) brightness(1.2)" : "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ height: 1, width: compact ? 16 : 20, background: dark ? "#3a3a3c" : "#e2e8f0" }} />
        <span style={{
          fontSize: compact ? 9 : 10,
          color: dark ? "#636366" : "#3d5166",
          fontFamily: "sans-serif",
          letterSpacing: "0.04em",
        }}>
          Philipp Nolte · <strong style={{ color: dark ? "#8e8e93" : "#3d5166" }}>dk group</strong>
        </span>
      </div>
    </div>
  );
}

function Toast({ msg, color }) {
  return <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: color, color: "#fff", padding: "10px 20px", borderRadius: 30, fontWeight: 600, fontSize: 13, zIndex: 999, boxShadow: "0 4px 20px #0003", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>{msg}</div>;
}
function Section({ title, children, dark = false }) {
  return <div style={{ ...styles.section, ...(dark ? darkStyles.section : {}) }}><div style={{ ...styles.sectionTitle, ...(dark ? darkStyles.sectionTitle : {}) }}>{title}</div>{children}</div>;
}
function DetailCard({ title, children, dark = false }) {
  return <div style={{ ...styles.card, ...(dark ? darkStyles.card : {}) }}><div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15, color: dark ? '#f2f2f7' : '#1e293b' }}>{title}</div>{children}</div>;
}
function DetailRow({ label, val, dark = false }) {
  if (!val) return null;
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 14 }}>
      <span style={{ color: dark ? "#636366" : "#94a3b8", minWidth: 120 }}>{label}</span>
      <span style={{ color: dark ? "#f2f2f7" : "#1e293b", fontWeight: 500 }}>{val}</span>
    </div>
  );
}
function StatCard({ label, val, sub, icon, dark = false }) {
  return (
    <div style={{ ...styles.statCard, ...(dark ? darkStyles.statCard : {}) }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: dark ? "#f2f2f7" : "#1e293b" }}>{val}</div>
      <div style={{ fontSize: 12, color: dark ? "#8e8e93" : "#64748b", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: dark ? "#636366" : "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}


const darkStyles = {
  page: { background: "#1c1c1e" },
  header: { background: "#2c2c2e", borderBottomColor: "#3a3a3c" },
  card: { background: "#2c2c2e", borderColor: "#3a3a3c" },
  section: { background: "#2c2c2e", borderColor: "#3a3a3c" },
  statCard: { background: "#2c2c2e", borderColor: "#3a3a3c" },
  input: { background: "#3a3a3c", borderColor: "#48484a", color: "#f2f2f7" },
  label: { color: "#8e8e93" },
  sectionTitle: { color: "#f2f2f7", borderBottomColor: "#3a3a3c" },
  cardNames: { color: "#f2f2f7" },
  cardDate: { color: "#8e8e93" },
  cardLocation: { color: "#636366" },
  checkLabel: { color: "#f2f2f7" },
  backBtn: { color: "#8e8e93" },
  btnOutline: { background: "#3a3a3c", color: "#f2f2f7", border: "1px solid #48484a" },
  syncBadge: { background: "rgba(48,209,88,0.12)", borderColor: "rgba(48,209,88,0.3)", color: "#30d158" },
  umsatzBanner: { background: "#2c2c2e", borderColor: "#3a3a3c" },
  toolbar: {},
  empty: { color: "#636366" },
};

function ds(dark, key, styles) {
  return dark ? { ...styles[key], ...(darkStyles[key] || {}) } : styles[key];
}

const styles = {
  page: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "0 0 40px", maxWidth: 680, margin: "0 auto" },
  loginPage: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  loginCard: { background: "#fff", borderRadius: 20, padding: "32px 28px", border: "1px solid #e2e8f0", width: "100%", maxWidth: 360, boxShadow: "0 8px 40px #0001" },
  header: { display: "flex", flexDirection: "column", padding: "14px 20px 12px", background: "#fff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { margin: 0, fontSize: 20, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.5px" },
  pageTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" },
  backBtn: { background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: "4px 8px", borderRadius: 6, fontFamily: "inherit" },
  btn: { padding: "9px 16px", borderRadius: 10, border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnIcon: { width: 34, height: 34, borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "#1e293b" },
  btnPrimary: { background: "#1e293b", color: "#fff" },
  btnOutline: { background: "#f1f5f9", color: "#1e293b", border: "1px solid #e2e8f0" },
  syncBadge: { display: "inline-block", fontSize: 11, color: "#10b981", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "3px 10px", fontWeight: 600 },
  errorBanner: { background: "#ef4444", color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 600 },
  umsatzBanner: { margin: "12px 20px 0", background: "linear-gradient(135deg,#1e293b,#334155)", borderRadius: 14, padding: "16px 20px", border: "1px solid #334155" },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 20px 0" },
  statCard: { background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #e2e8f0", textAlign: "center" },
  toolbar: { display: "flex", gap: 10, padding: "12px 20px", alignItems: "center" },
  cardList: { padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #e2e8f0" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardNames: { fontWeight: 700, fontSize: 16, color: "#1e293b" },
  cardDate: { fontSize: 13, color: "#64748b", marginTop: 2 },
  cardLocation: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, border: "1px solid", display: "inline-block" },
  tag: { background: "#f1f5f9", color: "#475569", fontSize: 13, padding: "4px 10px", borderRadius: 20, border: "1px solid #e2e8f0" },
  tagSmall: { background: "#f8fafc", color: "#94a3b8", fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #e2e8f0" },
  empty: { textAlign: "center", padding: "60px 20px", color: "#94a3b8" },
  formBody: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 },
  section: { background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #e2e8f0" },
  sectionTitle: { fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 },
  fieldGroup: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b", background: "#fafafa", outline: "none", marginBottom: 0 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  checkGrid: { display: "flex", gap: 20, flexWrap: "wrap" },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  checkbox: { width: 16, height: 16, cursor: "pointer", accentColor: "#1e293b" },
  checkLabel: { fontSize: 14, color: "#1e293b" },
  paketGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  paketBtn: { display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", gap: 4, fontFamily: "inherit" },
  paketBtnActive: { background: "#1e293b", borderColor: "#1e293b", color: "#fff" },
  preisBox: { background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac", borderRadius: 12, padding: "14px 16px", marginTop: 4 },
  preisLine: { fontSize: 12, color: "#166534", marginTop: 3 },
  videoOptList: { display: "flex", flexDirection: "column", gap: 8 },
  videoOptBtn: { display: "block", width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "#1e293b" },
  videoOptBtnActive: { background: "#7c3aed", borderColor: "#7c3aed", color: "#fff" },
};
