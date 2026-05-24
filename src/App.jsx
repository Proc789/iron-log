import { useState, useEffect } from "react";

// ── Firebase ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDj5PWLNGzL6mH3B2OzhH_6Sr7gg2BhWEs",
  authDomain: "iron-log-f7d50.firebaseapp.com",
  projectId: "iron-log-f7d50",
  storageBucket: "iron-log-f7d50.firebasestorage.app",
  messagingSenderId: "326470344314",
  appId: "1:326470344314:web:678f2884c38259656225c3",
  measurementId: "G-B93905G7PT",
};

// Dynamically load Firebase SDKs
let firebaseApp, auth, db, googleProvider;
const initFirebase = async () => {
  if (firebaseApp) return { auth, db, googleProvider };
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getFirestore, doc, setDoc, getDoc } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  googleProvider = new GoogleAuthProvider();

  return { auth, db, googleProvider, getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };
};

// ── Constants ─────────────────────────────────────────────
const DEFAULT_EXERCISES = {
  胸: ["槓鈴臥推", "啞鈴臥推", "上斜臥推", "下斜臥推", "蝴蝶機夾胸", "繩索飛鳥"],
  肩: ["槓鈴肩推", "啞鈴側平舉", "啞鈴前平舉", "面拉", "Arnold Press", "後三角飛鳥"],
  背: ["引體向上", "滑輪下拉", "槓鈴划船", "啞鈴划船", "坐姿划船", "硬舉"],
  腿: ["深蹲", "腿推機", "腿部伸展", "腿部彎舉", "弓步蹲", "羅馬尼亞硬舉"],
  有氧: ["跑步機", "飛輪", "橢圓機", "划船機", "跳繩", "HIIT"],
};

const GROUP_COLORS = { 胸: "#E8413A", 肩: "#0AA89E", 背: "#1A7BC4", 腿: "#2E9E5B", 有氧: "#D4820A" };
const GROUP_BG = { 胸: "#FFF0F0", 肩: "#F0FAFA", 背: "#F0F6FF", 腿: "#F0FAF4", 有氧: "#FFFBF0" };
const GROUP_ICONS = { 胸: "⬡", 肩: "◈", 背: "⬟", 腿: "◆", 有氧: "○" };

const todayStr = () => new Date().toISOString().split("T")[0];
const formatTodayFull = () => new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const formatDateFull = (str) => {
  const d = new Date(str + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

const generateShareText = (group, workouts) => {
  let text = `💪 今日訓練｜${group}\n📅 ${formatTodayFull()}\n━━━━━━━━━━━━━━\n`;
  let totalSets = 0;
  workouts.forEach(w => {
    text += `\n▸ ${w.exercise}\n`;
    w.sets.forEach((s, i) => {
      if (s.weight || s.reps) { text += `  第${i + 1}組｜${s.weight ? s.weight + "kg" : "-"} × ${s.reps ? s.reps + "次" : "-"}\n`; totalSets++; }
    });
  });
  return text + `\n━━━━━━━━━━━━━━\n總組數：${totalSets} 組`;
};

// ── Styles ────────────────────────────────────────────────
const inputStyle = {
  flex: 1, background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 8,
  color: "#222", fontSize: 14, padding: "8px 10px", outline: "none", textAlign: "center", width: "100%",
};
const cardStyle = {
  background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0",
};
const groupTabStyle = (g, active) => ({
  padding: "7px 14px", borderRadius: 20,
  border: active ? `1.5px solid ${GROUP_COLORS[g]}` : "1.5px solid #e8e8e8",
  background: active ? GROUP_BG[g] : "#fff",
  color: active ? GROUP_COLORS[g] : "#aaa",
  fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
});

const historyFilterStyle = (g, active) => ({
  padding: "7px 14px", borderRadius: 20,
  border: active ? `1.5px solid ${g === "全部" ? "#222" : GROUP_COLORS[g]}` : "1.5px solid #e8e8e8",
  background: active ? (g === "全部" ? "#f0f0f0" : GROUP_BG[g]) : "#fff",
  color: active ? (g === "全部" ? "#222" : GROUP_COLORS[g]) : "#aaa",
  fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
});

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [fbReady, setFbReady] = useState(false);
  const [fbModules, setFbModules] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [page, setPage] = useState("today");
  const [exercises, setExercises] = useState(DEFAULT_EXERCISES);
  const [logs, setLogs] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);

  // Today
  const [selectedGroup, setSelectedGroup] = useState("胸");
  const [workouts, setWorkouts] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [lastSaved, setLastSaved] = useState({ workouts: [], group: "胸" });

  // History
  const [histGroup, setHistGroup] = useState("全部");

  // Manage
  const [manageGroup, setManageGroup] = useState("胸");
  const [newEx, setNewEx] = useState({});

  // Init Firebase
  useEffect(() => {
    initFirebase().then((modules) => {
      setFbModules(modules);
      setFbReady(true);
      modules.onAuthStateChanged(modules.auth, async (u) => {
        setUser(u);
        setAuthLoading(false);
        if (u) await loadUserData(u.uid, modules);
      });
    });
  }, []);

  // Firestore helpers
  const loadUserData = async (uid, modules) => {
    const m = modules || fbModules;
    if (!m) return;
    try {
      const exSnap = await m.getDoc(m.doc(db, "users", uid, "data", "exercises"));
      if (exSnap.exists()) setExercises(exSnap.data().value);
      const logSnap = await m.getDoc(m.doc(db, "users", uid, "data", "logs"));
      if (logSnap.exists()) setLogs(logSnap.data().value);
    } catch {}
    setDataLoaded(true);
  };

  const persistExercises = async (data) => {
    setExercises(data);
    if (!user || !fbModules) return;
    try { await fbModules.setDoc(fbModules.doc(db, "users", user.uid, "data", "exercises"), { value: data }); } catch {}
  };

  const persistLogs = async (data) => {
    setLogs(data);
    if (!user || !fbModules) return;
    try { await fbModules.setDoc(fbModules.doc(db, "users", user.uid, "data", "logs"), { value: data }); } catch {}
  };

  // Auth
  const signIn = async () => {
    if (!fbModules) return;
    try { await fbModules.signInWithPopup(fbModules.auth, googleProvider); } catch {}
  };

  const signOutUser = async () => {
    if (!fbModules) return;
    await fbModules.signOut(fbModules.auth);
    setUser(null); setLogs({}); setExercises(DEFAULT_EXERCISES); setDataLoaded(false);
  };

  // Today handlers
  const addWorkout = () => {
    const ex = exercises[selectedGroup]?.[0];
    if (!ex) return;
    setWorkouts(prev => [...prev, { exercise: ex, sets: [{ weight: "", reps: "" }] }]);
  };
  const updateExercise = (wi, val) => setWorkouts(prev => prev.map((w, i) => i === wi ? { ...w, exercise: val } : w));
  const addSet = (wi) => setWorkouts(prev => prev.map((w, i) => i === wi ? { ...w, sets: [...w.sets, { weight: "", reps: "" }] } : w));
  const removeSet = (wi, si) => setWorkouts(prev =>
    prev.map((w, i) => i !== wi ? w : { ...w, sets: w.sets.filter((_, j) => j !== si) }).filter(w => w.sets.length > 0)
  );
  const updateSet = (wi, si, field, val) => setWorkouts(prev =>
    prev.map((w, i) => i !== wi ? w : { ...w, sets: w.sets.map((s, j) => j === si ? { ...s, [field]: val } : s) })
  );

  const saveToday = async () => {
    if (workouts.length === 0) return;
    const key = todayStr();
    const entries = workouts.map(w => ({ group: selectedGroup, exercise: w.exercise, sets: w.sets }));
    const newLogs = { ...logs, [key]: [...(logs[key] || []), ...entries] };
    await persistLogs(newLogs);
    setLastSaved({ workouts, group: selectedGroup });
    setWorkouts([]);
    setSaveMsg("✓ 已儲存");
    setShowShare(true);
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const shareToLine = () => {
    const text = generateShareText(lastSaved.group, lastSaved.workouts);
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank");
  };

  // History helpers
  const getHistoryDays = () => {
    return Object.entries(logs)
      .map(([date, entries]) => {
        const filtered = histGroup === "全部" ? entries : entries.filter(e => e.group === histGroup);
        return { date, entries: filtered };
      })
      .filter(({ entries }) => entries.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const groupEntriesByBodyPart = (entries) => {
    const map = {};
    entries.forEach(e => {
      if (!map[e.group]) map[e.group] = [];
      map[e.group].push(e);
    });
    return map;
  };

  const deleteHistoryDate = async (date) => {
    if (!window.confirm(`確定要刪除 ${formatDateFull(date)} 的訓練紀錄嗎？`)) return;
    const newLogs = { ...logs };
    delete newLogs[date];
    await persistLogs(newLogs);
  };

  const historyDays = getHistoryDays();

  // Manage
  const addExercise = (g) => {
    const val = (newEx[g] || "").trim();
    if (!val || exercises[g].includes(val)) return;
    persistExercises({ ...exercises, [g]: [...exercises[g], val] });
    setNewEx(prev => ({ ...prev, [g]: "" }));
  };
  const removeExercise = (g, ex) => persistExercises({ ...exercises, [g]: exercises[g].filter(e => e !== ex) });

  // ── Loading ──
  if (!fbReady || authLoading) return (
    <div style={{ background: "#f5f5f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#ccc", fontFamily: "monospace", letterSpacing: "4px", fontSize: 12 }}>LOADING...</div>
    </div>
  );

  // ── Login Screen ──
  if (!user) return (
    <div style={{
      background: "#f5f5f7", minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      fontFamily: "'Noto Sans TC', 'PingFang TC', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1px", color: "#111" }}>IRON</span>
        <span style={{ fontSize: 32, fontWeight: 300, color: "#ccc", letterSpacing: "4px", marginLeft: 8 }}>LOG</span>
      </div>
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 48, letterSpacing: "1px" }}>重訓記錄</div>

      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: 6 }}>開始記錄你的訓練</div>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 28, lineHeight: 1.6 }}>登入後資料會自動儲存<br/>並可在所有裝置上同步</div>
        <button onClick={signIn} style={{
          background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 12,
          color: "#333", fontSize: 14, fontWeight: 700, padding: "14px 24px",
          cursor: "pointer", width: "100%", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          使用 Google 帳號登入
        </button>
      </div>
    </div>
  );

  const accent = GROUP_COLORS[selectedGroup];
  const accentBg = GROUP_BG[selectedGroup];
  const manAccent = GROUP_COLORS[manageGroup];

  return (
    <div style={{
      background: "#f5f5f7", minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      fontFamily: "'Noto Sans TC', 'PingFang TC', sans-serif", color: "#222", paddingBottom: 84,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        select option { background: #fff; color: #222; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        button:active { opacity: 0.7; }
        input:focus { border-color: #aaa !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#fff", padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0",
        display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.5px", color: "#111" }}>IRON</span>
        <span style={{ fontSize: 18, fontWeight: 300, color: "#ccc", letterSpacing: "3px", marginLeft: 6 }}>LOG</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #f0f0f0" }} />
          <button onClick={signOutUser} style={{
            background: "transparent", border: "1px solid #e8e8e8", borderRadius: 8,
            color: "#aaa", fontSize: 11, padding: "4px 10px", cursor: "pointer",
          }}>登出</button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* ── TODAY ── */}
        {page === "today" && (<>
          <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
            {Object.keys(exercises).map(g => (
              <button key={g} onClick={() => { setSelectedGroup(g); setShowShare(false); }} style={groupTabStyle(g, selectedGroup === g)}>
                {GROUP_ICONS[g]} {g}
              </button>
            ))}
          </div>

          {showShare && (
            <div style={{
              background: "#F0FFF4", border: "1.5px solid #2E9E5B", borderRadius: 14,
              padding: "14px 16px", marginBottom: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2E9E5B", marginBottom: 2 }}>✓ 訓練已儲存！</div>
                <div style={{ fontSize: 11, color: "#666" }}>分享今日訓練給 LINE 好友</div>
              </div>
              <button onClick={shareToLine} style={{
                background: "#06C755", border: "none", borderRadius: 10, color: "#fff",
                fontSize: 13, fontWeight: 700, padding: "10px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0,
              }}>● 分享 LINE</button>
            </div>
          )}

          {workouts.map((w, wi) => (
            <div key={wi} style={cardStyle}>
              <select value={w.exercise} onChange={e => updateExercise(wi, e.target.value)} style={{
                background: accentBg, border: `1.5px solid ${accent}33`, borderRadius: 8,
                color: accent, fontSize: 14, fontWeight: 700, padding: "8px 12px",
                width: "100%", marginBottom: 12, cursor: "pointer", outline: "none",
              }}>
                {exercises[selectedGroup]?.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>

              <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 30 }}>
                <div style={{ flex: 1, fontSize: 10, color: "#bbb", textAlign: "center", letterSpacing: "1px" }}>重量 (kg)</div>
                <div style={{ fontSize: 10, color: "#bbb", width: 14 }} />
                <div style={{ flex: 1, fontSize: 10, color: "#bbb", textAlign: "center", letterSpacing: "1px" }}>次數</div>
                <div style={{ width: 30 }} />
              </div>

              {w.sets.map((s, si) => (
                <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#ccc", fontSize: 11, minWidth: 22, textAlign: "center" }}>{si + 1}</span>
                  <input type="number" placeholder="—" value={s.weight} onChange={e => updateSet(wi, si, "weight", e.target.value)} style={inputStyle} />
                  <span style={{ color: "#ddd", fontSize: 14, flexShrink: 0 }}>×</span>
                  <input type="number" placeholder="—" value={s.reps} onChange={e => updateSet(wi, si, "reps", e.target.value)} style={inputStyle} />
                  <button onClick={() => removeSet(wi, si)} style={{ background: "transparent", border: "none", color: "#ddd", fontSize: 15, cursor: "pointer", padding: "4px 6px", flexShrink: 0 }}>✕</button>
                </div>
              ))}

              <button onClick={() => addSet(wi)} style={{
                background: "transparent", border: "1.5px dashed #e8e8e8", borderRadius: 8,
                color: "#bbb", fontSize: 12, padding: "8px 0", width: "100%", cursor: "pointer", marginTop: 4, letterSpacing: "1px",
              }}>+ 新增組數</button>
            </div>
          ))}

          <button onClick={addWorkout} style={{
            background: accentBg, border: `1.5px dashed ${accent}55`, borderRadius: 14,
            color: accent, fontSize: 13, padding: "14px 0", width: "100%",
            cursor: "pointer", fontWeight: 700, letterSpacing: "1px", marginBottom: 12,
          }}>+ 新增動作</button>

          {workouts.length > 0 && (
            <button onClick={saveToday} style={{
              background: accent, border: "none", borderRadius: 14, color: "#fff",
              fontSize: 14, fontWeight: 900, padding: "15px 0", width: "100%",
              cursor: "pointer", letterSpacing: "2px", boxShadow: `0 4px 16px ${accent}44`,
            }}>{saveMsg || "完成今日訓練"}</button>
          )}

          {workouts.length === 0 && !showShare && (
            <div style={{ textAlign: "center", padding: "50px 0 0", color: "#ddd" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{GROUP_ICONS[selectedGroup]}</div>
              <div style={{ fontSize: 11, letterSpacing: "2px", color: "#ccc" }}>點擊上方開始記錄</div>
            </div>
          )}
        </>)}

        {/* ── HISTORY ── */}
        {page === "history" && (<>
          <div style={{ display: "flex", gap: 7, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {["全部", ...Object.keys(exercises)].map(g => (
              <button key={g} onClick={() => setHistGroup(g)} style={historyFilterStyle(g, histGroup === g)}>
                {g === "全部" ? "全部" : `${GROUP_ICONS[g]} ${g}`}
              </button>
            ))}
          </div>

          {historyDays.length >= 1 ? historyDays.map(({ date, entries }) => {
            const grouped = groupEntriesByBodyPart(entries);
            const groups = Object.keys(grouped).sort((a, b) =>
              Object.keys(DEFAULT_EXERCISES).indexOf(a) - Object.keys(DEFAULT_EXERCISES).indexOf(b)
            );
            return (
              <div key={date} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: "2px", color: "#bbb", marginBottom: 4 }}>TRAINING LOG</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#222" }}>{formatDateFull(date)}</div>
                  </div>
                  <button onClick={() => deleteHistoryDate(date)} style={{
                    background: "#fff", border: "1px solid #f0d8d8", borderRadius: 8,
                    color: "#E8413A", fontSize: 12, fontWeight: 700, padding: "6px 10px",
                    cursor: "pointer", flexShrink: 0,
                  }}>刪除</button>
                </div>

                {groups.map((g, gi) => (
                  <div key={g} style={{
                    background: GROUP_BG[g], border: `1px solid ${GROUP_COLORS[g]}22`,
                    borderRadius: 12, padding: "12px 12px 2px", marginTop: gi === 0 ? 0 : 12,
                  }}>
                    <div style={{ color: GROUP_COLORS[g], fontSize: 13, fontWeight: 900, marginBottom: 10, letterSpacing: "0.5px" }}>
                      {formatDateFull(date)}｜{g}
                    </div>
                    {grouped[g].map((entry, ei) => {
                      const filledSets = entry.sets.filter(s => s.weight || s.reps);
                      return (
                        <div key={`${entry.exercise}-${ei}`} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#222", marginBottom: 4 }}>{entry.exercise}</div>
                          <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>總組數：{filledSets.length} 組</div>
                          {filledSets.map((s, si) => (
                            <div key={si} style={{ fontSize: 13, color: "#555", lineHeight: 1.8 }}>
                              第{si + 1}組：{s.weight ? `${s.weight}kg` : "-"} × {s.reps ? `${s.reps}次` : "-"}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          }) : (
            <div style={{ color: "#ddd", fontSize: 12, textAlign: "center", padding: "56px 0", letterSpacing: "1px" }}>尚無訓練紀錄</div>
          )}
        </>)}

        {/* ── MANAGE ── */}
        {page === "manage" && (<>
          <div style={{ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {Object.keys(exercises).map(g => (
              <button key={g} onClick={() => setManageGroup(g)} style={groupTabStyle(g, manageGroup === g)}>{g}</button>
            ))}
          </div>

          <div style={cardStyle}>
            {exercises[manageGroup]?.map((ex, i) => (
              <div key={ex} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 0", borderBottom: i < exercises[manageGroup].length - 1 ? "1px solid #f5f5f5" : "none",
              }}>
                <span style={{ fontSize: 14, color: "#333" }}>{ex}</span>
                <button onClick={() => removeExercise(manageGroup, ex)} style={{
                  background: "transparent", border: "none", color: "#ddd", fontSize: 16, cursor: "pointer", padding: "2px 8px",
                }}
                  onMouseOver={e => e.currentTarget.style.color = "#E8413A"}
                  onMouseOut={e => e.currentTarget.style.color = "#ddd"}
                >✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <input
                placeholder="新動作名稱"
                value={newEx[manageGroup] || ""}
                onChange={e => setNewEx(prev => ({ ...prev, [manageGroup]: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addExercise(manageGroup); }}
                style={{ flex: 1, background: "#f8f8f8", border: "1.5px solid #e8e8e8", borderRadius: 8, color: "#222", fontSize: 14, padding: "10px 12px", outline: "none" }}
              />
              <button onClick={() => addExercise(manageGroup)} style={{
                background: manAccent, border: "none", borderRadius: 8, color: "#fff",
                fontSize: 13, fontWeight: 800, padding: "10px 18px", cursor: "pointer", flexShrink: 0,
              }}>新增</button>
            </div>
          </div>

          {/* User info */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, letterSpacing: "2px", color: "#bbb", marginBottom: 12, textTransform: "uppercase" }}>帳號</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={user.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{user.displayName}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{user.email}</div>
              </div>
            </div>
          </div>
        </>)}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #f0f0f0",
        display: "flex", padding: "10px 0 20px", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
      }}>
        {[
          { key: "today", label: "今日訓練", icon: "⊕" },
          { key: "history", label: "歷史記錄", icon: "◈" },
          { key: "manage", label: "動作管理", icon: "≡" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setPage(tab.key)} style={{
            flex: 1, background: "transparent", border: "none",
            color: page === tab.key ? GROUP_COLORS[selectedGroup] : "#ccc",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0",
          }}>
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ fontSize: 9, letterSpacing: "0.5px", fontWeight: page === tab.key ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
