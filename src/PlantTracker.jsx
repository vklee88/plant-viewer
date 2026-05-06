import { useState, useRef, useCallback, useEffect } from "react";

const CATEGORIES = ["Leaf Color", "Stem Health", "Soil Moisture", "Pest Signs", "Growth", "Overall"];
const SCORE_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];
const SCORE_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
const STORAGE_KEY = "plant-tracker-v1";
const API_URL = "/api/plants";

// Infinite color palette — cycles for any number of plants
const PALETTE = [
  { bg: "linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%)", accent: "#4ade80", muted: "#86efac", dot: "#16a34a" },
  { bg: "linear-gradient(135deg, #4a0010 0%, #881337 60%, #9f1239 100%)", accent: "#fb7185", muted: "#fda4af", dot: "#e11d48" },
  { bg: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 60%, #4338ca 100%)", accent: "#a5b4fc", muted: "#c7d2fe", dot: "#6366f1" },
  { bg: "linear-gradient(135deg, #431407 0%, #9a3412 60%, #c2410c 100%)", accent: "#fdba74", muted: "#fed7aa", dot: "#ea580c" },
  { bg: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 60%, #0284c7 100%)", accent: "#7dd3fc", muted: "#bae6fd", dot: "#0ea5e9" },
  { bg: "linear-gradient(135deg, #3b0764 0%, #7e22ce 60%, #9333ea 100%)", accent: "#d8b4fe", muted: "#e9d5ff", dot: "#a855f7" },
  { bg: "linear-gradient(135deg, #422006 0%, #92400e 60%, #b45309 100%)", accent: "#fcd34d", muted: "#fde68a", dot: "#d97706" },
  { bg: "linear-gradient(135deg, #042f2e 0%, #0f766e 60%, #0d9488 100%)", accent: "#5eead4", muted: "#99f6e4", dot: "#14b8a6" },
];

const PLANT_EMOJIS = ["🌿", "🌸", "🌵", "🌺", "🌻", "🍀", "🌴", "🌾", "🌱", "🪴", "🌹", "🍃"];

const AI_PROMPT =
  'Analyze this plant image. Reply with ONLY valid JSON, no extra text: {"overallHealth":"Good","score":3,"summary":"describe plant health in 2 sentences","categories":{"Leaf Color":{"score":3,"note":"observation"},"Stem Health":{"score":3,"note":"observation"},"Soil Moisture":{"score":3,"note":"observation"},"Pest Signs":{"score":5,"note":"observation"},"Growth":{"score":3,"note":"observation"},"Overall":{"score":3,"note":"observation"}},"issues":["list any problems"],"advice":["action 1","action 2","action 3"]}';

function convertToJpeg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const MAX_DIM = 1600;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.82;
      const tryNext = () => {
        const out = canvas.toDataURL("image/jpeg", quality);
        const bytes = Math.round((out.length * 3) / 4);
        if (bytes <= 4 * 1024 * 1024 || quality <= 0.2) resolve(out);
        else { quality = Math.round((quality - 0.1) * 10) / 10; tryNext(); }
      };
      tryNext();
    };
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = dataUrl;
  });
}

function ScoreSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            width: "36px", height: "36px", borderRadius: "50%", border: "2px solid",
            borderColor: value === s ? SCORE_COLORS[s - 1] : "#d1d5db",
            background: value === s ? SCORE_COLORS[s - 1] : "transparent",
            color: value === s ? "#fff" : "#6b7280",
            fontWeight: "700", fontSize: "13px", cursor: "pointer",
            transition: "all 0.15s", fontFamily: "inherit",
          }}
        >
          {s}
        </button>
      ))}
      {value ? (
        <span style={{ alignSelf: "center", fontSize: "12px", color: SCORE_COLORS[value - 1], fontWeight: "600" }}>
          {SCORE_LABELS[value - 1]}
        </span>
      ) : null}
    </div>
  );
}

function WeekCard({ week, onSelect, isSelected, accentColor = "#16a34a" }) {
  const vals = Object.values(week.scores || {});
  const avg = vals.length > 0
    ? Math.round((vals.reduce((a, b) => a + b, 0) / CATEGORIES.length) * 10) / 10
    : null;
  const color = avg ? SCORE_COLORS[Math.round(avg) - 1] : "#9ca3af";
  return (
    <div
      onClick={() => onSelect(week)}
      style={{
        background: isSelected ? "#111827" : "#fff",
        border: `2px solid ${isSelected ? accentColor : "#e5e7eb"}`,
        borderRadius: "14px", padding: "14px 16px", cursor: "pointer",
        transition: "all 0.2s", minWidth: "90px",
        boxShadow: isSelected ? `0 0 0 3px ${accentColor}44` : "none",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Week</div>
      <div style={{ fontSize: "26px", fontWeight: "800", color: isSelected ? "#fff" : "#111827", lineHeight: 1 }}>{week.weekNumber}</div>
      <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
        <span style={{ fontSize: "12px", fontWeight: "600", color: isSelected ? "#d1d5db" : color }}>
          {avg ? avg.toFixed(1) : "—"}
        </span>
      </div>
      {week.image && (
        <div style={{ marginTop: "8px", width: "100%", height: "50px", borderRadius: "8px", overflow: "hidden" }}>
          <img src={week.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </div>
  );
}

function PlantTab({ plant, isActive, onClick, onDelete, colorScheme, canDelete }) {
  const latestWeek = plant.weeks[plant.weeks.length - 1];
  const vals = Object.values(latestWeek?.scores || {});
  const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        onClick={onClick}
        style={{
          width: "72px", padding: "10px 8px", borderRadius: "12px", cursor: "pointer",
          background: isActive ? colorScheme.dot : "#f3f4f6",
          transition: "all 0.2s", textAlign: "center",
          boxShadow: isActive ? `0 4px 14px ${colorScheme.dot}55` : "none",
        }}
      >
        <div style={{ fontSize: "20px", lineHeight: 1 }}>{plant.emoji}</div>
        <div style={{ fontSize: "11px", fontWeight: "700", color: isActive ? "#fff" : "#6b7280", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {plant.name.length > 7 ? plant.name.slice(0, 6) + "…" : plant.name}
        </div>
        {avg && (
          <div style={{ fontSize: "10px", color: isActive ? "rgba(255,255,255,0.8)" : "#9ca3af", fontWeight: "600" }}>
            {avg.toFixed(1)}/5
          </div>
        )}
      </div>
      {canDelete && isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete plant"
          style={{
            position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px",
            borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff",
            fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: "700", lineHeight: 1, padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function AIAnalysis({ image, onResult, accentColor = "#16a34a" }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyze = useCallback(async () => {
    if (!image) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const base64 = image.includes(",") ? image.split(",")[1] : image;
      if (!base64 || base64.length < 100) throw new Error("Image missing — please re-upload.");

      let response;
      try {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: base64 } },
                { text: AI_PROMPT },
              ],
            }],
          }),
        });
      } catch (e) {
        throw new Error("Network error — check your connection and try again.");
      }

      if (!response.ok) {
        let message = `Server error (${response.status})`;
        try {
          const err = await response.json();
          message = err?.error || message;
        } catch { /* ignore */ }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        reader.cancel();
      }, 30000); // 30s timeout

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (timedOut) throw new Error("Request timed out — please try again.");

          const lines = decoder.decode(value, { stream: true }).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) accumulated += text;

              // Check for safety blocks
              const finishReason = parsed.candidates?.[0]?.finishReason;
              if (finishReason === "SAFETY") throw new Error("Response blocked by safety filter.");
              if (finishReason === "RECITATION") throw new Error("Response blocked due to recitation policy.");
            } catch (e) {
              if (e.message.includes("blocked")) throw e;
              // otherwise it's a partial chunk, skip
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      if (!accumulated) throw new Error("Empty response from Gemini — please try again.");

      // Extract JSON
      let s = -1, depth = 0, jsonStr = null;
      for (let i = 0; i < accumulated.length; i++) {
        if (accumulated[i] === "{") { if (depth === 0) s = i; depth++; }
        else if (accumulated[i] === "}") { depth--; if (depth === 0 && s !== -1) { jsonStr = accumulated.slice(s, i + 1); break; } }
      }
      if (!jsonStr) throw new Error("Could not parse AI response — please try again.");

      let parsed;
      try { parsed = JSON.parse(jsonStr); }
      catch {
        try { parsed = JSON.parse(jsonStr.replace(/,(\s*[}\]])/g, "$1")); }
        catch { throw new Error("Malformed JSON in response — please try again."); }
      }

      setResult(parsed);
      if (onResult) onResult(parsed);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [image, onResult]);

  const healthColors = { Excellent: "#16a34a", Good: "#65a30d", Fair: "#ca8a04", Poor: "#ea580c", Critical: "#dc2626" };

  return (
    <div style={{ marginTop: "20px" }}>
      <button
        onClick={analyze}
        disabled={!image || loading}
        style={{
          width: "100%", padding: "14px", borderRadius: "12px", border: "none",
          background: image && !loading ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : "#e5e7eb",
          color: image && !loading ? "#fff" : "#9ca3af",
          fontWeight: "700", fontSize: "15px", cursor: image && !loading ? "pointer" : "not-allowed",
          fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          transition: "all 0.2s", boxShadow: image && !loading ? `0 4px 14px ${accentColor}44` : "none",
        }}
      >
        {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>🌿</span> Analyzing...</> : "🔬 AI Diagnose Plant"}
      </button>
      {error && (
        <div style={{ marginTop: "12px", padding: "12px", background: "#fef2f2", borderRadius: "10px", border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#991b1b", marginBottom: "6px" }}>⚠ Error</div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#dc2626", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "180px", overflowY: "auto" }}>{error}</div>
        </div>
      )}
      {result && (
        <div style={{ marginTop: "16px", animation: "fadeIn 0.4s ease" }}>
          <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderRadius: "14px", padding: "18px", border: "1px solid #bbf7d0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#166534" }}>AI Diagnosis</span>
              <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", background: healthColors[result.overallHealth] || "#6b7280", color: "#fff" }}>
                {result.overallHealth} · {result.score}/5
              </span>
            </div>
            <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, margin: "0 0 14px 0" }}>{result.summary}</p>
            {result.categories && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                {Object.entries(result.categories).map(([cat, val]) => (
                  <div key={cat} style={{ background: "#fff", borderRadius: "10px", padding: "10px 12px", border: "1px solid #d1fae5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</span>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: SCORE_COLORS[(val.score || 1) - 1] }}>{val.score}/5</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#374151" }}>{val.note}</div>
                  </div>
                ))}
              </div>
            )}
            {result.issues?.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#92400e", marginBottom: "6px" }}>⚠ Issues Detected</div>
                {result.issues.map((issue, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "#78350f", padding: "4px 0", display: "flex", gap: "6px" }}>
                    <span>•</span><span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
            {result.advice?.length > 0 && (
              <div style={{ background: "linear-gradient(135deg, #052e16, #14532d)", borderRadius: "12px", padding: "16px", border: "1px solid #16a34a" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#86efac", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>📋 Next Week Actions</div>
                {result.advice.map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "rgba(255,255,255,0.07)", borderRadius: "10px", marginBottom: "8px", border: "1px solid rgba(134,239,172,0.2)" }}>
                    <div style={{ minWidth: "24px", height: "24px", borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: "13px", color: "#d1fae5", lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function PlantTracker() {
  const makeWeek = (n) => ({ weekNumber: n, scores: {}, image: null, aiResult: null, date: new Date().toLocaleDateString() });
  const makePlant = (name, emoji, colorIndex) => ({ name, emoji, colorIndex, weeks: [makeWeek(1)], selectedWeek: 0 });

  const defaultPlants = [
    makePlant("My Plant 1", "🌿", 0),
    makePlant("My Plant 2", "🌸", 1),
    makePlant("My Plant 3", "🌵", 2),
  ];

  const [plants, setPlants] = useState(defaultPlants);
  const [activePlant, setActivePlant] = useState(0);

  const [editingName, setEditingName] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [syncStatus, setSyncStatus] = useState(null); // null | "syncing" | "synced" | "error"
  const [addingPlant, setAddingPlant] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantEmoji, setNewPlantEmoji] = useState("🌱");
  const fileRef = useRef();
  const syncTimer = useRef(null);

  const scheme = PALETTE[(plants[activePlant]?.colorIndex ?? activePlant) % PALETTE.length] || PALETTE[0];
  const plant = plants[activePlant];
  const selectedWeek = plant?.selectedWeek ?? 0;
  const current = plant?.weeks[selectedWeek];

  // ── Load from Redis on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const remote = await res.json();
        if (!remote?.plants) return;
        setPlants(remote.plants);
        setActivePlant(remote.activePlant ?? 0);
      } catch { /* offline */ }
    })();
  }, []);

  // ── Save to localStorage immediately, debounce Redis sync ──
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plants, activePlant }));
      setSaveStatus("saved");
      const t = setTimeout(() => setSaveStatus(null), 1800);
      return () => clearTimeout(t);
    } catch { /* storage unavailable */ }

    // Debounced Redis sync
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plants, activePlant }),
        });
        setSyncStatus(res.ok ? "synced" : "error");
        setTimeout(() => setSyncStatus(null), 2000);
      } catch {
        setSyncStatus("error");
        setTimeout(() => setSyncStatus(null), 2000);
      }
    }, 1500);
  }, [plants, activePlant]);

  const updatePlant = (patch) =>
    setPlants((ps) => ps.map((p, i) => (i === activePlant ? { ...p, ...patch } : p)));

  const updateCurrent = (weekPatch) =>
    setPlants((ps) =>
      ps.map((p, i) =>
        i === activePlant
          ? { ...p, weeks: p.weeks.map((w, j) => (j === p.selectedWeek ? { ...w, ...weekPatch } : w)) }
          : p
      )
    );

  const setSelectedWeek = (wi) => updatePlant({ selectedWeek: wi });

  const addWeek = () => {
    const newWeeks = [...plant.weeks, makeWeek(plant.weeks.length + 1)];
    updatePlant({ weeks: newWeeks, selectedWeek: newWeeks.length - 1 });
  };

  const addPlant = () => {
    if (!newPlantName.trim()) return;
    const colorIndex = plants.length % PALETTE.length;
    const newP = makePlant(newPlantName.trim(), newPlantEmoji, colorIndex);
    const next = [...plants, newP];
    setPlants(next);
    setActivePlant(next.length - 1);
    setAddingPlant(false);
    setNewPlantName("");
    setNewPlantEmoji("🌱");
  };

  const deletePlant = () => {
    if (plants.length <= 1) return;
    if (!window.confirm(`Delete "${plant.name}"? All weeks and data will be lost.`)) return;
    const next = plants.filter((_, i) => i !== activePlant);
    setPlants(next);
    setActivePlant(Math.max(0, activePlant - 1));
  };

  const deleteWeek = () => {
    if (plant.weeks.length <= 1) return;
    if (!window.confirm(`Delete Week ${current.weekNumber}? This cannot be undone.`)) return;
    const newWeeks = plant.weeks
      .filter((_, i) => i !== selectedWeek)
      .map((w, i) => ({ ...w, weekNumber: i + 1 }));
    updatePlant({ weeks: newWeeks, selectedWeek: Math.max(0, selectedWeek - 1) });
  };

  const handleImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jpeg = await convertToJpeg(e.target.result);
        if (!jpeg.startsWith("data:image/jpeg")) throw new Error("Conversion did not produce JPEG");
        updateCurrent({ image: jpeg, aiResult: null });
      } catch (err) {
        alert("Could not process image: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImage(file);
  };

  const avgScore = current?.scores && Object.keys(current.scores).length > 0
    ? Object.values(current.scores).reduce((a, b) => a + b, 0) / Object.values(current.scores).length
    : null;

  const trendData = plant?.weeks.map((w) => {
    const vals = Object.values(w.scores || {});
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }) || [];

  if (!plant || !current) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8faf9", fontFamily: "'Lora', 'Georgia', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap');
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; }
        ::-webkit-scrollbar { height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
      `}</style>

      {/* Plant tabs */}
      <div style={{ background: "#fff", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: "8px", overflowX: "auto", alignItems: "center" }}>
        {plants.map((p, i) => (
          <PlantTab
            key={i}
            plant={p}
            isActive={i === activePlant}
            onClick={() => { setActivePlant(i); setEditingName(false); }}
            onDelete={deletePlant}
            colorScheme={PALETTE[(p.colorIndex ?? i) % PALETTE.length]}
            canDelete={plants.length > 1}
          />
        ))}

        {/* Add plant button */}
        <button
          onClick={() => setAddingPlant(true)}
          title="Add plant"
          style={{
            flexShrink: 0, width: "72px", height: "72px", borderRadius: "12px",
            border: "2px dashed #d1d5db", background: "transparent", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "2px", color: "#9ca3af", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>＋</span>
          <span style={{ fontSize: "10px", fontWeight: "600" }}>Add</span>
        </button>
      </div>

      {/* Add plant modal */}
      {addingPlant && (
        <div
          onClick={() => setAddingPlant(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
          >
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827", marginBottom: "20px" }}>🌱 Add New Plant</div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</div>
              <input
                autoFocus
                value={newPlantName}
                onChange={(e) => setNewPlantName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlant()}
                placeholder="e.g. Fiddle Leaf Fig"
                style={{ width: "100%", padding: "12px 14px", border: "2px solid #e5e7eb", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Emoji</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PLANT_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setNewPlantEmoji(em)}
                    style={{
                      width: "40px", height: "40px", borderRadius: "10px", border: "2px solid",
                      borderColor: newPlantEmoji === em ? "#16a34a" : "#e5e7eb",
                      background: newPlantEmoji === em ? "#f0fdf4" : "transparent",
                      fontSize: "20px", cursor: "pointer",
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setAddingPlant(false)}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #e5e7eb", background: "transparent", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}
              >
                Cancel
              </button>
              <button
                onClick={addPlant}
                disabled={!newPlantName.trim()}
                style={{
                  flex: 2, padding: "12px", borderRadius: "10px", border: "none",
                  background: newPlantName.trim() ? "#16a34a" : "#e5e7eb",
                  color: newPlantName.trim() ? "#fff" : "#9ca3af",
                  fontSize: "14px", fontWeight: "700", cursor: newPlantName.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Add {newPlantEmoji} Plant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: scheme.bg, padding: "24px 28px 20px", position: "relative", overflow: "hidden", transition: "background 0.4s" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: scheme.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "6px" }}>
              {plant.emoji} Plant Journal
            </div>
            {editingName ? (
              <input
                autoFocus
                value={plant.name}
                onChange={(e) => updatePlant({ name: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                style={{ fontSize: "24px", fontWeight: "700", color: "#fff", background: "transparent", border: "none", borderBottom: `2px solid ${scheme.accent}`, fontFamily: "inherit", width: "220px", paddingBottom: "2px" }}
              />
            ) : (
              <div
                onClick={() => setEditingName(true)}
                style={{ fontSize: "24px", fontWeight: "700", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
              >
                {plant.name}
                <span style={{ fontSize: "14px", color: scheme.accent }}>✎</span>
              </div>
            )}
            <div style={{ fontSize: "13px", color: scheme.muted, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              Week {current.weekNumber} · {current.date}
              {saveStatus === "saved" && (
                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>✓ saved</span>
              )}
              {syncStatus === "syncing" && (
                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.1)", color: scheme.muted, padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>☁ syncing…</span>
              )}
              {syncStatus === "synced" && (
                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>☁ synced</span>
              )}
              {syncStatus === "error" && (
                <span style={{ fontSize: "10px", background: "rgba(239,68,68,0.3)", color: "#fca5a5", padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>☁ sync failed</span>
              )}
            </div>
          </div>
          {avgScore && (
            <div>
              <div style={{ width: "58px", height: "58px", borderRadius: "50%", background: `conic-gradient(${scheme.accent} ${(avgScore / 5) * 360}deg, rgba(255,255,255,0.1) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${scheme.accent}66` }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#fff", lineHeight: 1 }}>{avgScore.toFixed(1)}</span>
                  <span style={{ fontSize: "8px", color: scheme.muted }}>avg</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {trendData.some((v) => v !== null) && (
          <div style={{ marginTop: "16px", display: "flex", alignItems: "flex-end", gap: "4px", height: "32px" }}>
            {trendData.map((v, i) => (
              <div key={i} style={{ width: "20px", borderRadius: "3px 3px 0 0", height: v ? `${(v / 5) * 28}px` : "4px", background: i === selectedWeek ? scheme.accent : v ? `${scheme.muted}66` : "#ffffff22", transition: "all 0.3s" }} />
            ))}
            <span style={{ fontSize: "10px", color: scheme.muted, marginLeft: "4px", alignSelf: "center" }}>health trend</span>
          </div>
        )}
      </div>

      {/* Week selector */}
      <div style={{ padding: "16px 20px 0", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", paddingBottom: "4px" }}>
          {plant.weeks.map((w, i) => (
            <WeekCard key={i} week={w} isSelected={i === selectedWeek} onSelect={() => setSelectedWeek(i)} accentColor={scheme.dot} />
          ))}
          <button
            onClick={addWeek}
            style={{ minWidth: "70px", height: "90px", borderRadius: "14px", border: "2px dashed #d1d5db", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", color: "#9ca3af", fontFamily: "inherit" }}
          >
            <span style={{ fontSize: "24px", lineHeight: 1 }}>+</span>
            <span style={{ fontSize: "10px", fontWeight: "600" }}>Week {plant.weeks.length + 1}</span>
          </button>
          {plant.weeks.length > 1 && (
            <button
              onClick={deleteWeek}
              style={{ minWidth: "70px", height: "90px", borderRadius: "14px", border: "2px dashed #fca5a5", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", color: "#ef4444", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: "24px", lineHeight: 1 }}>🗑</span>
              <span style={{ fontSize: "10px", fontWeight: "600" }}>Week {current.weekNumber}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "16px 20px 40px" }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !current.image && fileRef.current.click()}
          style={{ borderRadius: "16px", overflow: "hidden", border: dragOver ? `2px dashed ${scheme.dot}` : "2px dashed #d1d5db", background: dragOver ? "#f0fdf4" : "#fff", cursor: current.image ? "default" : "pointer", transition: "all 0.2s", marginBottom: "16px", minHeight: current.image ? "220px" : "130px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
        >
          {current.image ? (
            <>
              <img src={current.image} alt="plant" style={{ width: "100%", maxHeight: "280px", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ background: "rgba(0,0,0,0.55)", color: "#d1fae5", fontSize: "10px", padding: "3px 8px", borderRadius: "6px", fontFamily: "monospace" }}>
                  JPEG · {Math.round(current.image.length * 0.75 / 1024)} KB
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
                  style={{ background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}
                >
                  ↩ Replace
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>📷</div>
              <div style={{ fontWeight: "600", color: "#374151", fontSize: "15px" }}>Drop a photo or tap to upload</div>
              <div style={{ color: "#9ca3af", fontSize: "13px", marginTop: "4px" }}>Shows week {current.weekNumber} plant condition</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImage(e.target.files[0])} />

        <AIAnalysis
          key={`${activePlant}-${selectedWeek}`}
          image={current.image}
          accentColor={scheme.dot}
          onResult={(r) => {
            const mapped = {};
            if (r.categories) CATEGORIES.forEach((cat) => { if (r.categories[cat]) mapped[cat] = r.categories[cat].score; });
            updateCurrent({ aiResult: r, scores: { ...current.scores, ...mapped } });
          }}
        />

        <div style={{ marginTop: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>📊 Manual Assessment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {CATEGORIES.map((cat) => (
              <div key={cat} style={{ background: "#fff", borderRadius: "12px", padding: "14px 16px", border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "10px" }}>{cat}</div>
                <ScoreSelector
                  value={current.scores?.[cat] || 0}
                  onChange={(v) => updateCurrent({ scores: { ...current.scores, [cat]: v } })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}