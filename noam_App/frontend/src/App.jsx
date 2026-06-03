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
  body { margin: 0; padding: 0; overflow: hidden; /* מונע גלילה כפולה במסך הראשי */ }
  ::-webkit-scrollbar { width: 0.6vw; height: 0.6vw; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 1vh; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* הגדרות פלאפון - תוקן */
  @media (max-width: 768px) {
    .app-layout { 
      flex-direction: column-reverse !important; 
      height: 100dvh !important; /* DVH פותר את בעיית שורת הכתובת באייפון */
      width: 100vw !important;
      overflow: hidden !important; 
    }
    
    /* תפריט תחתון קבוע, גמיש ומותאם */
    .sidebar { 
      width: 100vw !important; 
      height: auto !important; /* מתאים את הגובה לתוכן אוטומטית */
      min-height: 8vh !important;
      padding: 1.5vh 2vw calc(1.5vh + env(safe-area-inset-bottom)) 2vw !important; /* מרחיק מהפס של האייפון */
      flex-direction: row !important; 
      justify-content: space-around !important; 
      align-items: center !important;
      z-index: 100; 
      border-top: 1px solid rgba(255,255,255,0.1); 
      flex-shrink: 0;
    }
    .sidebar-header { display: none !important; }
    
    .sidebar-item { 
      flex-direction: column !important; 
      gap: 0.8vh !important; 
      padding: 1vh 1vw !important; 
      border-right: none !important; 
      font-size: 3.2vw !important; /* פונט יחסי לרוחב כדי למנוע גלישה */
      justify-content: center !important; 
      align-items: center !important;
      text-align: center; 
      width: 22vw !important; 
      border-radius: 1.5vh !important;
    }
    .sidebar-item span:first-child {
      font-size: 5.5vw !important; /* גודל האייקון */
      line-height: 1 !important;
    }
    .sidebar-item.active { background: rgba(255,255,255,0.2) !important; }
    .sidebar-logout { display: none !important; } 
    
    /* אזור התוכן המרכזי גליל */
    .main-pad { 
      flex: 1 !important; /* לוקח את כל המקום שנשאר במסך, מונע דחיפה של התפריט החוצה */
      height: auto !important; 
      width: 100vw !important;
      padding: 2vh 4vw !important; 
      overflow-y: auto !important;
    }
    
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
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({trainer,size=36}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:colorFor(trainer.id),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:600,fontSize:size*0.35,flexShrink:0,userSelect:"none"}}>{initials(trainer)}</div>;
}
function Btn({children,onClick,primary,danger,sm,disabled,full,style:s}){
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?"1vh 1.5vw":"1.5vh 2vw",borderRadius:"1vh",border:"none",cursor:disabled?"not-allowed":"pointer",fontSize:sm?"1.5vh":"1.7vh",fontWeight:600,fontFamily:"inherit",background:primary?"#2196F3":danger?"#fff0f0":"#f0f0f0",color:primary?"#fff":danger?"#e53935":"#333",transition:"all .15s",opacity:disabled?.6:1,width:full?"100%":"auto",...(s||{})}}>{children}</button>;
}
function Inp({label,style:s,...props}){
  return <div style={{marginBottom:"1.5vh"}}>
    {label&&<label style={{fontSize:"1.5vh",color:"#555",display:"block",marginBottom:"0.5vh",fontWeight:500}}>{label}</label>}
    <input style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box",...(s||{})}}
      onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} {...props}/>
  </div>;
}
function Sel({label,children,...props}){
  return <div style={{marginBottom:"1.5vh"}}>
    {label&&<label style={{fontSize:"1.5vh",color:"#555",display:"block",marginBottom:"0.5vh",fontWeight:500}}>{label}</label>}
    <select style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",background:"#fff",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} {...props}>{children}</select>
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

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await onLogin(identifier, password);
    if (!res.success) setError(res.error);
    setLoading(false);
  };

  return (
    <div style={{display:"flex", height:"100dvh", width:"100vw", position:"fixed", inset:0, overflow:"hidden", alignItems:"center", justifyContent:"center", background:"#F0F4FF", direction:"rtl", fontFamily:"sans-serif"}}>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div style={{background:"#fff", padding:"5vh 4vw", borderRadius:"3vh", boxShadow:"0 1vh 4vh rgba(21,101,192,0.1)", width:"85%", maxWidth:"400px", textAlign:"center", maxHeight:"90vh", overflowY:"auto"}}>
        <div style={{fontSize:"6vh", marginBottom:"2vh"}}>🏋️</div>
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
          
          <button disabled={loading} type="submit" style={{background:"#1565C0", color:"#fff", border:"none", padding:"2vh", borderRadius:"1.5vh", fontSize:"2vh", fontWeight:700, cursor:loading?"not-allowed":"pointer", marginTop:"1.5vh", fontFamily:"inherit", transition:"0.2s", opacity:loading?0.7:1, width:"100%"}}>
            {loading ? "מתחבר..." : "כניסה למערכת"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage, onLogout}){
  const nav=[
    {id:"dashboard",icon:"🏠",label:"סקירה כללית"},
    {id:"trainers",icon:"👥",label:"מתאמנים"},
    {id:"programs",icon:"📋",label:"תוכניות אימון"},
    {id:"savedSets",icon:"🗂️",label:"תבניות וסטים"},
  ];
  return <div className="sidebar" style={{width:"16vw",minWidth:"180px",flexShrink:0,background:"#1565C0",display:"flex",flexDirection:"column",paddingTop:"4vh"}}>
    <div className="sidebar-header" style={{textAlign:"center",marginBottom:"4vh",paddingBottom:"2vh",borderBottom:"1px solid rgba(255,255,255,.15)"}}>
      <div style={{fontSize:"3.5vh",marginBottom:"0.5vh"}}>🏋️</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:"2.2vh"}}>לא נשית איי</div>
    </div>
    
    <div style={{flex:1, display:"flex", flexDirection:"column", gap:"1vh", padding:"0 1vw"}}>
      {nav.map(n=><div key={n.id} className={`sidebar-item ${page===n.id?'active':''}`} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:"1vw",padding:"1.5vh 1.5vw",cursor:"pointer",color:page===n.id?"#fff":"rgba(255,255,255,.7)",background:page===n.id?"rgba(255,255,255,.15)":"transparent",borderRight:page===n.id?"0.3vw solid #fff":"0.3vw solid transparent",fontWeight:page===n.id?600:400,fontSize:"1.7vh",transition:"all .15s", borderRadius: page===n.id?"0 1.5vh 1.5vh 0":"0"}}>
        <span>{n.icon}</span><span>{n.label}</span>
      </div>)}
    </div>

    <div className="sidebar-logout" style={{padding:"2.5vh 1.5vw", borderTop:"1px solid rgba(255,255,255,.15)"}}>
      <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:"1vw",padding:"1.5vh 1.5vw",cursor:"pointer",color:"rgba(255,255,255,.8)", borderRadius:"1vh", fontSize:"1.7vh", fontWeight:500, transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <span>🚪</span> התנתק
      </div>
    </div>
  </div>;
}

// ─── Dashboard, TrainersPage, SavedSets, ProgramBuilder... ────────────────────
function Dashboard({db,onAddTrainer}){
  const {trainers,sessions}=db;
  const totalWeek=sessions.filter(s=>{const{sun,sat}=getWeekRange();return s.date>=sun&&s.date<=sat;}).length;
  const avgPer=trainers.length?(totalWeek/trainers.length).toFixed(1):0;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"3vh"}}>
      <div><div style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>שלום מנהל! 👋</div><div style={{color:"#666",fontSize:"1.8vh",marginTop:"0.5vh"}}>סקירת שבוע</div></div>
      <Btn primary onClick={onAddTrainer}>+ הוסף</Btn>
    </div>
    <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5vw",marginBottom:"4vh"}}>
      {[{label:"סך אימונים השבוע",value:totalWeek,unit:"אימונים"},{label:"מתאמנים פעילים",value:trainers.length,unit:"מתאמנים"},{label:"ממוצע למתאמן",value:avgPer,unit:"אימונים לשבוע"}].map((s,i)=><div key={i} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh 2.5vw",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.08)"}}>
        <div style={{fontSize:"1.6vh",color:"#888",marginBottom:"1.5vh",textAlign:"right"}}>{s.label}</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:"0.5vw",justifyContent:"flex-end"}}>
          <div style={{fontSize:"4.5vh",fontWeight:700,color:"#1565C0",lineHeight:1}}>{s.value}</div>
          <div style={{fontSize:"1.6vh",color:"#888",paddingBottom:"0.5vh"}}>{s.unit}</div>
        </div>
      </div>)}
    </div>
  </div>;
}

function TrainersPage({db,onAdd,onDelete,onEdit}){
  const {trainers,sessions,programs}=db;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}>
      <div style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>מתאמנים</div>
      <Btn primary onClick={onAdd}>+ הוסף מתאמן</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:"1.5vw"}}>
      {trainers.map(t=>{
        const prog=t.programId?programs.find(p=>p.id===t.programId):null;
        const wc=getWeekCount(sessions,t.id);
        const freq=prog?.sessionsPerWeek||0;
        const pct=freq?Math.min(Math.round(wc/freq*100),100):0;
        return <div key={t.id} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}><Avatar trainer={t} size={44}/>
            <div><div style={{fontWeight:600,fontSize:"1.9vh",color:"#1a1a2e"}}>{t.fname} {t.lname}</div><div style={{fontSize:"1.5vh",color:"#888",marginTop:"0.5vh"}}>{t.phone}</div></div>
          </div>
          <div style={{fontSize:"1.5vh",color:"#666",marginBottom:"0.5vh"}}>🎯 {t.goal||"לא הוגדר"}</div>
          <div style={{fontSize:"1.5vh",color:"#1565C0",marginBottom:"1.5vh",fontWeight:600}}>📋 {prog?`${prog.name}`:"❌ ללא תוכנית אימון"}</div>
          {freq>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"1.5vh",marginBottom:"0.5vh"}}><span style={{color:"#888"}}>אימונים השבוע</span><span style={{fontWeight:600,color:"#1565C0"}}>{wc}/{freq}</span></div>
            <div style={{background:"#f0f0f0",borderRadius:"1vh",height:"1vh",overflow:"hidden",marginBottom:"2vh"}}>
              <div style={{width:pct+"%",height:"100%",borderRadius:"1vh",background:pct>=100?"#4CAF50":pct>=60?"#2196F3":"#FF9800"}}/>
            </div>
          </>}
          <div style={{display:"flex",gap:"0.5vw"}}>
            <Btn sm full onClick={()=>onEdit(t)}>✏️ עריכה</Btn>
            <Btn sm full danger onClick={()=>onDelete(t.id)}>🗑️ מחיקה</Btn>
          </div>
        </div>;
      })}
      {!trainers.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"10vh 0",color:"#bbb"}}><div style={{fontSize:"6vh",marginBottom:"2vh"}}>👥</div><div style={{fontSize:"2vh"}}>אין מתאמנים עדיין</div></div>}
    </div>
  </div>;
}

function SavedSetsPage({db,onAdd,onEdit,onDelete}){
  const {savedSets}=db;
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}>
      <div>
        <div style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>תבניות וסטים שמורים</div>
        <div style={{fontSize:"1.7vh",color:"#666",marginTop:"0.5vh"}}>צור תבניות מוכנות מראש לשילוב מהיר בתוכניות</div>
      </div>
      <Btn primary onClick={onAdd}>+ תבנית חדשה</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1.5vw"}}>
      {savedSets.map(s=>(
        <div key={s.id} onClick={()=>onEdit(s)} style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",cursor:"pointer",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)",borderRight:"0.5vw solid #00BCD4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5vh"}}>
            <div style={{fontSize:"2vh",fontWeight:700,color:"#1a1a2e"}}>{s.name}</div>
            <button onClick={(e)=>{e.stopPropagation(); onDelete(s.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:"1vh",width:"4vh",height:"4vh",cursor:"pointer"}}>🗑</button>
          </div>
          <div style={{fontSize:"1.7vh",color:"#666",marginBottom:"2vh"}}>{s.exercises?.length||0} תרגילים בסט</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.5vw"}}>
            {s.exercises?.slice(0,3).map(e=><span key={e.id} style={{background:"#f5f5f5",padding:"0.5vh 1vw",borderRadius:"1vh",fontSize:"1.4vh",color:"#555"}}>{e.name}</span>)}
            {s.exercises?.length>3&&<span style={{background:"#e3f2fd",padding:"0.5vh 1vw",borderRadius:"1vh",fontSize:"1.4vh",color:"#1565C0"}}>+{s.exercises.length-3}</span>}
          </div>
        </div>
      ))}
      {!savedSets.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"10vh 0",color:"#bbb",background:"#fff",borderRadius:"2vh"}}><div style={{fontSize:"6vh",marginBottom:"2vh"}}>🗂️</div><div style={{fontSize:"2vh"}}>אין תבניות שמורות</div></div>}
    </div>
  </div>;
}

function SavedSetBuilder({setObj:initSet, onSave, onCancel}){
  const isNew = !initSet;
  const blankSet = {name:"", exercises:[]};
  const [prog, setProg] = useState(isNew ? blankSet : {...initSet, exercises:initSet.exercises?.map(e=>({...e}))||[]});

  const updExercises = exs => setProg(p=>({...p, exercises:exs}));
  const addExercise = () => updExercises([...prog.exercises, {id:Date.now(),name:"",sets:3,reps:10,rest:60,note:""}]);
  const removeExercise = id => updExercises(prog.exercises.filter(e=>e.id!==id));
  const updExercise = (id,patch) => updExercises(prog.exercises.map(e=>e.id===id?{...e,...patch}:e));
  const moveEx = (idx,dir) => { const exs=[...prog.exercises]; const to=idx+dir; if(to<0||to>=exs.length) return; [exs[idx],exs[to]]=[exs[to],exs[idx]]; updExercises(exs); };

  const valid = prog.name.trim() && prog.exercises.length > 0 && prog.exercises.every(e => e.name.trim());

  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}>
      <div style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תבנית חדשה":"✏️ עריכת תבנית"}</div>
      <div style={{display:"flex",alignItems:"center",gap:"1vw"}}><Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0"}}>ביטול</Btn><Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור</Btn></div>
    </div>
    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",marginBottom:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
      <label style={{fontSize:"1.5vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>שם התבנית / סט</label>
      <input style={{width:"100%",maxWidth:"40vw",minWidth:"250px",padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontFamily:"inherit"}} value={prog.name} onChange={e=>setProg({...prog,name:e.target.value})} placeholder="למשל: סדרת חימום"/>
    </div>
    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh", paddingBottom:"2vh", borderBottom:"1px solid #f0f0f0"}}>
        <div style={{fontSize:"2.2vh",fontWeight:700,color:"#1a1a2e"}}>תרגילים בסט</div><Btn primary onClick={addExercise}>+ הוסף תרגיל</Btn>
      </div>
      {prog.exercises.length===0&&<div style={{textAlign:"center",padding:"6vh 0",color:"#bbb", background:"#f8f9fa", borderRadius:"2vh"}}><div style={{fontSize:"5vh",marginBottom:"2vh"}}>🏋️</div><div style={{fontSize:"1.8vh", fontWeight:500}}>הוסף תרגילים לתבנית</div></div>}
      {prog.exercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:"1.5vh",padding:"2vh",marginBottom:"2vh",border:"1px solid #e0e0e0", boxShadow:"0 0.5vh 1.5vh rgba(0,0,0,0.04)"}}>
        <div className="exercise-row" style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}>
          <div style={{display:"flex",flexDirection:"row",gap:"0.5vw"}}>
            <div style={{background:"#e0f7fa",color:"#0097a7",borderRadius:"1vh",width:"3.5vh",height:"3.5vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5vh",fontWeight:700}}>{i+1}</div>
            <button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888", fontSize:"1.8vh"}}>▲</button>
            <button onClick={()=>moveEx(i,1)} disabled={i===prog.exercises.length-1} style={{background:"none",border:"none",cursor:i===prog.exercises.length-1?"default":"pointer",color:i===prog.exercises.length-1?"#ddd":"#888", fontSize:"1.8vh"}}>▼</button>
          </div>
          <input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontWeight:600}}/>
          <button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"2vh"}}>🗑</button>
        </div>
        <div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"repeat(3, 8vw) 1fr",gap:"1vw",paddingRight:"4vw"}}>
          {[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0}].map(f=><div key={f.key}>
            <label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>{f.label}</label>
            <input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}}/>
          </div>)}
          <div className="full-w"><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}} placeholder="דגשים..."/></div>
        </div>
      </div>)}
    </div>
  </div>;
}

function ProgramBuilder({program:initProg, programs, savedSets, onSave, onCancel}){
  const isNew=!initProg;
  const blankProg={name:"",desc:"",level:"בינוני",sessionsPerWeek:3,days:[]};
  const [prog,setProg]=useState(isNew?blankProg:{...initProg,days:initProg.days?.map(d=>({...d,exercises:d.exercises?.map(e=>({...e}))}))||[]});
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
    const setToImport = savedSets.find(s => s.id === setId);
    if(!setToImport) return;
    const importedExercises = setToImport.exercises.map(ex => ({ ...ex, id: Date.now() + Math.floor(Math.random() * 10000), weight: "" }));
    updExercises([...dayExercises, ...importedExercises]);
    setImportModalOpen(false);
  };

  const removeExercise=id=>updExercises(dayExercises.filter(e=>e.id!==id));
  const updExercise=(id,patch)=>updExercises(dayExercises.map(e=>e.id===id?{...e,...patch}:e));
  const moveEx=(idx,dir)=>{ const exs=[...dayExercises]; const to=idx+dir; if(to<0||to>=exs.length) return; [exs[idx],exs[to]]=[exs[to],exs[idx]]; updExercises(exs); };

  const daysHaveExercises = prog.days.length > 0 && prog.days.every(d => d.exercises && d.exercises.length > 0);
  const daysMatchConfig = prog.days.length === Number(prog.sessionsPerWeek);
  const isDuplicateName = programs.some(p => p.name.trim() === prog.name.trim() && p.id !== prog.id);
  const valid = prog.name.trim() && daysHaveExercises && daysMatchConfig && !isDuplicateName;

  let errorMsg = "";
  if (!prog.name.trim()) errorMsg = "יש להזין שם לתוכנית";
  else if (isDuplicateName) errorMsg = "קיימת כבר תוכנית עם השם הזה";
  else if (prog.days.length !== Number(prog.sessionsPerWeek)) errorMsg = `יש להגדיר ${prog.sessionsPerWeek} ימים`;
  else if (!daysHaveExercises) errorMsg = "לכל יום חסר תרגיל";

  const inputStyle={width:"100%",padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="exercise-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}>
      <div style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תוכנית חדשה":"✏️ עריכת תוכנית"}</div>
      <div style={{display:"flex",alignItems:"center",gap:"1vw"}}>
        {errorMsg && <div style={{background:"#ffebee",color:"#d32f2f",padding:"1vh 1.5vw",borderRadius:"1vh",fontSize:"1.4vh",fontWeight:600}}>{errorMsg}</div>}
        <Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0",color:"#555"}}>ביטול</Btn>
        <Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור</Btn>
      </div>
    </div>

    <div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",marginBottom:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
      <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"1.5fr 2fr 1fr 1fr",gap:"1.5vw"}}>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>שם התוכנית</label><input style={{...inputStyle, borderColor: isDuplicateName ? "#d32f2f" : "#e0e0e0"}} value={prog.name} onChange={e=>upd({name:e.target.value})} placeholder="לדוגמה: פול בודי חיזוק"/></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>תיאור</label><input style={inputStyle} value={prog.desc} onChange={e=>upd({desc:e.target.value})} placeholder="תיאור (אופציונלי)"/></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>רמת קושי</label><select style={{...inputStyle, background:"#fff"}} value={prog.level} onChange={e=>upd({level:e.target.value})}>{["מתחיל","בינוני","מתקדם"].map(l=><option key={l}>{l}</option>)}</select></div>
        <div><label style={{fontSize:"1.4vh",color:"#555",display:"block",marginBottom:"1vh",fontWeight:500}}>אימונים בשבוע</label><input style={inputStyle} type="number" min={1} max={7} value={prog.sessionsPerWeek} onChange={e=>upd({sessionsPerWeek:Number(e.target.value)})}/></div>
      </div>
    </div>

    <div className="builder-grid" style={{display:"grid",gridTemplateColumns:"20vw 1fr",gap:"2vw",alignItems:"start"}}>
      <div style={{background:"#fff",borderRadius:"2vh",padding:"2.5vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"2vh"}}><div style={{fontSize:"1.7vh",fontWeight:600,color:"#555"}}>ימי האימון</div><div style={{fontSize:"1.5vh",color:prog.days.length===Number(prog.sessionsPerWeek)?"#4CAF50":"#d32f2f",fontWeight:600}}>{prog.days.length} / {prog.sessionsPerWeek}</div></div>
        <div className="mob-grid-2" style={{display:"grid", gap:"1.5vh"}}>
          {prog.days.map((d,i)=><div key={d.id} style={{display:"flex",alignItems:"center",gap:"0.5vw"}}>
            <div onClick={()=>setSelDay(i)} style={{flex:1,padding:"1.5vh 1.5vw",borderRadius:"1vh",cursor:"pointer",background:selDay===i?"#E3F2FD":"#f8f9fa",border:selDay===i?"0.2vw solid #2196F3":"0.2vw solid transparent",fontSize:"1.6vh",fontWeight:selDay===i?600:500,color:selDay===i?"#1565C0":"#444"}}>{d.name||`יום ${i+1}`}</div>
            <button onClick={()=>removeDay(i)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"1.8vh"}}>✕</button>
          </div>)}
        </div>
        <Btn full onClick={addDay} disabled={prog.days.length>=7} style={{background:"#f0f4ff", color:"#1565C0", border:"0.2vw dashed #90CAF9", marginTop:"2vh"}}>+ הוסף יום</Btn>
      </div>

      {prog.days[selDay]?<div style={{background:"#fff",borderRadius:"2vh",padding:"3vh",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh", paddingBottom:"2vh", borderBottom:"1px solid #f0f0f0"}}>
          <div><input value={prog.days[selDay].name} onChange={e=>renameDay(selDay,e.target.value)} style={{fontSize:"2.5vh",fontWeight:700,color:"#1a1a2e",border:"none",outline:"none",background:"transparent",fontFamily:"inherit",direction:"rtl", width:"100%"}} placeholder="שם היום (למשל: כוח עליון)"/></div>
          <div style={{display:"flex", gap:"1vw"}}><Btn style={{background:"#e0f7fa", color:"#0097a7"}} onClick={()=>setImportModalOpen(true)}>📥 ייבא סט</Btn><Btn primary onClick={addExercise}>+ תרגיל</Btn></div>
        </div>
        {dayExercises.length===0&&<div style={{textAlign:"center",padding:"6vh 0",color:"#bbb", background:"#f8f9fa", borderRadius:"2vh"}}><div style={{fontSize:"5vh",marginBottom:"2vh"}}>🏋️</div><div style={{fontSize:"1.8vh", fontWeight:500, color:"#d32f2f"}}>חובה תרגיל אחד לפחות</div></div>}
        {dayExercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:"1.5vh",padding:"2vh",marginBottom:"2vh",border:"1px solid #e0e0e0", boxShadow:"0 0.5vh 1.5vh rgba(0,0,0,0.04)"}}>
          <div className="exercise-row" style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"2vh"}}>
            <div style={{display:"flex",flexDirection:"row",gap:"0.5vw"}}>
              <div style={{background:"#e3f2fd",color:"#1565c0",borderRadius:"1vh",width:"3.5vh",height:"3.5vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5vh",fontWeight:700,flexShrink:0}}>{i+1}</div>
              <button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888",fontSize:"1.8vh"}}>▲</button>
              <button onClick={()=>moveEx(i,1)} disabled={i===dayExercises.length-1} style={{background:"none",border:"none",cursor:i===dayExercises.length-1?"default":"pointer",color:i===dayExercises.length-1?"#ddd":"#888",fontSize:"1.8vh"}}>▼</button>
            </div>
            <input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, padding:"1.5vh 1.5vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.7vh",direction:"rtl",outline:"none",fontFamily:"inherit",fontWeight:600}}/>
            <button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:"1vh",cursor:"pointer",color:"#d32f2f",width:"4vh",height:"4vh", fontSize:"2vh"}}>🗑</button>
          </div>
          <div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"repeat(4, 7vw) 1fr",gap:"1vw",paddingRight:"4vw"}}>
            {[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0},{label:"משקל",key:"weight",type:"number",min:0}].map(f=><div key={f.key}>
              <label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh",whiteSpace:"nowrap"}}>{f.label}</label>
              <input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}}/>
            </div>)}
            <div className="full-w"><label style={{fontSize:"1.4vh",color:"#666",display:"block",marginBottom:"1vh"}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",boxSizing:"border-box"}} placeholder="דגשים..."/></div>
          </div>
        </div>)}
      </div>:<div style={{background:"#fff",borderRadius:"2vh",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"50vh",color:"#bbb",flexDirection:"column",gap:"2vh"}}><div style={{fontSize:"6vh"}}>📋</div><div style={{fontSize:"2vh", fontWeight:500}}>בחר יום מהרשימה</div></div>}
    </div>

    <Modal open={importModalOpen} onClose={()=>setImportModalOpen(false)} title="בחר תבנית לייבוא">
      <div style={{display:"flex",flexDirection:"column",gap:"1.5vh", maxHeight:"50vh", overflowY:"auto"}}>
        {savedSets.map(s=>(
          <div key={s.id} onClick={()=>importSavedSet(s.id)} style={{background:"#f8f9fa",padding:"2vh 2vw",borderRadius:"1.5vh",cursor:"pointer",border:"1px solid #e0e0e0",transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="#e3f2fd"} onMouseLeave={e=>e.currentTarget.style.background="#f8f9fa"}>
            <div style={{fontWeight:600,fontSize:"1.8vh",color:"#1a1a2e"}}>{s.name}</div><div style={{fontSize:"1.5vh",color:"#666",marginTop:"0.5vh"}}>{s.exercises.length} תרגילים בסט</div>
          </div>
        ))}
        {!savedSets.length && <div style={{textAlign:"center",padding:"3vh",color:"#888", fontSize:"1.6vh"}}>אין תבניות שמורות במערכת.</div>}
      </div>
    </Modal>
  </div>;
}

function ProgramsPage({db,onAdd,onEdit,onDelete,onAssign}){
  const {programs, trainers}=db;
  const [assignModalProg, setAssignModalProg] = useState(null);
  return <div className="main-pad" style={{padding:"3vh 3vw",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3vh"}}><div style={{fontSize:"2.8vh",fontWeight:700,color:"#1a1a2e"}}>תוכניות אימון</div><Btn primary onClick={onAdd}>+ תוכנית</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:"2vh"}}>
      {programs.map(p=>(
        <div key={p.id} className="prog-card" onClick={()=>onEdit(p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:"2vh",padding:"2.5vh 3vw",cursor:"pointer",boxShadow:"0 0.5vh 2vh rgba(33,150,243,.06)",borderRight:"0.5vw solid #2196F3"}}>
          <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:"1vw",marginBottom:"1vh"}}><div style={{fontSize:"2.2vh",fontWeight:700,color:"#1a1a2e"}}>{p.name}</div><span style={{background:"#e3f2fd",color:"#1565C0",padding:"0.5vh 1.5vw",borderRadius:"1.5vh",fontSize:"1.4vh",fontWeight:600}}>{p.level}</span></div><div style={{fontSize:"1.6vh",color:"#666"}}>{p.desc||"ללא תיאור"}</div></div>
          <div className="prog-stats" style={{display:"flex",alignItems:"center",gap:"4vw",marginLeft:"3vw"}}><div style={{textAlign:"center"}}><div style={{fontSize:"2.5vh",fontWeight:700,color:"#1565C0"}}>{p.sessionsPerWeek}</div><div style={{fontSize:"1.4vh",color:"#888"}}>אימונים/שבוע</div></div><div style={{textAlign:"center"}}><div style={{fontSize:"2.5vh",fontWeight:700,color:"#1565C0"}}>{p.days?.length||0}</div><div style={{fontSize:"1.4vh",color:"#888"}}>ימים</div></div></div>
          <div className="prog-actions" style={{display:"flex",alignItems:"center",gap:"1vw"}}><Btn sm onClick={(e)=>{e.stopPropagation(); setAssignModalProg(p);}} style={{background:"#e3f2fd",color:"#1565C0"}}>🔗 שיוך</Btn><button onClick={(e)=>{e.stopPropagation(); onDelete(p.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:"1vh",width:"5vh",height:"5vh",fontSize:"2vh",cursor:"pointer"}}>🗑</button></div>
        </div>
      ))}
      {!programs.length&&<div style={{textAlign:"center",padding:"10vh 0",color:"#bbb",background:"#fff",borderRadius:"2vh"}}><div style={{fontSize:"6vh",marginBottom:"2vh"}}>📋</div><div style={{fontSize:"2vh"}}>אין תוכניות אימון</div></div>}
    </div>
    <Modal open={!!assignModalProg} onClose={()=>setAssignModalProg(null)} title={`שיוך: ${assignModalProg?.name}`}>
      <div style={{display:"flex",flexDirection:"column",gap:"1.5vh", maxHeight:"40vh", overflowY:"auto", paddingRight:"1vw"}}>
        {trainers.map(t=>(<label key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.5vh 2vw",background:"#f8f9fa",borderRadius:"1.5vh",cursor:"pointer",border:"1px solid #e0e0e0"}}><div style={{display:"flex",alignItems:"center",gap:"1vw"}}><Avatar trainer={t} size={32}/><span style={{fontSize:"1.7vh",fontWeight:500,color:"#1a1a2e"}}>{t.fname} {t.lname}</span></div><input type="checkbox" checked={t.programId === assignModalProg?.id} onChange={e => onAssign(t.id, e.target.checked ? assignModalProg.id : null)} style={{width:"2.5vh",height:"2.5vh",cursor:"pointer",accentColor:"#2196F3"}}/></label>))}
      </div>
      <div style={{marginTop:"3vh"}}><Btn primary full onClick={()=>setAssignModalProg(null)}>סיום ושמירה</Btn></div>
    </Modal>
  </div>;
}

function TrainerModal({open,onClose,onSave,initial,programs}){
  const blank={fname:"",lname:"",email:"",phone:"",password:"",weight:"",goal:"",programId:null};
  const [form,setForm]=useState(blank);
  useEffect(()=>{ if(open) setForm(initial ? {...initial} : blank); },[open, initial]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const hebrewRegex = /^[\u0590-\u05EA\s]+$/; 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
  const phoneRegex = /^\d{10}$/; 

  const isFnameValid = form.fname?.trim().length > 0 && hebrewRegex.test(form.fname.trim());
  const isLnameValid = form.lname?.trim().length > 0 && hebrewRegex.test(form.lname.trim());
  const isEmailValid = form.email?.trim().length > 0 && emailRegex.test(form.email.trim());
  const isPasswordValid = form.password && form.password.length >= 8;
  const isPhoneValid = form.phone?.trim().length > 0 && phoneRegex.test(form.phone.trim());

  const valid = isFnameValid && isLnameValid && isEmailValid && isPasswordValid && isPhoneValid;

  let errorMsg = "";
  if (!form.fname?.trim() || !form.lname?.trim()) errorMsg = "יש למלא שם פרטי ושם משפחה (שדות חובה)";
  else if (!hebrewRegex.test(form.fname.trim()) || !hebrewRegex.test(form.lname.trim())) errorMsg = "שם פרטי ושם משפחה חייבים להכיל אותיות בעברית בלבד";
  else if (!form.email?.trim() || !emailRegex.test(form.email.trim())) errorMsg = "יש להזין אימייל תקין (שדה חובה)";
  else if (!form.password || form.password.length < 8) errorMsg = "הסיסמה חייבת להכיל לפחות 8 תווים";
  else if (!form.phone?.trim() || !phoneRegex.test(form.phone.trim())) errorMsg = "הטלפון חייב להכיל בדיוק 10 ספרות, ללא מקפים";

  const currentProgramName = form.programId ? programs.find(p=>p.id===form.programId)?.name : null;

  return <Modal open={open} onClose={onClose} title={initial?"עריכת מתאמן":"הוספת מתאמן חדש"}>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="שם פרטי *" value={form.fname} onChange={e=>set("fname",e.target.value)} placeholder="עברית בלבד"/>
      <Inp label="שם משפחה *" value={form.lname} onChange={e=>set("lname",e.target.value)} placeholder="עברית בלבד"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="אימייל *" type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} placeholder="email@example.com"/>
      <Inp label="סיסמה *" type="password" value={form.password||""} onChange={e=>set("password",e.target.value)} placeholder="לפחות 8 תווים"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="טלפון *" value={form.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="10 ספרות רצופות"/>
      <Inp label="משקל - ק״ג" type="number" value={form.weight||""} onChange={e=>set("weight",e.target.value)} placeholder="אופציונלי"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1vw"}}>
      <Inp label="מטרת אימון" value={form.goal||""} onChange={e=>set("goal",e.target.value)} placeholder="אופציונלי"/>
      <div>
        <label style={{fontSize:"1.5vh",color:"#666",display:"block",marginBottom:"0.5vh",fontWeight:500}}>תוכנית משויכת</label>
        <div style={{width:"100%",padding:"1.2vh 1vw",border:"1.5px solid #e0e0e0",borderRadius:"1vh",fontSize:"1.6vh",direction:"rtl",background:"#f5f5f5",color:currentProgramName?"#1565C0":"#888",fontWeight:currentProgramName?600:400,fontFamily:"inherit"}}>
          {currentProgramName ? `📋 ${currentProgramName}` : "❌ ללא תוכנית"}
        </div>
      </div>
    </div>
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
    
    if (token) {
        setIsAuthenticated(true);
        setRole(savedRole);
    } else {
        setAuthChecking(false);
        setLoading(false); 
    }
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
          const programs = await progRes.json();
          const trainers = await trainRes.json();
          const sessions = await sessRes.json();
          const savedSets = await setsRes.json();
          const normalize = arr => arr.map(obj => ({ ...obj, id: obj._id || obj.id }));
          setDb({ programs: normalize(programs), trainers: normalize(trainers), sessions: normalize(sessions), savedSets: normalize(savedSets) });
        }
      } catch (error) {
        console.warn("Backend down. Loading local fallback.");
        const localData = await loadLocalDB();
        setDb(localData || defaultData);
      }
      setLoading(false); 
      setAuthChecking(false);
    }
    initApp();
  },[isAuthenticated]);

  const handleLogin = async (identifier, password) => {
    try {
      const res = await fetch(`${API_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("fitcoach_token", data.token);
          localStorage.setItem("fitcoach_role", data.role);
          setIsAuthenticated(true);
          setRole(data.role);
          return { success: true };
        }
      }
      return { success: false, error: "שם משתמש או סיסמה שגויים" };
    } catch (err) {
      return { success: false, error: "שגיאת תקשורת עם השרת" };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("fitcoach_token");
    localStorage.removeItem("fitcoach_role");
    setIsAuthenticated(false);
    setRole(null);
    setDb(null);
  };

  const updateDb=useCallback(async updater=>{
    setSaving(true);
    setDb(prev=>{
      const next=updater(prev);
      saveLocalDB(next).then(()=>setSaving(false));
      return next;
    });
  },[]);

  if (authChecking) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100dvh",direction:"rtl",fontSize:"3vh"}}>בודק התחברות...</div>;
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;

  if (role === "user") {
    return <div style={{display:"flex", height:"100dvh", width:"100vw", overflow:"hidden", position:"fixed", alignItems:"center", justifyContent:"center", background:"#F0F4FF", direction:"rtl", fontFamily:"sans-serif"}}>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        <div style={{background:"#fff", padding:"6vh 8vw", borderRadius:"3vh", textAlign:"center", boxShadow:"0 1vh 3vh rgba(21,101,192,0.1)"}}>
            <div style={{fontSize:"8vh", marginBottom:"2vh"}}>🚧</div>
            <h1 style={{color:"#1a1a2e", marginBottom:"1vh", fontSize:"3.5vh"}}>אזור מתאמנים</h1>
            <p style={{color:"#666", marginBottom:"4vh", fontSize:"2vh"}}>האזור האישי שלך נמצא כרגע בבנייה. נחזור בקרוב!</p>
            <Btn primary onClick={handleLogout}>🚪 התנתק</Btn>
        </div>
    </div>;
  }

  if(loading || !db) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100dvh",direction:"rtl",fontSize:"3vh"}}>טוען נתונים מהשרת...</div>;

  const addTrainer = async form => {
    try {
      const res = await fetch(`${API_URL}/trainers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const newT = await res.json();
      updateDb(prev => ({...prev, trainers: [...prev.trainers, { ...form, id: newT._id || newT.id }]}));
    } catch(e) { updateDb(prev => ({...prev, trainers: [...prev.trainers, { ...form, id: uid() }]})); }
  };
  const editTrainer = async form => {
    if (!form.id) return;
    try { await fetch(`${API_URL}/trainers/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.map(t => t.id === form.id ? { ...t, ...form } : t)}));
  };
  const deleteTrainer = async id => {
    if (!id) return;
    if(!window.confirm("למחוק מתאמן?")) return;
    try { await fetch(`${API_URL}/trainers/${id}`, { method: "DELETE" }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.filter(t => t.id !== id), sessions: prev.sessions.filter(s => s.trainerId !== id)}));
  };
  const saveProgram = async prog => {
    setSaving(true); let finalProg = prog;
    try {
      const method = (prog.id && typeof prog.id === 'string') ? "PUT" : "POST";
      const url = method === "PUT" ? `${API_URL}/programs/${prog.id}` : `${API_URL}/programs`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(prog) });
      if(res.ok) { const data = await res.json(); finalProg = { ...prog, id: data._id || data.id }; }
    } catch(e) {}
    updateDb(prev => {
      const idx = prev.programs.findIndex(p => p.id === finalProg.id);
      let newProgs = [...prev.programs];
      if (idx !== -1) newProgs[idx] = finalProg; else newProgs.push({...finalProg, id: finalProg.id || uid()});
      return { ...prev, programs: newProgs };
    });
    setProgramBuilderTarget(null); setSaving(false);
  };
  const deleteProgram = async id => {
    if (!id) return;
    if(!window.confirm("למחוק תוכנית אימון?")) return;
    try { await fetch(`${API_URL}/programs/${id}`, { method: "DELETE" }); } catch(e) {}
    updateDb(prev => ({...prev, programs: prev.programs.filter(p => p.id !== id), trainers: prev.trainers.map(t => t.programId === id ? { ...t, programId: null } : t)}));
  };
  const saveSavedSet = async setObj => {
    setSaving(true); let finalSet = setObj;
    try {
      const method = (setObj.id && typeof setObj.id === 'string') ? "PUT" : "POST";
      const url = method === "PUT" ? `${API_URL}/saved_sets/${setObj.id}` : `${API_URL}/saved_sets`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(setObj) });
      if(res.ok) { const data = await res.json(); finalSet = { ...setObj, id: data._id || data.id }; }
    } catch(e) {}
    updateDb(prev => {
      const idx = prev.savedSets.findIndex(s => s.id === finalSet.id);
      let newSets = [...prev.savedSets];
      if (idx !== -1) newSets[idx] = finalSet; else newSets.push({...finalSet, id: finalSet.id || uid()});
      return { ...prev, savedSets: newSets };
    });
    setSavedSetBuilderTarget(null); setSaving(false);
  };
  const deleteSavedSet = async id => {
    if (!id) return;
    if(!window.confirm("למחוק תבנית זו?")) return;
    try { await fetch(`${API_URL}/saved_sets/${id}`, { method: "DELETE" }); } catch(e) {}
    updateDb(prev => ({...prev, savedSets: prev.savedSets.filter(s => s.id !== id)}));
  };
  const assignProgram = async (tid, pid) => {
    if (!tid) return;
    try { await fetch(`${API_URL}/trainers/${tid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programId: pid }) }); } catch(e) {}
    updateDb(prev => ({...prev, trainers: prev.trainers.map(t => t.id === tid ? { ...t, programId: pid } : t)}));
  };

  const navTo=p=>{ setPage(p); setProgramBuilderTarget(null); setSavedSetBuilderTarget(null); };

  return <>
    <style dangerouslySetInnerHTML={{ __html: globalCss }} />
    <div className="app-layout" style={{display:"flex",height:"100dvh",width:"100vw",overflow:"hidden",direction:"rtl",fontFamily:"sans-serif"}}>
      <Sidebar page={page} setPage={navTo} onLogout={handleLogout} />
      {saving&&<div style={{position:"fixed",bottom:"12vh",left:"4vw",background:"#1565C0",color:"#fff",padding:"1vh 2vw",borderRadius:"1vh",zIndex:9999, fontSize:"1.5vh"}}>שומר...</div>}

      {programBuilderTarget!==null ? 
        <ProgramBuilder program={programBuilderTarget==="new"?null:programBuilderTarget} programs={db.programs} savedSets={db.savedSets} onSave={saveProgram} onCancel={()=>setProgramBuilderTarget(null)}/>
      : savedSetBuilderTarget!==null ?
        <SavedSetBuilder setObj={savedSetBuilderTarget==="new"?null:savedSetBuilderTarget} onSave={saveSavedSet} onCancel={()=>setSavedSetBuilderTarget(null)}/>
      : <>
          {page==="dashboard"&&<Dashboard db={db} onAddTrainer={()=>setModal("add-trainer")}/>}
          {page==="trainers"&&<TrainersPage db={db} onAdd={()=>setModal("add-trainer")} onDelete={deleteTrainer} onEdit={t=>{setEditTarget(t);setModal("edit-trainer");}}/>}
          {page==="programs"&&<ProgramsPage db={db} onAdd={()=>setProgramBuilderTarget("new")} onEdit={p=>setProgramBuilderTarget(p)} onDelete={deleteProgram} onAssign={assignProgram}/>}
          {page==="savedSets"&&<SavedSetsPage db={db} onAdd={()=>setSavedSetBuilderTarget("new")} onEdit={s=>setSavedSetBuilderTarget(s)} onDelete={deleteSavedSet}/>}
        </>
      }

      <TrainerModal open={modal==="add-trainer"} onClose={()=>setModal(null)} onSave={addTrainer} programs={db.programs}/>
      <TrainerModal open={modal==="edit-trainer"} onClose={()=>{setModal(null);setEditTarget(null);}} onSave={editTrainer} initial={editTarget} programs={db.programs}/>
    </div>
  </>;
}