import { useState, useEffect, useCallback } from "react";

// ─── API Configuration ────────────────────────────────────────────────────────
const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8000";
const DB_KEY = "noamtrains_data_v4";

async function loadLocalDB() {
  try { const r = localStorage.getItem(DB_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return null;
}
async function saveLocalDB(data) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch (e) { console.error(e); }
}

const defaultData = { trainers: [], programs: [], sessions:[], savedSets: [] };

// ─── Utils ────────────────────────────────────────────────────────────────────
const COLORS = ["#2196F3","#1976D2","#00BCD4","#0097A7","#26A69A"];
const initials = t => (t.fname?.[0]||"")+(t.lname?.[0]||"");
const uid = () => Date.now().toString() + Math.floor(Math.random()*1000).toString();
const colorFor = id => {
  const num = typeof id === 'string' ? id.charCodeAt(id.length-1) : id;
  return COLORS[(num||0) % COLORS.length];
};

function getWeekRange() {
  const now=new Date(), d=now.getDay();
  const sun=new Date(now); sun.setDate(now.getDate()-d);
  const sat=new Date(sun); sat.setDate(sun.getDate()+6);
  return { sun:sun.toISOString().slice(0,10), sat:sat.toISOString().slice(0,10) };
}
const getWeekCount = (sessions,tid) => {
  const {sun,sat}=getWeekRange();
  return sessions.filter(s=>s.trainerId===tid&&s.date>=sun&&s.date<=sat).length;
};

// ─── Global Responsive CSS ────────────────────────────────────────────────────
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; overflow: hidden; background: #F0F4FF; }
  ::-webkit-scrollbar { width: 0.6vw; height: 0.6vw; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 1vh; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .main-spinner { width: 6vh; height: 6vh; border: 0.6vh solid rgba(21, 101, 192, 0.2); border-top-color: #1565C0; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 2vh; }
  .toast-spinner { width: 2.5vh; height: 2.5vh; border: 0.3vh solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; }

  @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 80% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1.3); opacity: 0; } }

  .mobile-logout-btn { display: none; }
  .hide-on-mobile { display: block; }
  .desktop-only { display: block; }
  .mobile-only { display: none; }

  @media (max-width: 768px) {
    .hide-on-mobile { display: none !important; }
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
    
    .app-layout { flex-direction: column-reverse !important; height: 100dvh !important; width: 100vw !important; overflow: hidden !important; }
    .sidebar { width: 100vw !important; height: auto !important; min-height: 8vh !important; padding: 1vh 0 calc(1vh + env(safe-area-inset-bottom)) 0 !important; flex-direction: row !important; justify-content: center !important; align-items: center !important; z-index: 100; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
    .sidebar-header { display: none !important; }
    .sidebar-nav { flex-direction: row !important; width: 100% !important; justify-content: space-around !important; align-items: center !important; padding: 0 1vw !important; gap: 0 !important; }
    .sidebar-item { flex-direction: column !important; gap: 0.5vh !important; padding: 1vh 0 !important; border-right: none !important; font-size: 3vw !important; justify-content: center !important; align-items: center !important; text-align: center; width: 23vw !important; border-radius: 1.5vh !important; }
    .sidebar-item span:first-child { font-size: 6vw !important; line-height: 1 !important; }
    .sidebar-item.active { background: rgba(255,255,255,0.2) !important; }
    .sidebar-logout { display: none !important; } 

    .page-header { position: relative !important; justify-content: center !important; align-items: center !important; min-height: 5vh !important; margin-bottom: 2.5vh !important; display: flex !important; }
    .page-title-container { display: flex; flex-direction: column; align-items: center; justify-content: center; max-width: 45vw; text-align: center; }
    .page-title { font-size: 2.4vh !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }
    .page-subtitle { font-size: 1.4vh !important; text-align: center; }
    .page-action-btn { position: absolute !important; left: 0; top: 50%; transform: translateY(-50%); display: flex; gap: 1vw; align-items: center; }
    .page-action-btn button { padding: 1vh 2vw !important; font-size: 1.4vh !important; }
    .mobile-logout-btn { display: flex !important; align-items: center; justify-content: center; position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: #d32f2f; color: #fff; border: none; font-size: 1.4vh; font-weight: 600; padding: 1vh 2vw; border-radius: 1vh; cursor: pointer; gap: 1vw; z-index: 10; }
    
    .main-pad { flex: 1 !important; height: auto !important; width: 100vw !important; padding: 2vh 4vw !important; overflow-y: auto !important; }
    .mob-stack { grid-template-columns: 1fr !important; display: flex !important; flex-direction: column !important; gap: 2vh !important; }
    .mob-grid-2 { grid-template-columns: 1fr 1fr !important; gap: 2vw !important; }
    .builder-grid { display: flex !important; flex-direction: column !important; gap: 2vh !important; }
    .exercise-row { flex-direction: column !important; align-items: stretch !important; gap: 1.5vh !important; }
    .exercise-inputs { grid-template-columns: 1fr 1fr !important; padding-right: 0 !important; gap: 1.5vh 2vw !important; }
    .exercise-inputs .full-w { grid-column: 1 / -1 !important; }
    .prog-card { flex-direction: column !important; align-items: stretch !important; gap: 2vh !important; }
    .prog-stats { margin-left: 0 !important; justify-content: space-between !important; width: 100% !important; }
    .prog-actions { justify-content: space-between !important; width: 100% !important; margin-top: 1vh; }
    .modal-box { width: 92vw !important; padding: 3vh 4vw !important; max-height: 85vh !important; }
    .modal-grid { grid-template-columns: 1fr !important; gap: 1.5vh !important; }
  }

  .trainee-wrapper { display: flex; justify-content: center; align-items: center; height: 100dvh; width: 100vw; background: #eef2f6; }
  .trainee-container { width: 100%; max-width: 450px; height: 100%; background: #ffffff; position: relative; display: flex; flex-direction: column; box-shadow: 0 0 30px rgba(0,0,0,0.05); overflow: hidden; }
  .trainee-content { flex: 1; overflow-y: auto; padding: 3vh 6vw; padding-bottom: 12vh; display: flex; flex-direction: column; background: #ffffff; }
  .trainee-top-bar { display: flex; justify-content: space-between; align-items: center; padding: 2vh 0 3vh 0; }
  .trainee-top-title { font-size: 2.4vh; font-weight: 800; color: #1a1a2e; }
  .trainee-top-icon { font-size: 2.8vh; color: #1565c0; cursor: pointer; }

  .trainee-nav-bar { position: absolute; bottom: 0; left: 0; right: 0; background: #ffffff; display: flex; justify-content: space-around; align-items: center; padding: 1.5vh 2vw calc(1.5vh + env(safe-area-inset-bottom)) 2vw; border-top: 1px solid #f0f0f0; z-index: 100; box-shadow: 0 -4px 20px rgba(0,0,0,0.02); }
  .t-nav-item { display: flex; flex-direction: column; align-items: center; gap: 0.5vh; color: #a0aec0; cursor: pointer; flex: 1; transition: 0.2s; }
  .t-nav-item.active { color: #1565C0; }
  .t-nav-icon { font-size: 2.6vh; }
  .t-nav-text { font-size: 1.3vh; font-weight: 600; }

  .big-play-btn-wrapper { position: relative; margin: 8vh auto 4vh auto; display: flex; justify-content: center; align-items: center; width: 26vh; height: 26vh; }
  .circle-ripple-1 { position: absolute; width: 100%; height: 100%; border-radius: 50%; animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite; }
  .circle-ripple-2 { position: absolute; width: 85%; height: 85%; border-radius: 50%; animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite; animation-delay: 0.5s; }
  .big-play-btn { position: relative; width: 70%; height: 70%; background: #29B6F6; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; box-shadow: 0 1vh 3vh rgba(41, 182, 246, 0.4); cursor: pointer; z-index: 2; transition: transform 0.1s; }
  .big-play-btn:active { transform: scale(0.95); }

  .program-day-tabs { display: flex; gap: 4vw; border-bottom: 2px solid #f0f4f8; margin-bottom: 3vh; overflow-x: auto; padding-bottom: 0.5vh; }
  .day-tab { padding: 1vh 2vw; font-size: 1.8vh; color: #a0aec0; cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: 0.2s; }
  .day-tab.active { color: #1565c0; font-weight: 700; border-bottom: 3px solid #1565c0; }

  /* אנימציית בלונים ליום הולדת */
  .balloon { position: absolute; bottom: -20vh; width: 5vh; height: 6.5vh; border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%; opacity: 0.85; animation: floatUp linear infinite; box-shadow: inset -0.5vh -0.5vh 1vh rgba(0,0,0,0.1); }
  .balloon::after { content: ''; position: absolute; bottom: -0.8vh; left: 50%; transform: translateX(-50%); width: 0.5vh; height: 1vh; background: inherit; }
  @keyframes floatUp { to { transform: translateY(-120vh) rotate(15deg); } }
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({trainer,size=36}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:colorFor(trainer?.id||"1"),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:600,fontSize:size*0.35,flexShrink:0,userSelect:"none"}}>{initials(trainer||{fname:"ד",lname:"ל"})}</div>;
}
function Btn({children,onClick,primary,danger,sm,disabled,full,style:s}){
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?"1vh 1.5vw":"1.5vh 2vw",borderRadius:"1vh",border:"none",cursor:disabled?"not-allowed":"pointer",fontSize:sm?"1.5vh":"1.7vh",fontWeight:600,fontFamily:"inherit",background:primary?"#2196F3":danger?"#fff0f0":"#f0f0f0",color:primary?"#fff":danger?"#e53935":"#333",transition:"all .15s",opacity:disabled?.6:1,width:full?"100%":"auto",...(s||{})}}>{children}</button>;
}
function Inp({label,style:s,...props}){
  return <div style={{marginBottom:"1.5vh"}}>
    {label&&<label style={{fontSize:"1.5vh",color:"#555",display:"block",marginBottom:"0.5vh",fontWeight:500}}>{label}</label>}
    <input style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box",...(s||{})}}
      onFocus={e=>!props.disabled && (e.target.style.borderColor="#2196F3")} onBlur={e=>!props.disabled && (e.target.style.borderColor="#e0e0e0")} {...props}/>
  </div>;
}
function Modal({open,onClose,title,children,wide}){
  if(!open) return null;
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl"}}>
    <div className="modal-box" style={{background:"#fff",borderRadius:"2vh",padding:"3vh 3vw",width:wide?"50vw":"35vw",minWidth:"300px",maxWidth:"96vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 2vh 6vh rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"2.5vh"}}>
        <span style={{fontSize:"2vh",fontWeight:700,color:"#1a1a2e"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:"2.5vh",cursor:"pointer",color:"#888"}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}
function FullScreenLoader({ text }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", position: "fixed", inset: 0, alignItems: "center", justifyContent: "center", background: "#F0F4FF", direction: "rtl", zIndex: 9999 }}>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div className="main-spinner"></div>
      <div style={{ color: "#1565C0", fontSize: "2vh", fontWeight: 600, fontFamily: "sans-serif" }}>{text}</div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await onLogin(identifier, password);
    if (!res.success) setError(res.error);
    setLoading(false);
  };

  return (
    <div style={{display:"flex", height:"100dvh", width:"100vw", position:"fixed", inset:0, overflow:"hidden", alignItems:"center", justifyContent:"center", background:"#F0F4FF", direction:"rtl", fontFamily:"sans-serif"}}>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div style={{background:"#fff", padding:"5vh 4vw", borderRadius:"3vh", boxShadow:"0 1vh 4vh rgba(21,101,192,0.1)", width:"85%", maxWidth:"400px", textAlign:"center", maxHeight:"90vh", overflowY:"auto"}}>
         <img src="/images/tab-image.png" alt="Logo" style={{ height: "15vh", width: "15vh", objectFit: "contain" }} />
        <h1 style={{fontSize:"3vh", fontWeight:700, color:"#1a1a2e", marginBottom:"1vh", margin:0}}>ברוך הבא</h1>
        <p style={{fontSize:"1.8vh", color:"#666", marginBottom:"4vh", marginTop:"1vh"}}>לא נשית איי - כניסה למערכת</p>
        <form onSubmit={submit} style={{display:"flex", flexDirection:"column", gap:"2.5vh"}}>
          <div style={{textAlign:"right"}}>
            <label style={{fontSize:"1.6vh", color:"#555", fontWeight:600, display:"block", marginBottom:"1vh"}}>שם משתמש / טלפון / אימייל</label>
            <input required value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{width:"100%", padding:"1.8vh 2vw", border:"1.5px solid #e0e0e0", borderRadius:"1.5vh", outline:"none", fontSize:"1.8vh", fontFamily:"inherit", boxSizing:"border-box", transition:"0.2s"}} onFocus={e=>e.target.style.borderColor="#1565C0"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} placeholder="הזן פרטי זיהוי" />
          </div>
          <div style={{textAlign:"right"}}>
            <label style={{fontSize:"1.6vh", color:"#555", fontWeight:600, display:"block", marginBottom:"1vh"}}>סיסמה</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%", padding:"1.8vh 2vw", border:"1.5px solid #e0e0e0", borderRadius:"1.5vh", outline:"none", fontSize:"1.8vh", fontFamily:"inherit", boxSizing:"border-box", transition:"0.2s"}} onFocus={e=>e.target.style.borderColor="#1565C0"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} placeholder="הזן סיסמה" />
          </div>
          {error && <div style={{color:"#d32f2f", background:"#ffebee", padding:"1.5vh", borderRadius:"1vh", fontSize:"1.6vh", fontWeight:600}}>{error}</div>}
          <button disabled={loading} type="submit" style={{background:"#1565C0", color:"#fff", border:"none", padding:"2vh", borderRadius:"1.5vh", fontSize:"2vh", fontWeight:700, cursor:loading?"not-allowed":"pointer", marginTop:"1.5vh", fontFamily:"inherit", transition:"0.2s", opacity:loading?0.7:1, width:"100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "1vw"}}>
            {loading ? <><div className="toast-spinner" style={{width: "2vh", height: "2vh", borderWidth: "0.2vh"}}></div> מתחבר...</> : "כניסה למערכת"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Trainee App (User UI) ────────────────────────────────────────────────────
function TraineeHome({ user, db, onLogout, setActiveTab, onAddSession }) {
  const firstName = user?.fname || "מתאמן";
  const program = db?.programs?.find(p => p.id === user?.programId);
  const totalSessions = program?.sessionsPerWeek || 0;

  const today = new Date().toISOString().slice(0, 10);
  const trainedToday = db?.sessions?.some(s => s.trainerId === user?.id && s.date === today);

  const {sun, sat} = getWeekRange();
  const sessionsThisWeek = db?.sessions?.filter(s => s.trainerId === user?.id && s.date >= sun && s.date <= sat).length || 0;
  const remaining = Math.max(0, totalSessions - sessionsThisWeek);

  return (
    <>
      <div className="trainee-top-bar">
        <div style={{display: "flex", alignItems: "center", gap: "2vw"}}>
        <img src="/images/tab-image.png" alt="Logo" style={{ height: "8vh", width: "8vh", objectFit: "contain" }} />
          {/* הוספת התו \u200F מבטיח שסימן הקריאה ישאר בצד שמאל בשפות RTL */}
          <div className="trainee-top-title">{"שלום " + firstName + "!\u200F"}</div>
        </div>
        <div onClick={onLogout} style={{color: "#d32f2f", cursor: "pointer", fontSize: "1.8vh", fontWeight: 600}}>🚪 יציאה</div>
      </div>

      {remaining === 0 && totalSessions > 0 ? (
        <div style={{background: "url('https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif') center/cover", borderRadius: "2vh", marginTop: "2vh", position: "relative", overflow: "hidden"}}>
            <div style={{background: "rgba(232, 245, 233, 0.85)", padding: "3.5vh 4vw", display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%"}}>
              <span style={{color: "#2e7d32", fontSize: "2.2vh", fontWeight: 800, textAlign: "center", textShadow: "0 1px 2px rgba(255,255,255,0.8)"}}>סיימת את כל האימונים שלך להשבוע תותח 🎉</span>
            </div>
        </div>
      ) : (
        <div style={{background: "#E1F5FE", borderRadius: "2vh", padding: "3.5vh 4vw", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2vh"}}>
          <div style={{display: "flex", flexDirection: "column", gap: "0.5vh"}}>
            <span style={{color: "#0277BD", fontSize: "1.8vh", fontWeight: 500}}>נותרו לך עוד</span>
            <div style={{display: "flex", alignItems: "baseline", gap: "1vw"}}>
              <span style={{color: "#0277BD", fontSize: "3.5vh", fontWeight: 800, lineHeight: 1}}>{remaining}</span>
              <span style={{color: "#0277BD", fontSize: "3.5vh", fontWeight: 800, lineHeight: 1}}>אימונים</span>
            </div>
            <span style={{color: "#0277BD", fontSize: "1.8vh", fontWeight: 500}}>לשבוע הקרוב</span>
          </div>
        <img src="images\calender.png" alt="Calendar" style={{height: "7vh", opacity: 0.8 , margin: "3vh"}} />
        </div>
      )}

      <div className="big-play-btn-wrapper">
        <div className="circle-ripple-1" style={trainedToday ? {background: "rgba(76, 175, 80, 0.15)"} : {background: "rgba(41, 182, 246, 0.15)"}}></div>
        <div className="circle-ripple-2" style={trainedToday ? {background: "rgba(76, 175, 80, 0.25)"} : {background: "rgba(41, 182, 246, 0.25)"}}></div>
        
        {trainedToday ? (
          <div className="big-play-btn" style={{background: "#4CAF50", boxShadow: "0 1vh 3vh rgba(76, 175, 80, 0.4)", cursor: "default", transform: "none"}}>
            <span style={{fontSize: "5vh"}}>💪</span>
            <span style={{fontSize: "2vh", fontWeight: 700, marginTop: "1vh"}}>יא ווסחאב</span>
          </div>
        ) : (
          <div className="big-play-btn" onClick={() => onAddSession(user.id)}>
            <span style={{fontSize: "5vh"}}>🏋️‍♂️</span>
            <span style={{fontSize: "2vh", fontWeight: 700, marginTop: "1vh"}}>יצאתי להתאמן</span>
          </div>
        )}
      </div>
    </>
  );
}

function TraineeProgram({ db, user, setActiveTab, onLogout }) {
  const [activeDay, setActiveDay] = useState(0);
  const program = db?.programs?.find(p => p.id === user?.programId) || { name: "תוכנית אימונים", days: [{ name: "יום 1", exercises: [] }] };
  const days = program.days || [];
  const exercises = days[activeDay]?.exercises || [];

  return (
    <>
      <div className="trainee-top-bar">
        <div className="trainee-top-icon" onClick={() => setActiveTab("home")}>➔</div>
        <div className="trainee-top-title">תוכנית אימונים</div>
        <div onClick={onLogout} style={{color: "#d32f2f", cursor: "pointer", fontSize: "1.8vh", fontWeight: 600}}>🚪 יציאה</div>
      </div>
      <div className="program-day-tabs">
        {days.map((d, i) => (
          <div key={i} className={`day-tab ${activeDay === i ? 'active' : ''}`} onClick={() => setActiveDay(i)}>{d.name || `יום ${i + 1}`}</div>
        ))}
      </div>
      <div style={{display: "flex", flexDirection: "column", gap: "2vh"}}>
        {exercises.length === 0 && <div style={{textAlign:"center", padding:"10vh 0", color:"#a0aec0"}}>אין תרגילים ביום זה</div>}
        {exercises.map((ex, i) => (
          <div key={ex.id || i} style={{display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", padding: "1.5vh 0", borderBottom: "1px solid #f0f4f8"}}>
            <div style={{display: "flex", alignItems: "center", gap: "3vw"}}>
              <div style={{width: "6vh", height: "6vh", background: "#f8f9fa", borderRadius: "1.5vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5vh", color: "#1565C0"}}>🏋️</div>
              <div style={{display: "flex", flexDirection: "column"}}>
                <span style={{fontSize: "1.8vh", fontWeight: 700, color: "#1a1a2e"}}>{ex.name}</span>
                <span style={{fontSize: "1.5vh", color: "#666", marginTop: "0.2vh"}}>{ex.sets && ex.reps ? `${ex.sets} סטים × ${ex.reps} חזרות` : ex.note || "לפי הצורך"}</span>
              </div>
            </div>
            <div style={{fontSize: "2.2vh", color: "#e2e8f0", fontWeight: 700}}>{i + 1}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function TraineeProfile({ user, db, setActiveTab, onLogout, onEditTrainer }) {
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const program = db?.programs?.find(p => p.id === user?.programId);
  
  return (
    <>
      <div className="trainee-top-bar">
        <div className="trainee-top-icon" onClick={() => setActiveTab("home")}>➔</div>
        <div className="trainee-top-title">הגדרות מתאמן</div>
        <div onClick={onLogout} style={{background: "#d32f2f", color: "#fff", padding: "0.8vh 2vw", borderRadius: "1vh", cursor: "pointer", fontSize: "1.6vh", fontWeight: 700}}>🚪 יציאה</div>
      </div>

      <div style={{background: "#F8FAFC", borderRadius: "2vh", padding: "2.5vh 4vw", display: "flex", alignItems: "center", gap: "4vw", marginBottom: "4vh"}}>
        <Avatar trainer={user} size={64}/>
        <div style={{display: "flex", flexDirection: "column", gap: "0.5vh"}}>
          <div style={{fontSize: "2.2vh", fontWeight: 700, color: "#1a1a2e"}}>{user.fname} {user.lname}</div>
          <div style={{fontSize: "1.5vh", color: "#64748b"}}>{user.phone}</div>
          {user.email && <div style={{fontSize: "1.5vh", color: "#64748b"}}>{user.email}</div>}
          {user.age && <div style={{fontSize: "1.5vh", color: "#64748b"}}>גיל: {user.age}</div>}
          {user.weight && <div style={{fontSize: "1.5vh", color: "#64748b"}}>משקל: {user.weight} ק״ג</div>}
        </div>
      </div>

      <div style={{marginBottom: "4vh"}}>
        <div style={{color: "#1565C0", fontSize: "1.8vh", fontWeight: 700, marginBottom: "2vh"}}>הגדרות שבועיות</div>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f4f8", paddingBottom: "1.5vh", marginBottom: "2vh"}}>
          <span style={{fontSize: "1.7vh", color: "#475569"}}>מספר אימונים בשבוע</span>
          <span style={{fontSize: "1.7vh", fontWeight: 600, color: "#1a1a2e"}}>{program?.sessionsPerWeek || "לא הוגדר בתוכנית"}</span>
        </div>
      </div>

      <div style={{marginBottom: "5vh"}}>
        <div style={{color: "#1565C0", fontSize: "1.8vh", fontWeight: 700, marginBottom: "2vh"}}>יעדים</div>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f4f8", paddingBottom: "1.5vh", marginBottom: "2vh"}}>
          <span style={{fontSize: "1.7vh", color: "#475569"}}>מטרה עיקרית</span>
          <span style={{fontSize: "1.7vh", fontWeight: 600, color: "#1a1a2e"}}>{user.goal || "עדיין לא הגדרת מטרה"}</span>
        </div>
      </div>

      <button onClick={() => setEditModalOpen(true)} style={{width: "100%", background: "#2196F3", color: "#fff", padding: "2vh", borderRadius: "1.5vh", border: "none", fontSize: "1.8vh", fontWeight: 700, cursor: "pointer"}}>עריכה</button>
      <TrainerModal open={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSave={onEditTrainer} initial={user} programs={db.programs} traineeMode={true} />
    </>
  );
}

function TraineeApp({ db, onLogout, onAddSession, onEditTrainer }) {
  const [activeTab, setActiveTab] = useState("home");
  const currentUserId = localStorage.getItem("fitcoach_userId");
  const currentUser = db?.trainers?.find(t => t.id === currentUserId) || db?.trainers?.[0] || { fname: "מתאמן", lname: "יקר" };

  // בדיקת יום הולדת (היום מול תאריך הלידה במסד הנתונים)
  const todayDate = new Date();
  const isBirthday = currentUser.birthDate && 
                     new Date(currentUser.birthDate).getMonth() === todayDate.getMonth() && 
                     new Date(currentUser.birthDate).getDate() === todayDate.getDate();
  
  const [showBdayPopup, setShowBdayPopup] = useState(isBirthday);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div className="trainee-wrapper">
        <div className="trainee-container">
          <div className="trainee-content">
            {activeTab === "home" && <TraineeHome user={currentUser} db={db} onLogout={onLogout} setActiveTab={setActiveTab} onAddSession={onAddSession} />}
            {activeTab === "program" && <TraineeProgram db={db} user={currentUser} setActiveTab={setActiveTab} onLogout={onLogout} />}
            {activeTab === "profile" && <TraineeProfile user={currentUser} db={db} setActiveTab={setActiveTab} onLogout={onLogout} onEditTrainer={onEditTrainer} />}
          </div>
          
          <div className="trainee-nav-bar">
            {[ { id: "profile", icon: "👤", label: "פרופיל" }, { id: "program", icon: "📋", label: "תוכנית אימונים" }, { id: "home", icon: "🏠", label: "בית" } ].map(tab => (
              <div key={tab.id} className={`t-nav-item ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                <span className="t-nav-icon">{tab.icon}</span><span className="t-nav-text">{tab.label}</span>
              </div>
            ))}
          </div>

          {/* מודל יום הולדת חגיגי למתאמן */}
          {showBdayPopup && (
             <div style={{position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.65)", overflow:"hidden", direction: "rtl"}}>
               
               {/* בלונים עפים מהתחתית באנימציית CSS טהורה */}
               {Array.from({length: 20}).map((_, i) => (
                 <div key={i} className="balloon" style={{
                   left: `${Math.random() * 100}vw`,
                   animationDuration: `${3 + Math.random() * 4}s`,
                   animationDelay: `${Math.random() * 2}s`,
                   backgroundColor: COLORS[i % COLORS.length]
                 }}></div>
               ))}
               
               {/* רקע זיקוקים שקוף קלות שאינו מפריע ללחיצות */}
               <div style={{position:"absolute", inset:0, background:"url('https://media.giphy.com/media/peAFQfg7Ol6IE/giphy.gif') center/cover", opacity:0.4, pointerEvents:"none"}}></div>

               <div style={{background:"#fff", padding:"4vh 6vw", borderRadius:"3vh", zIndex:10, textAlign:"center", maxWidth:"85vw", boxShadow:"0 2vh 5vh rgba(0,0,0,0.3)", position:"relative"}}>
                  <div style={{fontSize:"8vh", marginBottom:"2vh", textShadow:"0 1vh 2vh rgba(0,0,0,0.1)"}}>🎉🎂🎈</div>
                  <h2 style={{color:"#1565C0", fontSize:"2.8vh", fontWeight:800, marginBottom:"1vh", marginTop:0}}>היום זה יום מנוחה תותח!</h2>
                  <p style={{fontSize:"1.8vh", color:"#444", fontWeight:600, marginBottom:"3vh"}}>היום שום דבר מלבד בוטן וערק!</p>
                  <Btn primary full onClick={()=>setShowBdayPopup(false)} style={{fontSize:"1.8vh", padding:"1.5vh"}}>יאללה הולך לחגוג! 🍻</Btn>
               </div>
             </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Admin Dashboard Components ────────────────────────────────────────────────

// רכיב לוח שנה למחשב - מוקטן ומעוצב בתכלת ולבן
function DashboardCalendar({ db }) {
  const [modalDay, setModalDay] = useState(null);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  
  const pad = n => n<10?'0'+n:n;
  const monthNames = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const dayNames = ["א'","ב'","ג'","ד'","ה'","ו'","ש'"];

  const days = [];
  for(let i=0; i<startDay; i++) days.push(null);
  for(let i=1; i<=daysInMonth; i++) {
      const dateStr = `${year}-${pad(month+1)}-${pad(i)}`;
      const dSessions = db.sessions.filter(s => s.date === dateStr);
      const uIds = [...new Set(dSessions.map(s => s.trainerId))];
      const tList = uIds.map(id => db.trainers.find(t=>t.id===id)).filter(Boolean);
      days.push({ day: i, dateStr, count: tList.length, trainees: tList });
  }

  return (
      <div className="desktop-only" style={{background:"#fff", borderRadius:"2vh", padding:"2vh 3vw", boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)", marginTop:"2vh"}}>
          <div style={{display: "flex", alignItems: "center", gap: "1vw", marginBottom:"1.5vh"}}>
            <span style={{fontSize: "2.2vh"}}>📅</span>
            <span style={{fontSize:"1.8vh", fontWeight:700, color:"#1565C0"}}>{monthNames[month]} {year} - מעקב אימונים</span>
          </div>
          
          <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:"0.5vw", textAlign:"center"}}>
              {dayNames.map(d => <div key={d} style={{fontWeight:600, color:"#888", marginBottom:"0.5vh", fontSize:"1.4vh"}}>{d}</div>)}
              {days.map((dObj, idx) => {
                  const isToday = dObj?.dateStr === `${year}-${pad(month+1)}-${pad(now.getDate())}`;
                  const hasTrainers = dObj?.count > 0;
                  
                  return (
                    <div key={idx} 
                         onClick={() => hasTrainers && setModalDay(dObj)}
                         style={{
                             height:"5.5vh", 
                             background: !dObj ? "transparent" : (hasTrainers ? "#E1F5FE" : "#F8FAFC"), 
                             borderRadius:"1vh", display:"flex", alignItems:"center", justifyContent:"center",
                             cursor: hasTrainers ? "pointer" : "default",
                             border: isToday ? "2px solid #0277BD" : "1px solid transparent",
                             position: "relative", transition: "0.2s"
                         }}
                         onMouseEnter={e => { if(hasTrainers) e.currentTarget.style.background="#B3E5FC"; }}
                         onMouseLeave={e => { if(dObj) e.currentTarget.style.background=(hasTrainers ? "#E1F5FE" : "#F8FAFC"); }}
                    >
                        {dObj && <span style={{position:"absolute", top:"0.5vh", right:"0.8vh", fontSize:"1.2vh", color: hasTrainers ? "#0277BD" : "#aaa", fontWeight: 600}}>{dObj.day}</span>}
                        {hasTrainers && <div style={{background:"#0277BD", color:"#fff", width:"3vh", height:"3vh", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4vh", fontWeight:700, boxShadow:"0 0.5vh 1vh rgba(2,119,189,.2)"}}>{dObj.count}</div>}
                    </div>
                  );
              })}
          </div>
          
          <Modal open={!!modalDay} onClose={()=>setModalDay(null)} title={`התאמנו ב-${modalDay?.dateStr}`}>
              <div style={{display:"flex", flexDirection:"column", gap:"1.5vh", maxHeight:"40vh", overflowY:"auto"}}>
                  {modalDay?.trainees.map(t => (
                      <div key={t.id} style={{display:"flex", alignItems:"center", gap:"1vw", padding:"1.5vh", background:"#E1F5FE", borderRadius:"1.5vh"}}>
                          <Avatar trainer={t} size={40}/>
                          <span style={{fontWeight:600, fontSize:"1.7vh", color:"#0277BD"}}>{t.fname} {t.lname}</span>
                      </div>
                  ))}
              </div>
          </Modal>
      </div>
  );
}

// רכיב רשימה לפלאפון בלבד
function DashboardMobileTrainees({ db }) {
  const now = new Date();
  const pad = n => n<10?'0'+n:n;
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  
  const dSessions = db.sessions.filter(s => s.date === dateStr);
  const uIds = [...new Set(dSessions.map(s => s.trainerId))];
  const tList = uIds.map(id => db.trainers.find(t=>t.id===id)).filter(Boolean);

  return (
      <div className="mobile-only" style={{background:"#fff", borderRadius:"2vh", padding:"2.5vh 4vw", boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)", marginTop:"3vh"}}>
          <div style={{display: "flex", alignItems: "center", gap: "2vw", marginBottom:"2vh"}}>
            <span style={{fontSize: "2.5vh"}}>🔥</span>
            <span style={{fontSize:"2vh", fontWeight:700, color:"#1a1a2e"}}>התאמנו היום ({tList.length})</span>
          </div>
          {tList.length === 0 ? (
              <div style={{color:"#888", fontSize:"1.6vh", textAlign:"center", padding:"2vh 0"}}>אף אחד לא התאמן היום עדיין.</div>
          ) : (
              <div style={{display:"flex", flexDirection:"column", gap:"1.5vh"}}>
                  {tList.map(t => (
                      <div key={t.id} style={{display:"flex", alignItems:"center", gap:"3vw", padding:"1.5vh", background:"#f8f9fa", borderRadius:"1.5vh"}}>
                          <Avatar trainer={t} size={40}/>
                          <span style={{fontWeight:600, fontSize:"1.8vh", color:"#1a1a2e"}}>{t.fname} {t.lname}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );
}


// ─── Sidebar & Admin Layout ───────────────────────────────────────────────────
function Sidebar({page,setPage, onLogout}){
  const nav=[{id:"dashboard",icon:"🏠",label:"סקירה כללית"},{id:"trainers",icon:"👥",label:"מתאמנים"},{id:"programs",icon:"📋",label:"תוכניות אימון"},{id:"savedSets",icon:"🗂️",label:"תבניות וסטים"}];
  return <div className="sidebar" style={{width:"16vw",minWidth:"180px",flexShrink:0,background:"#1565C0",display:"flex",flexDirection:"column",paddingTop:"4vh"}}>
    <div className="sidebar-header" style={{textAlign:"center",marginBottom:"4vh",paddingBottom:"2vh",borderBottom:"1px solid rgba(255,255,255,.15)"}}>
      <img src="/images/tab-image.png" alt="Logo" style={{ height: "8vh", width: "8vh", objectFit: "contain" }} /><div style={{color:"#fff",fontWeight:700,fontSize:"2.2vh"}}>לא נשית איי</div>
    </div>
    <div className="sidebar-nav" style={{flex:1, display:"flex", flexDirection:"column", gap:"1vh", padding:"0 1vw"}}>
      {nav.map(n=><div key={n.id} className={`sidebar-item ${page===n.id?'active':''}`} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:"1vw",padding:"1.5vh 1.5vw",cursor:"pointer",color:page===n.id?"#fff":"rgba(255,255,255,.7)",background:page===n.id?"rgba(255,255,255,.15)":"transparent",borderRight:page===n.id?"0.3vw solid #fff":"0.3vw solid transparent",fontWeight:page===n.id?600:400,fontSize:"1.7vh",transition:"all .15s", borderRadius: page===n.id?"0 1.5vh 1.5vh 0":"0"}}>
        <span>{n.icon}</span><span>{n.label}</span>
      </div>)}
    </div>
    <div className="sidebar-logout" style={{padding:"2.5vh 1.5vw", borderTop:"1px solid rgba(255,255,255,.15)"}}>
      <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:"1vw",padding:"1.5vh 1.5vw",cursor:"pointer",color:"#fff", background:"#d32f2f", borderRadius:"1vh", fontSize:"1.7vh", fontWeight:600, transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="#b71c1c"} onMouseLeave={e=>e.currentTarget.style.background="#d32f2f"}>
        <span>🚪</span> התנתק
      </div>
    </div>
  </div>;
}

function Dashboard({db,onAddTrainer,onLogout}){
  const {trainers,sessions}=db;
  const totalWeek=sessions.filter(s=>{const{sun,sat}=getWeekRange();return s.date>=sun&&s.date<=sat;}).length;
  const avgPer=trainers.length?(totalWeek/trainers.length).toFixed(1):0;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>שלום מנהל! 👋</div><div className="page-subtitle" style={{color:"#666",fontSize:"1.8vh",marginTop:"0.5vh"}}>סקירת שבוע</div></div><div className="page-action-btn"><Btn primary onClick={onAddTrainer}>+ הוסף</Btn></div></div>
    
    <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5vw"}}>
      {[{label:"סך אימונים השבוע",value:totalWeek,unit:"אימונים"},{label:"מתאמנים פעילים",value:trainers.length,unit:"מתאמנים"},{label:"ממוצע למתאמן",value:avgPer,unit:"אימונים לשבוע"}].map((s,i)=><div key={i} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh 2.5vw",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.08)"}}><div style={{fontSize:"1.6vh",color:"#888",marginBottom:"1.5vh",textAlign:"right"}}>{s.label}</div><div style={{display:"flex",alignItems:"flex-end",gap:"0.5vw",justifyContent:"flex-end"}}><div style={{fontSize:"4.5vh",fontWeight:700,color:"#1565C0",lineHeight:1}}>{s.value}</div><div style={{fontSize:"1.6vh",color:"#888",paddingBottom:"0.5vh"}}>{s.unit}</div></div></div>)}
    </div>

    {/* הלוח המפוצל - פלאפון מול מחשב */}
    <DashboardCalendar db={db} />
    <DashboardMobileTrainees db={db} />

  </div>;
}

function TrainersPage({db,onAdd,onDelete,onEdit,onLogout}){
  const {trainers,sessions,programs}=db;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>מתאמנים</div></div><div className="page-action-btn"><Btn primary onClick={onAdd}>+ הוסף מתאמן</Btn></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:"1.5vw"}}>
      {trainers.map(t=>{
        const prog=t.programId?programs.find(p=>p.id===t.programId):null;
        const wc=getWeekCount(sessions,t.id); const freq=prog?.sessionsPerWeek||0; const pct=freq?Math.min(Math.round(wc/freq*100),100):0;
        return <div key={t.id} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}><Avatar trainer={t} size={44}/><div><div style={{fontWeight:600,fontSize:"1.9vh",color:"#1a1a2e"}}>{t.fname} {t.lname} {t.age?`(${t.age})`:''}</div><div style={{fontSize:"1.5vh",color:"#888",marginTop:"0.5vh"}}>{t.phone}</div></div></div>
          <div style={{fontSize:"1.5vh",color:"#666",marginBottom:"0.5vh"}}>🎯 {t.goal||"לא הוגדר"}</div>
          <div style={{fontSize:"1.5vh",color:"#1565C0",marginBottom:"1.5vh",fontWeight:600}}>📋 {prog?`${prog.name}`:"❌ ללא תוכנית אימון"}</div>
          {freq>0&&<><div style={{display:"flex",justifyContent:"space-between",fontSize:"1.5vh",marginBottom:"0.5vh"}}><span style={{color:"#888"}}>אימונים השבוע</span><span style={{fontWeight:600,color:"#1565C0"}}>{wc}/{freq}</span></div><div style={{background:"#f0f0f0",borderRadius:"1vh",height:"1vh",overflow:"hidden",marginBottom:"2vh"}}><div style={{width:pct+"%",height:"100%",borderRadius:"1vh",background:pct>=100?"#4CAF50":pct>=60?"#2196F3":"#FF9800"}}/></div></>}
          <div style={{display:"flex",gap:"0.5vw"}}><Btn sm full onClick={()=>onEdit(t)}>✏️ עריכה</Btn><Btn sm full danger onClick={()=>onDelete(t.id)}>🗑️ מחיקה</Btn></div>
        </div>;
      })}
      {!trainers.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"10vh 0",color:"#bbb"}}><div style={{fontSize:"6vh",marginBottom:"2vh"}}>👥</div><div style={{fontSize:"2vh"}}>אין מתאמנים עדיין</div></div>}
    </div>
  </div>;
}

function SavedSetsPage({db,onAdd,onEdit,onDelete,onLogout}){
  const {savedSets}=db;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>תבניות וסטים שמורים</div><div className="page-subtitle" style={{fontSize:"1.7vh",color:"#666",marginTop:"0.5vh"}}>צור תבניות מוכנות מראש לשילוב מהיר</div></div><div className="page-action-btn"><Btn primary onClick={onAdd}>+ תבנית חדשה</Btn></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1.5vw"}}>
      {savedSets.map(s=>( <div key={s.id} onClick={()=>onEdit(s)} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",cursor:"pointer",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)",borderRight:"0.5vw solid #00BCD4"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5vh"}}><div style={{fontSize:"2vh",fontWeight:700,color:"#1a1a2e"}}>{s.name}</div><button onClick={(e)=>{e.stopPropagation(); onDelete(s.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:"1vh",width:"4vh",height:"4vh",cursor:"pointer"}}>🗑</button></div><div style={{fontSize:"1.7vh",color:"#666",marginBottom:"2vh"}}>{s.exercises?.length||0} תרגילים בסט</div><div style={{display:"flex",flexWrap:"wrap",gap:"0.5vw"}}>{s.exercises?.slice(0,3).map(e=><span key={e.id} style={{background:"#f5f5f5",padding:"0.5vh 1vw",borderRadius:"1vh",fontSize:"1.4vh",color:"#555"}}>{e.name}</span>)}{s.exercises?.length>3&&<span style={{background:"#e3f2fd",padding:"0.5vh 1vw",borderRadius:"1vh",fontSize:"1.4vh",color:"#1565C0"}}>+{s.exercises.length-3}</span>}</div></div> ))}
    </div>
  </div>;
}

function SavedSetBuilder({setObj:initSet, savedSets, onSave, onCancel, onLogout}){
  const isNew = !initSet;
  const blankSet = {name:"", exercises:[]};
  const [prog, setProg] = useState(isNew ? blankSet : {...initSet, exercises:initSet.exercises?.map(e=>({...e}))||[]});
  const updExercises = exs => setProg(p=>({...p, exercises:exs}));
  const addExercise = () => updExercises([...prog.exercises, {id:Date.now(),name:"",sets:3,reps:10,rest:60,note:""}]);
  const removeExercise = id => updExercises(prog.exercises.filter(e=>e.id!==id));
  const updExercise = (id,patch) => updExercises(prog.exercises.map(e=>e.id===id?{...e,...patch}:e));
  const moveEx = (idx,dir) => { const exs=[...prog.exercises]; const to=idx+dir; if(to<0||to>=exs.length) return; [exs[idx],exs[to]]=[exs[to],exs[idx]]; updExercises(exs); };
  const isDuplicateName = savedSets.some(s => s.name.trim() === prog.name.trim() && s.id !== prog.id);
  const valid = prog.name.trim() && prog.exercises.length > 0 && prog.exercises.every(e => e.name.trim()) && !isDuplicateName;

  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תבנית חדשה":"✏️ עריכת תבנית"}</div></div><div className="page-action-btn" style={{display:"flex",alignItems:"center",gap:"1vw"}}><Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0"}}>ביטול</Btn><Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור</Btn></div></div>
    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",marginBottom:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}><label style={{fontSize:"1.5vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>שם התבנית / סט</label><input style={{width:"100%",maxWidth:"40vw",minWidth:"250px",padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontFamily:"inherit"}} value={prog.name} onChange={e=>setProg({...prog,name:e.target.value})}/></div>
    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh", paddingBottom:"2vh", borderBottom:"1px solid #f0f0f0"}}><div style={{fontSize:"2.2vh",fontWeight:700,color:"#1a1a2e"}}>תרגילים בסט</div><Btn primary onClick={addExercise}>+ הוסף תרגיל</Btn></div>
      {prog.exercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:"1.5vh",padding:"2vh",marginBottom:"2vh",border:"1px solid #e0e0e0", boxShadow:"0 0.5vh 1.5vh rgba(0,0,0,0.04)"}}><div className="exercise-row" style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}><div style={{display:"flex",flexDirection:"row",gap:"0.5vw"}}><div style={{background:"#e0f7fa",color:"#0097a7",borderRadius:"1vh",width:"3.5vh",height:"3.5vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5vh",fontWeight:700}}>{i+1}</div><button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888", fontSize:"1.8vh"}}>▲</button><button onClick={()=>moveEx(i,1)} disabled={i===prog.exercises.length-1} style={{background:"none",border:"none",cursor:i===prog.exercises.length-1?"default":"pointer",color:i===prog.exercises.length-1?"#ddd":"#888", fontSize:"1.8vh"}}>▼</button></div><input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontWeight:600}}/><button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"2vh"}}>🗑</button></div><div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"repeat(3, 8vw) 1fr",gap:"1vw",paddingRight:"4vw"}}>{[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0}].map(f=><div key={f.key}><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>{f.label}</label><input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}}/></div>)}<div className="full-w"><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}} placeholder="דגשים..."/></div></div></div>)}
    </div>
  </div>;
}

function ProgramBuilder({program:initProg, programs, savedSets, onSave, onCancel, onLogout}){
  const isNew=!initProg;
  const blankProg={name:"",desc:"",level:"בינוני",sessionsPerWeek:3,days:[], importedSetIds:[]};
  const [prog,setProg]=useState(isNew?blankProg:{...initProg, importedSetIds: initProg.importedSetIds||[], days:initProg.days?.map(d=>({...d,exercises:d.exercises?.map(e=>({...e}))}))||[]});
  const [selDay,setSelDay]=useState(0);
  const [importModalOpen, setImportModalOpen]=useState(false);

  const upd=patch=>setProg(p=>({...p,...patch}));
  const addDay=()=>{ const n={id:Date.now(),name:`יום ${prog.days.length+1}`,exercises:[]}; setProg(p=>({...p,days:[...p.days,n]})); setSelDay(prog.days.length); };
  const removeDay=idx=>{ setProg(p=>({...p,days:p.days.filter((_,i)=>i!==idx)})); setSelDay(s=>Math.max(0,s-(s>=idx?1:0))); };
  const renameDay=(idx,name)=>setProg(p=>({...p,days:p.days.map((d,i)=>i===idx?{...d,name}:d)}));
  const dayExercises=prog.days[selDay]?.exercises||[];
  const updExercises=exs=>setProg(p=>({...p,days:p.days.map((d,i)=>i===selDay?{...d,exercises:exs}:d)}));
  const addExercise=()=>updExercises([...dayExercises,{id:Date.now(),name:"",sets:3,reps:10,rest:60,weight:"",note:""}]);
  
  const importSavedSet = (setId) => {
    if (prog.importedSetIds?.includes(setId)) return; 
    const setToImport = savedSets.find(s => s.id === setId);
    if(!setToImport) return;
    const importedExercises = setToImport.exercises.map(ex => ({ ...ex, id: Date.now() + Math.floor(Math.random() * 10000), weight: "" }));
    setProg(p => { const newDays = p.days.map((d,i)=>i===selDay?{...d,exercises:[...d.exercises, ...importedExercises]}:d); return { ...p, days: newDays, importedSetIds: [...(p.importedSetIds||[]), setId] }; });
    setImportModalOpen(false);
  };
  const removeExercise=id=>updExercises(dayExercises.filter(e=>e.id!==id));
  const updExercise=(id,patch)=>updExercises(dayExercises.map(e=>e.id===id?{...e,...patch}:e));
  const moveEx=(idx,dir)=>{ const exs=[...dayExercises]; const to=idx+dir; if(to<0||to>=exs.length) return; [exs[idx],exs[to]]=[exs[to],exs[idx]]; updExercises(exs); };

  const daysHaveExercises = prog.days.length > 0 && prog.days.every(d => d.exercises && d.exercises.length > 0);
  const daysMatchConfig = prog.days.length === Number(prog.sessionsPerWeek);
  const isDuplicateName = programs.some(p => p.name.trim() === prog.name.trim() && p.id !== prog.id);
  const valid = prog.name.trim() && daysHaveExercises && daysMatchConfig && !isDuplicateName;
  const inputStyle={width:"100%",padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תוכנית חדשה":"✏️ עריכת תוכנית"}</div></div><div className="page-action-btn" style={{display:"flex",alignItems:"center",gap:"1vw"}}><Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0",color:"#555"}}>ביטול</Btn><Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור</Btn></div></div>
    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",marginBottom:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
      <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"1.5fr 2fr 1fr 1fr",gap:"1.5vw"}}>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>שם התוכנית</label><input style={{...inputStyle}} value={prog.name} onChange={e=>upd({name:e.target.value})}/></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>תיאור</label><input style={inputStyle} value={prog.desc} onChange={e=>upd({desc:e.target.value})}/></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>רמת קושי</label><select style={{...inputStyle, background:"#fff"}} value={prog.level} onChange={e=>upd({level:e.target.value})}>{["מתחיל","בינוני","מתקדם"].map(l=><option key={l}>{l}</option>)}</select></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>אימונים בשבוע</label><input style={inputStyle} type="number" min={1} max={7} value={prog.sessionsPerWeek} onChange={e=>upd({sessionsPerWeek:Number(e.target.value)})}/></div>
      </div>
    </div>
    <div className="builder-grid" style={{display:"grid",gridTemplateColumns:"20vw 1fr",gap:"2vw",alignItems:"start"}}>
      <div style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"2vh"}}><div style={{fontSize:"1.7vh",fontWeight:600,color:"#555"}}>ימי האימון</div><div style={{fontSize:"1.5vh",color:prog.days.length===Number(prog.sessionsPerWeek)?"#4CAF50":"#d32f2f",fontWeight:600}}>{prog.days.length} / {prog.sessionsPerWeek}</div></div>
        <div className="mob-grid-2" style={{display:"grid", gap:"1.5vh"}}>
          {prog.days.map((d,i)=><div key={d.id} style={{display:"flex",alignItems:"center",gap:"0.5vw"}}><div onClick={()=>setSelDay(i)} style={{flex:1,padding:"1.5vh 1.5vw",borderRadius:"1vh",cursor:"pointer",background:selDay===i?"#E3F2FD":"#f8f9fa",border:selDay===i?"0.2vw solid #2196F3":"0.2vw solid transparent",fontSize:"1.6vh",fontWeight:selDay===i?600:500,color:selDay===i?"#1565C0":"#444"}}>{d.name||`יום ${i+1}`}</div><button onClick={()=>removeDay(i)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"1.8vh"}}>✕</button></div>)}
        </div>
        <Btn full onClick={addDay} disabled={prog.days.length>=7} style={{background:"#f0f4ff", color:"#1565C0", border:"0.2vw dashed #90CAF9", marginTop:"2vh"}}>+ הוסף יום</Btn>
      </div>
      {prog.days[selDay]?<div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh", paddingBottom:"2vh", borderBottom:"1px solid #f0f0f0"}}><div><input value={prog.days[selDay].name} onChange={e=>renameDay(selDay,e.target.value)} style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e",border:"none",outline:"none",background:"transparent",fontFamily:"inherit",direction:"rtl", width:"100%"}} placeholder="שם היום"/></div><div style={{display:"flex", gap:"1vw"}}><Btn style={{background:"#e0f7fa", color:"#0097a7"}} onClick={()=>setImportModalOpen(true)}>📥 ייבא סט</Btn><Btn primary onClick={addExercise}>+ תרגיל</Btn></div></div>
        {dayExercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:"1.5vh",padding:"2vh",marginBottom:"2vh",border:"1px solid #e0e0e0", boxShadow:"0 0.5vh 1.5vh rgba(0,0,0,0.04)"}}><div className="exercise-row" style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}><div style={{display:"flex",flexDirection:"row",gap:"0.5vw"}}><div style={{background:"#e3f2fd",color:"#1565c0",borderRadius:"1vh",width:"3.5vh",height:"3.5vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5vh",fontWeight:700,flexShrink:0}}>{i+1}</div><button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888",fontSize:"1.8vh"}}>▲</button><button onClick={()=>moveEx(i,1)} disabled={i===dayExercises.length-1} style={{background:"none",border:"none",cursor:i===dayExercises.length-1?"default":"pointer",color:i===dayExercises.length-1?"#ddd":"#888",fontSize:"1.8vh"}}>▼</button></div><input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontFamily:"inherit",fontWeight:600}}/><button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"2vh"}}>🗑</button></div><div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"repeat(4, 7vw) 1fr",gap:"1vw",paddingRight:"4vw"}}>{[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0},{label:"משקל",key:"weight",type:"number",min:0}].map(f=><div key={f.key}><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh",whiteSpace:"nowrap"}}>{f.label}</label><input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}}/></div>)}<div className="full-w"><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}} placeholder="דגשים..."/></div></div></div>)}
      </div>:<div style={{background:"#fff",borderRadius:"2vh",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"50vh",color:"#bbb",flexDirection:"column",gap:"2vh"}}><div style={{fontSize:"6vh"}}>📋</div><div style={{fontSize:"2vh", fontWeight:500}}>בחר יום מהרשימה</div></div>}
    </div>
    <Modal open={importModalOpen} onClose={()=>setImportModalOpen(false)} title="בחר תבנית לייבוא">
      <div style={{display:"flex",flexDirection:"column",gap:"1.5vh", maxHeight:"50vh", overflowY:"auto"}}>
        {savedSets.map(s=>{ const alreadyImported = prog.importedSetIds?.includes(s.id); return ( <div key={s.id} onClick={()=>!alreadyImported && importSavedSet(s.id)} style={{background:alreadyImported?"#f0f0f0":"#f8f9fa",opacity:alreadyImported ? 0.6 : 1,padding:"2vh 2vw",borderRadius:"1.5vh",cursor:alreadyImported?"not-allowed":"pointer",border:alreadyImported?"1px solid #ddd":"1px solid #e0e0e0",transition:"background 0.2s"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:600,fontSize:"1.8vh",color:alreadyImported?"#888":"#1a1a2e"}}>{s.name}</div><div style={{fontSize:"1.5vh",color:"#666",marginTop:"0.5vh"}}>{s.exercises.length} תרגילים בסט</div></div>{alreadyImported && <span style={{background:"#e0e0e0",color:"#777",padding:"0.5vh 1vw",borderRadius:"1vh",fontSize:"1.3vh",fontWeight:600}}>כבר יובא</span>}</div></div>)})}
      </div>
    </Modal>
  </div>;
}

function ProgramsPage({db,onAdd,onEdit,onDelete,onAssign,onLogout}){
  const {programs, trainers}=db;
  const [assignModalProg, setAssignModalProg] = useState(null);
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><button className="mobile-logout-btn" onClick={onLogout}>🚪 התנתק</button><div className="page-title-container"><div className="page-title" style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>תוכניות אימון</div></div><div className="page-action-btn"><Btn primary onClick={onAdd}>+ תוכנית</Btn></div></div>
    <div style={{display:"flex",flexDirection:"column",gap:"2vh"}}>
      {programs.map(p=>( <div key={p.id} className="prog-card" onClick={()=>onEdit(p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:"2vh",padding:"2.5vh 3vw",cursor:"pointer",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)",borderRight:"0.5vw solid #2196F3"}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"1vh"}}><div style={{fontSize:"2.2vh",fontWeight:700,color:"#1a1a2e"}}>{p.name}</div><span style={{background:"#e3f2fd",color:"#1565C0",padding:"0.5vh 1.5vw",borderRadius:"1.5vh",fontSize:"1.4vh",fontWeight:600}}>{p.level}</span></div><div style={{fontSize:"1.6vh",color:"#666"}}>{p.desc||"ללא תיאור"}</div></div><div className="prog-stats" style={{display:"flex",alignItems:"center",gap:"4vw",marginLeft:"3vw"}}><div style={{textAlign:"center"}}><div style={{fontSize:"2.5vh",fontWeight:700,color:"#1565C0"}}>{p.sessionsPerWeek}</div><div style={{fontSize:"1.4vh",color:"#888"}}>אימונים/שבוע</div></div><div style={{textAlign:"center"}}><div style={{fontSize:"2.5vh",fontWeight:700,color:"#1565C0"}}>{p.days?.length||0}</div><div style={{fontSize:"1.4vh",color:"#888"}}>ימים</div></div></div><div className="prog-actions" style={{display:"flex",alignItems:"center",gap:"1vw"}}><Btn sm onClick={(e)=>{e.stopPropagation(); setAssignModalProg(p);}} style={{background:"#e3f2fd",color:"#1565C0"}}>🔗 שיוך</Btn><button onClick={(e)=>{e.stopPropagation(); onDelete(p.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:"1vh",width:"5vh",height:"5vh",fontSize:"2vh",cursor:"pointer"}}>🗑</button></div></div> ))}
    </div>
    <Modal open={!!assignModalProg} onClose={()=>setAssignModalProg(null)} title={`שיוך: ${assignModalProg?.name}`}>
      <div style={{display:"flex",flexDirection:"column",gap:"1.5vh", maxHeight:"40vh", overflowY:"auto", paddingRight:"1vw"}}>{trainers.map(t=>(<label key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.5vh 2vw",background:"#f8f9fa",borderRadius:"1.5vh",cursor:"pointer",border:"1px solid #e0e0e0"}}><div style={{display:"flex",alignItems:"center",gap:"1vw"}}><Avatar trainer={t} size={32}/><span style={{fontSize:"1.7vh",fontWeight:500,color:"#1a1a2e"}}>{t.fname} {t.lname}</span></div><input type="checkbox" checked={t.programId === assignModalProg?.id} onChange={e => onAssign(t.id, e.target.checked ? assignModalProg.id : null)} style={{width:"2.5vh",height:"2.5vh",cursor:"pointer",accentColor:"#2196F3"}}/></label>))}</div>
      <div style={{marginTop:"3vh"}}><Btn primary full onClick={()=>setAssignModalProg(null)}>סיום ושמירה</Btn></div>
    </Modal>
  </div>;
}

function TrainerModal({open,onClose,onSave,initial,programs,traineeMode}){
  const blank={fname:"",lname:"",email:"",phone:"",password:"",weight:"",goal:"",programId:null,birthDate:"",age:""};
  const [form,setForm]=useState(blank);
  useEffect(()=>{ if(open) setForm(initial ? {...initial} : blank); },[open, initial]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  
  const calculateAge = (dob) => {
    if (!dob) return "";
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const hebrewRegex = /^[\u0590-\u05EA\s]+$/; 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
  const phoneRegex = /^\d{10}$/; 

  const isFnameValid = form.fname?.trim().length > 0 && hebrewRegex.test(form.fname.trim());
  const isLnameValid = form.lname?.trim().length > 0 && hebrewRegex.test(form.lname.trim());
  const isEmailValid = form.email?.trim().length > 0 && emailRegex.test(form.email.trim());
  const isPasswordValid = form.password && form.password.length >= 8;
  const isPhoneValid = form.phone?.trim().length > 0 && phoneRegex.test(form.phone.trim());

  const valid = (traineeMode ? true : (isFnameValid && isLnameValid && isEmailValid && isPhoneValid)) && isPasswordValid;

  let errorMsg = "";
  if (!form.password || form.password.length < 8) errorMsg = "הסיסמה חייבת להכיל לפחות 8 תווים";
  else if (!traineeMode) {
    if (!form.fname?.trim() || !form.lname?.trim()) errorMsg = "יש למלא שם פרטי ושם משפחה (שדות חובה)";
    else if (!hebrewRegex.test(form.fname.trim()) || !hebrewRegex.test(form.lname.trim())) errorMsg = "שם פרטי ושם משפחה חייבים להכיל אותיות בעברית בלבד";
    else if (!form.email?.trim() || !emailRegex.test(form.email.trim())) errorMsg = "יש להזין אימייל תקין (שדה חובה)";
    else if (!form.phone?.trim() || !phoneRegex.test(form.phone.trim())) errorMsg = "הטלפון חייב להכיל בדיוק 10 ספרות, ללא מקפים";
  }

  const currentProgramName = form.programId ? programs.find(p=>p.id===form.programId)?.name : null;

  return <Modal open={open} onClose={onClose} title={initial?"עריכת פרטים":"הוספת מתאמן חדש"}>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="שם פרטי *" value={form.fname} onChange={e=>set("fname",e.target.value)} placeholder="עברית בלבד" disabled={traineeMode} style={{background: traineeMode ? "#f5f5f5" : "transparent", color: traineeMode ? "#888" : "inherit"}}/>
      <Inp label="שם משפחה *" value={form.lname} onChange={e=>set("lname",e.target.value)} placeholder="עברית בלבד" disabled={traineeMode} style={{background: traineeMode ? "#f5f5f5" : "transparent", color: traineeMode ? "#888" : "inherit"}}/>
    </div>
    
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="תאריך לידה" type="date" value={form.birthDate||""} onChange={e=>{
          const val = e.target.value; setForm(f=>({...f, birthDate: val, age: calculateAge(val)}));
      }} disabled={!!initial} style={{background: initial ? "#f5f5f5" : "transparent", color: initial ? "#888" : "inherit"}} />
      <Inp label="גיל" type="number" value={form.age||""} readOnly disabled style={{background: "#f5f5f5", color: "#888"}} />
    </div>

    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="אימייל *" type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} disabled={traineeMode} style={{background: traineeMode ? "#f5f5f5" : "transparent", color: traineeMode ? "#888" : "inherit"}}/>
      <Inp label="טלפון *" value={form.phone||""} onChange={e=>set("phone",e.target.value)} disabled={traineeMode} style={{background: traineeMode ? "#f5f5f5" : "transparent", color: traineeMode ? "#888" : "inherit"}}/>
    </div>

    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="סיסמה *" type="password" value={form.password||""} onChange={e=>set("password",e.target.value)} placeholder="לפחות 8 תווים"/>
      <Inp label="משקל - ק״ג" type="number" value={form.weight||""} onChange={e=>set("weight",e.target.value)} placeholder="אופציונלי"/>
    </div>
    
    {!traineeMode ? (
        <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
          <Inp label="מטרת אימון" value={form.goal||""} onChange={e=>set("goal",e.target.value)} placeholder="אופציונלי"/>
          <div>
            <label style={{fontSize:"1.5vh",color:"#666",display:"block",marginBottom:"0.5vh",fontWeight:500}}>תוכנית משויכת</label>
            <div style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",background:"#f5f5f5",color:currentProgramName?"#1565C0":"#888",fontWeight:currentProgramName?600:400,fontFamily:"inherit"}}>
              {currentProgramName ? `📋 ${currentProgramName}` : "❌ ללא תוכנית"}
            </div>
          </div>
        </div>
    ) : (
        <Inp label="מטרת אימון" value={form.goal||""} onChange={e=>set("goal",e.target.value)} placeholder="למשל: חיטוב, עליה במסת שריר..."/>
    )}

    {!valid && errorMsg && <div style={{color:"#d32f2f",fontSize:"1.4vh",fontWeight:600,marginTop:"1.5vh",textAlign:"center",background:"#ffebee",padding:"1vh",borderRadius:"1vh"}}>{errorMsg}</div>}
    <div style={{display:"flex",gap:"1vw",marginTop:"3vh"}}><Btn primary disabled={!valid} full onClick={()=>{ onSave({...form, goal: form.goal?.trim()}); onClose(); }}>{initial?"שמור":"הוסף מתאמן"}</Btn><Btn full onClick={onClose}>ביטול</Btn></div>
  </Modal>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(){
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [db,setDb]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [modal,setModal]=useState(null);
  const [editTarget,setEditTarget]=useState(null);
  const [programBuilderTarget,setProgramBuilderTarget]=useState(null);
  const [savedSetBuilderTarget, setSavedSetBuilderTarget]=useState(null);

  useEffect(()=>{ 
    const token = localStorage.getItem("fitcoach_token");
    const savedRole = localStorage.getItem("fitcoach_role");
    if (token) { setIsAuthenticated(true); setRole(savedRole); } 
    else { setAuthChecking(false); setLoading(false); }
  },[]);

  useEffect(()=>{ 
    if(!isAuthenticated) return;
    setLoading(true);
    async function initApp() {
      try {
        const [progRes, trainRes, sessRes, setsRes] = await Promise.all([
          fetch(`${API_URL}/programs`), fetch(`${API_URL}/trainers`), fetch(`${API_URL}/sessions`), fetch(`${API_URL}/saved_sets`)
        ]);
        if(progRes.ok && trainRes.ok && sessRes.ok && setsRes.ok){
          const programs = await progRes.json(); const trainers = await trainRes.json(); const sessions = await sessRes.json(); const savedSets = await setsRes.json();
          const normalize = arr => arr.map(obj => ({ ...obj, id: obj._id || obj.id }));
          setDb({ programs: normalize(programs), trainers: normalize(trainers), sessions: normalize(sessions), savedSets: normalize(savedSets) });
        }
      } catch (error) {
        console.warn("Backend down. Loading local fallback.");
        const localData = await loadLocalDB(); setDb(localData || defaultData);
      }
      setLoading(false); setAuthChecking(false);
    }
    initApp();
  },[isAuthenticated]);

  const handleLogin = async (identifier, password) => {
    try {
      const res = await fetch(`${API_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() }) });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("fitcoach_token", data.token); localStorage.setItem("fitcoach_role", data.role);
          if (data.userId) localStorage.setItem("fitcoach_userId", data.userId);
          setIsAuthenticated(true); setRole(data.role); return { success: true };
        }
      } else if (res.status === 401) {
        const errData = await res.json(); return { success: false, error: errData.detail || "שם משתמש או סיסמה שגויים" };
      }
      return { success: false, error: "שם משתמש או סיסמה שגויים" };
    } catch (err) { return { success: false, error: "שגיאת תקשורת עם השרת. ודא שהבקנד פועל." }; }
  };

  const handleLogout = () => {
    localStorage.removeItem("fitcoach_token"); localStorage.removeItem("fitcoach_role"); localStorage.removeItem("fitcoach_userId");
    setIsAuthenticated(false); setRole(null); setDb(null);
  };

  const updateDb=useCallback(async updater=>{
    setSaving(true); setDb(prev=>{ const next=updater(prev); saveLocalDB(next).then(()=>setSaving(false)); return next; });
  },[]);

  const addSession = async trainerId => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const sessionForm = { trainerId, date: dateStr, type: "workout" };
    try {
      const res = await fetch(`${API_URL}/sessions`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify(sessionForm) });
      const newS = await res.json(); updateDb(prev => ({...prev, sessions: [...prev.sessions, { ...sessionForm, id: newS._id || newS.id }]}));
    } catch(e) { updateDb(prev => ({...prev, sessions: [...prev.sessions, { ...sessionForm, id: uid() }]})); }
  };

  const editTrainer = async form => {
    if (!form.id) return;
    try { await fetch(`${API_URL}/trainers/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify(form) }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.map(t => t.id === form.id ? { ...t, password: form.password, weight: form.weight, goal: form.goal, ...(role === "admin" ? form : {}) } : t)}));
  };

  const addTrainer = async form => {
    try {
      const res = await fetch(`${API_URL}/trainers`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify(form) });
      const newT = await res.json(); updateDb(prev => ({...prev, trainers: [...prev.trainers, { ...form, id: newT._id || newT.id }]}));
    } catch(e) { updateDb(prev => ({...prev, trainers: [...prev.trainers, { ...form, id: uid() }]})); }
  };
  
  const deleteTrainer = async id => {
    if (!id) return; if(!window.confirm("למחוק מתאמן?")) return;
    try { await fetch(`${API_URL}/trainers/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` } }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.filter(t => t.id !== id), sessions: prev.sessions.filter(s => s.trainerId !== id)}));
  };

  const saveProgram = async prog => {
    setSaving(true); let finalProg = prog;
    try {
      const method = (prog.id && typeof prog.id === 'string') ? "PUT" : "POST";
      const url = method === "PUT" ? `${API_URL}/programs/${prog.id}` : `${API_URL}/programs`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify(prog) });
      if(res.ok) { const data = await res.json(); finalProg = { ...prog, id: data._id || data.id }; }
    } catch(e) {}
    updateDb(prev => {
      const idx = prev.programs.findIndex(p => p.id === finalProg.id); let newProgs = [...prev.programs];
      if (idx !== -1) newProgs[idx] = finalProg; else newProgs.push({...finalProg, id: finalProg.id || uid()});
      return { ...prev, programs: newProgs };
    });
    setProgramBuilderTarget(null); setSaving(false);
  };
  
  const deleteProgram = async id => {
    if (!id) return; if(!window.confirm("למחוק תוכנית אימון?")) return;
    try { await fetch(`${API_URL}/programs/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` } }); } catch(e) {}
    updateDb(prev => ({...prev, programs: prev.programs.filter(p => p.id !== id), trainers: prev.trainers.map(t => t.programId === id ? { ...t, programId: null } : t)}));
  };

  const saveSavedSet = async setObj => {
    setSaving(true); let finalSet = setObj;
    try {
      const method = (setObj.id && typeof setObj.id === 'string') ? "PUT" : "POST";
      const url = method === "PUT" ? `${API_URL}/saved_sets/${setObj.id}` : `${API_URL}/saved_sets`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify(setObj) });
      if(res.ok) { const data = await res.json(); finalSet = { ...setObj, id: data._id || data.id }; }
    } catch(e) {}
    updateDb(prev => {
      const idx = prev.savedSets.findIndex(s => s.id === finalSet.id); let newSets = [...prev.savedSets];
      if (idx !== -1) newSets[idx] = finalSet; else newSets.push({...finalSet, id: finalSet.id || uid()});
      return { ...prev, savedSets: newSets };
    });
    setSavedSetBuilderTarget(null); setSaving(false);
  };

  const deleteSavedSet = async id => {
    if (!id) return; if(!window.confirm("למחוק תבנית זו?")) return;
    try { await fetch(`${API_URL}/saved_sets/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` } }); } catch(e) {}
    updateDb(prev => ({...prev, savedSets: prev.savedSets.filter(s => s.id !== id)}));
  };

  const assignProgram = async (tid, pid) => {
    if (!tid) return;
    try { await fetch(`${API_URL}/trainers/${tid}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("fitcoach_token")}` }, body: JSON.stringify({ programId: pid }) }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.map(t => t.id === tid ? { ...t, programId: pid } : t)}));
  };

  if (authChecking) return <FullScreenLoader text="בודק התחברות..." />;
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;
  if (loading || !db) return <FullScreenLoader text="טוען נתונים מהשרת..." />;

  // 🏋️‍♂️ חווית משתמש - מתאמן
  if (role === "user") {
    return <TraineeApp db={db} onLogout={handleLogout} onAddSession={addSession} onEditTrainer={editTrainer} />;
  }

  // 🛠️ חווית מנהל - Admin
  const navTo=p=>{ setPage(p); setProgramBuilderTarget(null); setSavedSetBuilderTarget(null); };

  return <>
    <style dangerouslySetInnerHTML={{ __html: globalCss }} />
    <div className="app-layout" style={{display:"flex",height:"100dvh",width:"100vw",overflow:"hidden",direction:"rtl",fontFamily:"sans-serif"}}>
      <Sidebar page={page} setPage={navTo} onLogout={handleLogout} />
      
      {saving && (
        <div style={{ position: "fixed", bottom: "12vh", left: "4vw", background: "#1565C0", color: "#fff", padding: "1.5vh 3vw", borderRadius: "1.5vh", zIndex: 9999, display: "flex", alignItems: "center", gap: "1.5vw", boxShadow: "0 1vh 3vh rgba(0,0,0,0.2)" }}>
          <div className="toast-spinner"></div><span style={{ fontSize: "1.6vh", fontWeight: 600 }}>שומר...</span>
        </div>
      )}

      {programBuilderTarget!==null ? 
        <ProgramBuilder program={programBuilderTarget==="new"?null:programBuilderTarget} programs={db.programs} savedSets={db.savedSets} onSave={saveProgram} onCancel={()=>setProgramBuilderTarget(null)} onLogout={handleLogout}/>
      : savedSetBuilderTarget!==null ?
        <SavedSetBuilder setObj={savedSetBuilderTarget==="new"?null:savedSetBuilderTarget} savedSets={db.savedSets} onSave={saveSavedSet} onCancel={()=>setSavedSetBuilderTarget(null)} onLogout={handleLogout}/>
      : <>
          {page==="dashboard"&&<Dashboard db={db} onAddTrainer={()=>setModal("add-trainer")} onLogout={handleLogout}/>}
          {page==="trainers"&&<TrainersPage db={db} onAdd={()=>setModal("add-trainer")} onDelete={deleteTrainer} onEdit={t=>{setEditTarget(t);setModal("edit-trainer");}} onLogout={handleLogout}/>}
          {page==="programs"&&<ProgramsPage db={db} onAdd={()=>setProgramBuilderTarget("new")} onEdit={p=>setProgramBuilderTarget(p)} onDelete={deleteProgram} onAssign={assignProgram} onLogout={handleLogout}/>}
          {page==="savedSets"&&<SavedSetsPage db={db} onAdd={()=>setSavedSetBuilderTarget("new")} onEdit={s=>setSavedSetBuilderTarget(s)} onDelete={deleteSavedSet} onLogout={handleLogout}/>}
        </>
      }
      <TrainerModal open={modal==="add-trainer"} onClose={()=>setModal(null)} onSave={addTrainer} programs={db.programs}/>
      <TrainerModal open={modal==="edit-trainer"} onClose={()=>{setModal(null);setEditTarget(null);}} onSave={editTrainer} initial={editTarget} programs={db.programs}/>
    </div>
  </>;
}