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
  };

  if (!isLoggedIn) return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <ZenithLogo />
        </div>
        <div style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24 }}>
          Bitte melde dich an um fortzufahren
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Passwort</label>
          <input
            style={{ ...styles.input, fontSize: 16, textAlign: "center", letterSpacing: "0.1em" }}
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
      </div>
    </div>
  );

  // Load from Supabase on mount
  useEffect(() => {
    dbGetAll()
      .then(data => { setWeddings(data); setLoading(false); })
      .catch(err => { setSyncError("Verbindung zu Supabase fehlgeschlagen: " + err.message); setLoading(false); });
  }, []);

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
      <div style={styles.page}>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button style={styles.backBtn} onClick={() => setView("list")}>← Zurück</button>
            <ZenithLogo compact />
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

          <DetailCard title="💑 Brautpaar">
            <DetailRow label="Partner 1" val={w.partner1} />
            <DetailRow label="Partner 2" val={w.partner2} />
            <DetailRow label="Adresse" val={w.adresse} />
            <DetailRow label="Telefon" val={w.telefon} />
            <DetailRow label="E-Mail" val={w.email} />
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

          {w.notizen && <DetailCard title="📝 Notizen"><p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{w.notizen}</p></DetailCard>}

          <DetailCard title="📋 Erstgespräch">
            <DetailRow label="Datum" val={formatDate(w.erstgespraechDatum)} />
            <DetailRow label="Ort" val={w.erstgespraechAdresse} />
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
    <div style={styles.page}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      <div style={styles.header}>
        <ZenithLogo />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.btn, ...styles.btnOutline, fontSize: 13 }} onClick={reload} title="Daten neu laden">
            {loading ? "⏳" : "🔄"}
          </button>
          <button style={{ ...styles.btn, ...styles.btnOutline, fontSize: 13 }} onClick={handleLogout} title="Abmelden">
            🔒
          </button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={openNew}>+ Neu</button>
        </div>
      </div>

      {syncError && (
        <div style={styles.errorBanner}>
          ⚠️ {syncError}
          <button style={{ marginLeft: 10, fontSize: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", textDecoration: "underline" }} onClick={reload}>Erneut versuchen</button>
        </div>
      )}

      <div style={{ padding: "8px 20px 0" }}>
        <div style={styles.syncBadge}>☁️ Echtzeit-Sync · alle Geräte</div>
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Gesamt" val={loading ? "…" : weddings.length} icon="💍" />
        <StatCard label="Gebucht" val={loading ? "…" : booked} icon="✅" />
        <StatCard label={`${new Date().getFullYear()}`} val={loading ? "…" : thisYear} icon="📅" />
        {nextWedding ? (
          <StatCard label="Nächste Hochzeit" val={`in ${daysUntil(nextWedding.hochzeitsDatum)} Tagen`} sub={`${nextWedding.partner1} & ${nextWedding.partner2}`} icon="💒" />
        ) : (
          <StatCard label="Keine anstehend" val="—" icon="💒" />
        )}
      </div>

      {/* Umsatz Banner */}
      {!loading && umsatzGesamt > 0 && (
        <div style={styles.umsatzBanner}>
          <div style={{ fontSize: 12, color: "#86efac", marginBottom: 2 }}>📊 Gesamtumsatz (alle aktiven Hochzeiten)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{formatEuro(umsatzGesamt)}</div>
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
              <div key={w.id} style={{ ...styles.card, cursor: "pointer" }} onClick={() => openDetail(w)}>
                <div style={styles.cardTop}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.cardNames}>{w.partner1 || "Partner 1"} & {w.partner2 || "Partner 2"}</div>
                    <div style={styles.cardDate}>{formatDate(w.hochzeitsDatum)}{w.hochzeitsUhrzeit ? ` · ${w.hochzeitsUhrzeit} Uhr` : ""}</div>
                    {w.feierAdresse && <div style={styles.cardLocation}>📍 {w.feierAdresse}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ ...styles.badge, background: STATUS_COLORS[w.status] + "22", color: STATUS_COLORS[w.status], borderColor: STATUS_COLORS[w.status] + "55" }}>{w.status}</span>
                    {isUpcoming && days !== null && <span style={{ ...styles.badge, background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>{days === 0 ? "Heute! 🎉" : `noch ${days}d`}</span>}
                    {preis > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{formatEuro(preis)}</span>}
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

function ZenithLogo({ compact = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: compact ? 6 : 8 }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', sans-serif",
          fontWeight: 900,
          fontSize: compact ? 20 : 26,
          letterSpacing: "0.08em",
          color: "#F7A800",
          textTransform: "uppercase",
          lineHeight: 1,
        }}>ZENITH</span>
        {!compact && (
          <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "sans-serif", letterSpacing: "0.05em" }}>
            Hochzeitsfotografie
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ height: 1, width: compact ? 20 : 26, background: "#e2e8f0" }} />
        <span style={{
          fontSize: compact ? 9 : 10,
          color: "#3d5166",
          fontFamily: "sans-serif",
          letterSpacing: "0.04em",
        }}>
          Philipp Nolte · <strong style={{ color: "#3d5166" }}>dk group</strong>
        </span>
      </div>
    </div>
  );
}

function Toast({ msg, color }) {
  return <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: color, color: "#fff", padding: "10px 20px", borderRadius: 30, fontWeight: 600, fontSize: 13, zIndex: 999, boxShadow: "0 4px 20px #0003", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>{msg}</div>;
}
function Section({ title, children }) {
  return <div style={styles.section}><div style={styles.sectionTitle}>{title}</div>{children}</div>;
}
function DetailCard({ title, children }) {
  return <div style={styles.card}><div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>{title}</div>{children}</div>;
}
function DetailRow({ label, val }) {
  if (!val) return null;
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 14 }}>
      <span style={{ color: "#94a3b8", minWidth: 120 }}>{label}</span>
      <span style={{ color: "#1e293b", fontWeight: 500 }}>{val}</span>
    </div>
  );
}
function StatCard({ label, val, sub, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{val}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Georgia','Times New Roman',serif", background: "#f8fafc", minHeight: "100vh", padding: "0 0 40px", maxWidth: 680, margin: "0 auto" },
  loginPage: { fontFamily: "'Georgia','Times New Roman',serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  loginCard: { background: "#fff", borderRadius: 20, padding: "32px 28px", border: "1px solid #e2e8f0", width: "100%", maxWidth: 360, boxShadow: "0 8px 40px #0001" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { margin: 0, fontSize: 20, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.5px" },
  pageTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" },
  backBtn: { background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: "4px 8px", borderRadius: 6, fontFamily: "inherit" },
  btn: { padding: "9px 16px", borderRadius: 10, border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" },
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
  cardNames: { fontWeight: 700, fontSize: 16, color: "#1e293b", fontFamily: "Georgia, serif" },
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
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6, fontFamily: "inherit" },
  input: { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", color: "#1e293b", background: "#fafafa", outline: "none", marginBottom: 0 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  checkGrid: { display: "flex", gap: 20, flexWrap: "wrap" },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  checkbox: { width: 16, height: 16, cursor: "pointer", accentColor: "#1e293b" },
  checkLabel: { fontSize: 14, color: "#1e293b", fontFamily: "inherit" },
  paketGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  paketBtn: { display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", gap: 4, fontFamily: "inherit" },
  paketBtnActive: { background: "#1e293b", borderColor: "#1e293b", color: "#fff" },
  preisBox: { background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac", borderRadius: 12, padding: "14px 16px", marginTop: 4 },
  preisLine: { fontSize: 12, color: "#166534", marginTop: 3 },
  videoOptList: { display: "flex", flexDirection: "column", gap: 8 },
  videoOptBtn: { display: "block", width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "#1e293b" },
  videoOptBtnActive: { background: "#7c3aed", borderColor: "#7c3aed", color: "#fff" },
};
