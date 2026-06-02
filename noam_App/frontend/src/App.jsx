import { useState, useEffect, useCallback } from "react";

// ─── API Configuration ────────────────────────────────────────────────────────
const API_URL = import.meta.env?.VITE_API_URL || "https://newrepo-3b2u.onrender.com";
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
  body { margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  @media (max-width: 768px) {
    .app-layout { flex-direction: column-reverse !important; padding-bottom: env(safe-area-inset-bottom); }
    .sidebar { width: 100% !important; height: auto !important; padding-top: 0 !important; flex-direction: row !important; justify-content: space-around !important; padding: 8px 4px !important; z-index: 100; border-top: 1px solid rgba(255,255,255,0.1); }
    .sidebar-header { display: none !important; }
    .sidebar-item { flex-direction: column !important; gap: 4px !important; padding: 6px !important; border-right: none !important; font-size: 11px !important; justify-content: center !important; text-align: center; }
    .sidebar-item.active { background: rgba(255,255,255,0.2) !important; border-radius: 8px !important; }
    .sidebar-logout { display: none !important; } 
    .main-pad { padding: 16px !important; }
    .mob-stack { grid-template-columns: 1fr !important; display: flex !important; flex-direction: column !important; }
    .mob-grid-2 { grid-template-columns: 1fr 1fr !important; }
    .builder-grid { display: flex !important; flex-direction: column !important; }
    .exercise-row { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
    .exercise-inputs { grid-template-columns: 1fr 1fr !important; padding-right: 0 !important; gap: 10px !important; }
    .exercise-inputs .full-w { grid-column: 1 / -1 !important; }
    .prog-card { flex-direction: column !important; align-items: stretch !important; gap: 16px !important; }
    .prog-stats { margin-left: 0 !important; justify-content: space-between !important; width: 100% !important; gap: 10px !important; }
    .prog-actions { justify-content: space-between !important; width: 100% !important; margin-top: 10px; }
    .modal-box { width: 95vw !important; padding: 20px 16px !important; }
    .modal-grid { grid-template-columns: 1fr !important; }
  }
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({trainer,size=36}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:colorFor(trainer.id),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:600,fontSize:size*0.35,flexShrink:0,userSelect:"none"}}>{initials(trainer)}</div>;
}
function Btn({children,onClick,primary,danger,sm,disabled,full,style:s}){
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?"6px 12px":"10px 20px",borderRadius:8,border:"none",cursor:disabled?"not-allowed":"pointer",fontSize:sm?12:14,fontWeight:600,fontFamily:"inherit",background:primary?"#2196F3":danger?"#fff0f0":"#f0f0f0",color:primary?"#fff":danger?"#e53935":"#333",transition:"all .15s",opacity:disabled?.6:1,width:full?"100%":"auto",...(s||{})}}>{children}</button>;
}
function Inp({label,style:s,...props}){
  return <div style={{marginBottom:12}}>
    {label&&<label style={{fontSize:12,color:"#555",display:"block",marginBottom:4,fontWeight:500}}>{label}</label>}
    <input style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box",...(s||{})}}
      onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} {...props}/>
  </div>;
}
function Sel({label,children,...props}){
  return <div style={{marginBottom:12}}>
    {label&&<label style={{fontSize:12,color:"#555",display:"block",marginBottom:4,fontWeight:500}}>{label}</label>}
    <select style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",background:"#fff",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} {...props}>{children}</select>
  </div>;
}
function Modal({open,onClose,title,children,wide}){
  if(!open) return null;
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl"}}>
    <div className="modal-box" style={{background:"#fff",borderRadius:16,padding:"24px 28px",width:wide?720:480,maxWidth:"96vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{fontSize:17,fontWeight:700,color:"#1a1a2e"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}}>✕</button>
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
    <div style={{display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"#F0F4FF", direction:"rtl", fontFamily:"sans-serif"}}>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div style={{background:"#fff", padding:"48px 40px", borderRadius:"24px", boxShadow:"0 10px 40px rgba(21,101,192,0.1)", width:"100%", maxWidth:"420px", textAlign:"center"}}>
        <div style={{fontSize:56, marginBottom:16}}>🏋️</div>
        <h1 style={{fontSize:28, fontWeight:700, color:"#1a1a2e", marginBottom:8, margin:0}}>ברוך הבא</h1>
        <p style={{fontSize:15, color:"#666", marginBottom:36, marginTop:8}}>לא נשית איי - כניסה למערכת</p>
        
        <form onSubmit={submit} style={{display:"flex", flexDirection:"column", gap:20}}>
          <div style={{textAlign:"right"}}>
            <label style={{fontSize:13, color:"#555", fontWeight:600, display:"block", marginBottom:8}}>שם משתמש / טלפון / אימייל</label>
            <input required value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{width:"100%", padding:"14px 16px", border:"1.5px solid #e0e0e0", borderRadius:"12px", outline:"none", fontSize:15, fontFamily:"inherit", boxSizing:"border-box", transition:"0.2s"}} onFocus={e=>e.target.style.borderColor="#1565C0"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} placeholder="הזן פרטי זיהוי" />
          </div>
          <div style={{textAlign:"right"}}>
            <label style={{fontSize:13, color:"#555", fontWeight:600, display:"block", marginBottom:8}}>סיסמה</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%", padding:"14px 16px", border:"1.5px solid #e0e0e0", borderRadius:"12px", outline:"none", fontSize:15, fontFamily:"inherit", boxSizing:"border-box", transition:"0.2s"}} onFocus={e=>e.target.style.borderColor="#1565C0"} onBlur={e=>e.target.style.borderColor="#e0e0e0"} placeholder="הזן סיסמה" />
          </div>
          
          {error && <div style={{color:"#d32f2f", background:"#ffebee", padding:"12px", borderRadius:"10px", fontSize:14, fontWeight:600}}>{error}</div>}
          
          <button disabled={loading} type="submit" style={{background:"#1565C0", color:"#fff", border:"none", padding:"16px", borderRadius:"12px", fontSize:16, fontWeight:700, cursor:loading?"not-allowed":"pointer", marginTop:12, fontFamily:"inherit", transition:"0.2s", opacity:loading?0.7:1}}>
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
  return <div className="sidebar" style={{width:200,flexShrink:0,background:"#1565C0",display:"flex",flexDirection:"column",paddingTop:28}}>
    <div className="sidebar-header" style={{textAlign:"center",marginBottom:32,paddingBottom:20,borderBottom:"1px solid rgba(255,255,255,.15)"}}>
      <div style={{fontSize:28,marginBottom:4}}>🏋️</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:18}}>לא נשית איי</div>
    </div>
    
    <div style={{flex:1}}>
      {nav.map(n=><div key={n.id} className={`sidebar-item ${page===n.id?'active':''}`} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",cursor:"pointer",color:page===n.id?"#fff":"rgba(255,255,255,.7)",background:page===n.id?"rgba(255,255,255,.15)":"transparent",borderRight:page===n.id?"4px solid #fff":"4px solid transparent",fontWeight:page===n.id?600:400,fontSize:14,transition:"all .15s"}}>
        <span>{n.icon}</span><span>{n.label}</span>
      </div>)}
    </div>

    <div className="sidebar-logout" style={{padding:"20px", borderTop:"1px solid rgba(255,255,255,.15)"}}>
      <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",cursor:"pointer",color:"rgba(255,255,255,.8)", borderRadius:"8px", fontSize:14, fontWeight:500, transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
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
  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
      <div><div style={{fontSize:22,fontWeight:700,color:"#1a1a2e"}}>שלום מנהל! 👋</div><div style={{color:"#666",fontSize:14,marginTop:4}}>סקירת שבוע</div></div>
      <Btn primary onClick={onAddTrainer}>+ הוסף</Btn>
    </div>
    <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:28}}>
      {[{label:"סך אימונים השבוע",value:totalWeek,unit:"אימונים"},{label:"מתאמנים פעילים",value:trainers.length,unit:"מתאמנים"},{label:"ממוצע למתאמן",value:avgPer,unit:"אימונים לשבוע"}].map((s,i)=><div key={i} style={{background:"#fff",borderRadius:16,padding:"20px 24px",boxShadow:"0 2px 12px rgba(33,150,243,.08)"}}>
        <div style={{fontSize:13,color:"#888",marginBottom:10,textAlign:"right"}}>{s.label}</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,justifyContent:"flex-end"}}>
          <div style={{fontSize:36,fontWeight:700,color:"#1565C0",lineHeight:1}}>{s.value}</div>
          <div style={{fontSize:13,color:"#888",paddingBottom:4}}>{s.unit}</div>
        </div>
      </div>)}
    </div>
  </div>;
}

function TrainersPage({db,onAdd,onDelete,onEdit}){
  const {trainers,sessions,programs}=db;
  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:20,fontWeight:700,color:"#1a1a2e"}}>מתאמנים</div>
      <Btn primary onClick={onAdd}>+ הוסף מתאמן</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
      {trainers.map(t=>{
        const prog=t.programId?programs.find(p=>p.id===t.programId):null;
        const wc=getWeekCount(sessions,t.id);
        const freq=prog?.sessionsPerWeek||0;
        const pct=freq?Math.min(Math.round(wc/freq*100),100):0;
        return <div key={t.id} style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(33,150,243,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}><Avatar trainer={t} size={44}/>
            <div><div style={{fontWeight:600,fontSize:15,color:"#1a1a2e"}}>{t.fname} {t.lname}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{t.phone}</div></div>
          </div>
          <div style={{fontSize:12,color:"#666",marginBottom:4}}>🎯 {t.goal||"לא הוגדר"}</div>
          <div style={{fontSize:12,color:"#1565C0",marginBottom:12,fontWeight:600}}>📋 {prog?`${prog.name}`:"❌ ללא תוכנית אימון"}</div>
          {freq>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#888"}}>אימונים השבוע</span><span style={{fontWeight:600,color:"#1565C0"}}>{wc}/{freq}</span></div>
            <div style={{background:"#f0f0f0",borderRadius:4,height:6,overflow:"hidden",marginBottom:12}}>
              <div style={{width:pct+"%",height:"100%",borderRadius:4,background:pct>=100?"#4CAF50":pct>=60?"#2196F3":"#FF9800"}}/>
            </div>
          </>}
          <div style={{display:"flex",gap:6}}>
            <Btn sm full onClick={()=>onEdit(t)}>✏️ עריכה</Btn>
            <Btn sm full danger onClick={()=>onDelete(t.id)}>🗑️ מחיקה</Btn>
          </div>
        </div>;
      })}
      {!trainers.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:"#bbb"}}><div style={{fontSize:48,marginBottom:12}}>👥</div><div style={{fontSize:16}}>אין מתאמנים עדיין</div></div>}
    </div>
  </div>;
}

function SavedSetsPage({db,onAdd,onEdit,onDelete}){
  const {savedSets}=db;
  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div>
        <div style={{fontSize:24,fontWeight:700,color:"#1a1a2e"}}>תבניות וסטים שמורים</div>
        <div style={{fontSize:14,color:"#666",marginTop:4}}>צור תבניות מוכנות מראש לשילוב מהיר בתוכניות</div>
      </div>
      <Btn primary onClick={onAdd}>+ תבנית חדשה</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
      {savedSets.map(s=>(
        <div key={s.id} onClick={()=>onEdit(s)} style={{background:"#fff",borderRadius:12,padding:"20px",cursor:"pointer",boxShadow:"0 2px 10px rgba(33,150,243,.06)",borderRight:"6px solid #00BCD4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{fontSize:18,fontWeight:700,color:"#1a1a2e"}}>{s.name}</div>
            <button onClick={(e)=>{e.stopPropagation(); onDelete(s.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer"}}>🗑</button>
          </div>
          <div style={{fontSize:14,color:"#666",marginBottom:16}}>{s.exercises?.length||0} תרגילים בסט</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {s.exercises?.slice(0,3).map(e=><span key={e.id} style={{background:"#f5f5f5",padding:"4px 8px",borderRadius:6,fontSize:11,color:"#555"}}>{e.name}</span>)}
            {s.exercises?.length>3&&<span style={{background:"#e3f2fd",padding:"4px 8px",borderRadius:6,fontSize:11,color:"#1565C0"}}>+{s.exercises.length-3}</span>}
          </div>
        </div>
      ))}
      {!savedSets.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:"#bbb",background:"#fff",borderRadius:16}}><div style={{fontSize:48,marginBottom:12}}>🗂️</div><div style={{fontSize:16}}>אין תבניות שמורות</div></div>}
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

  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:22,fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תבנית חדשה":"✏️ עריכת תבנית"}</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}><Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0"}}>ביטול</Btn><Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור תבנית</Btn></div>
    </div>
    <div style={{background:"#fff",borderRadius:16,padding:"24px",marginBottom:24,boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
      <label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>שם התבנית / סט</label>
      <input style={{width:"100%",maxWidth:400,padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit"}} value={prog.name} onChange={e=>setProg({...prog,name:e.target.value})} placeholder="למשל: סדרת חימום מלאה"/>
    </div>
    <div style={{background:"#fff",borderRadius:16,padding:"24px",boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24, paddingBottom:16, borderBottom:"1px solid #f0f0f0"}}>
        <div style={{fontSize:18,fontWeight:700,color:"#1a1a2e"}}>תרגילים בסט זה</div><Btn primary onClick={addExercise}>+ הוסף תרגיל</Btn>
      </div>
      {prog.exercises.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"#bbb", background:"#f8f9fa", borderRadius:12}}><div style={{fontSize:40,marginBottom:12}}>🏋️</div><div style={{fontSize:15, fontWeight:500}}>הוסף תרגילים לתבנית</div></div>}
      {prog.exercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:12,padding:"16px",marginBottom:16,border:"1px solid #e0e0e0", boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div className="exercise-row" style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"row",gap:8}}>
            <div style={{background:"#e0f7fa",color:"#0097a7",borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>{i+1}</div>
            <button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888"}}>▲</button>
            <button onClick={()=>moveEx(i,1)} disabled={i===prog.exercises.length-1} style={{background:"none",border:"none",cursor:i===prog.exercises.length-1?"default":"pointer",color:i===prog.exercises.length-1?"#ddd":"#888"}}>▼</button>
          </div>
          <input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, maxWidth:"400px", padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:15,direction:"rtl",outline:"none",fontWeight:600}}/>
          <button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:8,cursor:"pointer",color:"#d32f2f",width:36,height:36}}>🗑</button>
        </div>
        <div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"80px 80px 100px 1fr",gap:16,paddingRight:40}}>
          {[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0}].map(f=><div key={f.key}>
            <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>{f.label}</label>
            <input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/>
          </div>)}
          <div className="full-w"><label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,boxSizing:"border-box"}} placeholder="דגשים..."/></div>
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
  else if (prog.days.length !== Number(prog.sessionsPerWeek)) errorMsg = `יש להגדיר בדיוק ${prog.sessionsPerWeek} ימי אימון`;
  else if (!daysHaveExercises) errorMsg = "לכל יום חייב להיות לפחות תרגיל 1";

  const inputStyle={width:"100%",padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div className="exercise-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:22,fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תוכנית חדשה":"✏️ עריכת תוכנית"}</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {errorMsg && <div style={{background:"#ffebee",color:"#d32f2f",padding:"6px 12px",borderRadius:8,fontSize:13,fontWeight:600}}>{errorMsg}</div>}
        <Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0",color:"#555"}}>ביטול</Btn>
        <Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור</Btn>
      </div>
    </div>

    <div style={{background:"#fff",borderRadius:16,padding:"24px",marginBottom:24,boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
      <div className="mob-stack" style={{display:"grid",gridTemplateColumns:"1.5fr 2fr 1fr 1fr",gap:16}}>
        <div><label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>שם התוכנית</label><input style={{...inputStyle, borderColor: isDuplicateName ? "#d32f2f" : "#e0e0e0"}} value={prog.name} onChange={e=>upd({name:e.target.value})} placeholder="לדוגמה: פול בודי חיזוק"/></div>
        <div><label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>תיאור</label><input style={inputStyle} value={prog.desc} onChange={e=>upd({desc:e.target.value})} placeholder="תיאור (אופציונלי)"/></div>
        <div><label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>רמת קושי</label><select style={{...inputStyle, background:"#fff"}} value={prog.level} onChange={e=>upd({level:e.target.value})}>{["מתחיל","בינוני","מתקדם"].map(l=><option key={l}>{l}</option>)}</select></div>
        <div><label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>אימונים בשבוע</label><input style={inputStyle} type="number" min={1} max={7} value={prog.sessionsPerWeek} onChange={e=>upd({sessionsPerWeek:Number(e.target.value)})}/></div>
      </div>
    </div>

    <div className="builder-grid" style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:24,alignItems:"start"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"20px",boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontSize:14,fontWeight:600,color:"#555"}}>ימי האימון</div><div style={{fontSize:12,color:prog.days.length===Number(prog.sessionsPerWeek)?"#4CAF50":"#d32f2f",fontWeight:600}}>{prog.days.length} / {prog.sessionsPerWeek}</div></div>
        <div className="mob-grid-2" style={{display:"grid", gap:10}}>
          {prog.days.map((d,i)=><div key={d.id} style={{display:"flex",alignItems:"center",gap:8}}>
            <div onClick={()=>setSelDay(i)} style={{flex:1,padding:"10px 14px",borderRadius:10,cursor:"pointer",background:selDay===i?"#E3F2FD":"#f8f9fa",border:selDay===i?"2px solid #2196F3":"2px solid transparent",fontSize:14,fontWeight:selDay===i?600:500,color:selDay===i?"#1565C0":"#444"}}>{d.name||`יום ${i+1}`}</div>
            <button onClick={()=>removeDay(i)} style={{background:"#ffebee",border:"none",borderRadius:8,cursor:"pointer",color:"#d32f2f",width:32,height:32}}>✕</button>
          </div>)}
        </div>
        <Btn full onClick={addDay} disabled={prog.days.length>=7} style={{background:"#f0f4ff", color:"#1565C0", border:"2px dashed #90CAF9", marginTop:16}}>+ הוסף יום אימון</Btn>
      </div>

      {prog.days[selDay]?<div style={{background:"#fff",borderRadius:16,padding:"24px",boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24, paddingBottom:16, borderBottom:"1px solid #f0f0f0"}}>
          <div><input value={prog.days[selDay].name} onChange={e=>renameDay(selDay,e.target.value)} style={{fontSize:20,fontWeight:700,color:"#1a1a2e",border:"none",outline:"none",background:"transparent",fontFamily:"inherit",direction:"rtl", borderBottom:"2px solid transparent", paddingBottom:4, width:"100%"}} placeholder="שם היום (למשל: כוח עליון)"/></div>
          <div style={{display:"flex", gap:8}}><Btn style={{background:"#e0f7fa", color:"#0097a7"}} onClick={()=>setImportModalOpen(true)}>📥 ייבא סט שמור</Btn><Btn primary onClick={addExercise}>+ הוסף תרגיל</Btn></div>
        </div>
        {dayExercises.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"#bbb", background:"#f8f9fa", borderRadius:12}}><div style={{fontSize:40,marginBottom:12}}>🏋️</div><div style={{fontSize:15, fontWeight:500, color:"#d32f2f"}}>חובה להוסיף לפחות תרגיל אחד ליום זה</div></div>}
        {dayExercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:12,padding:"16px",marginBottom:16,border:"1px solid #e0e0e0", boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div className="exercise-row" style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{display:"flex",flexDirection:"row",gap:8}}>
              <div style={{background:"#e3f2fd",color:"#1565c0",borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888",fontSize:14}}>▲</button>
              <button onClick={()=>moveEx(i,1)} disabled={i===dayExercises.length-1} style={{background:"none",border:"none",cursor:i===dayExercises.length-1?"default":"pointer",color:i===dayExercises.length-1?"#ddd":"#888",fontSize:14}}>▼</button>
            </div>
            <input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל" style={{flex:1, maxWidth: "400px", padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:15,direction:"rtl",outline:"none",fontFamily:"inherit",fontWeight:600}}/>
            <button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:8,cursor:"pointer",color:"#d32f2f",width:36,height:36}}>🗑</button>
          </div>
          <div className="exercise-inputs" style={{display:"grid",gridTemplateColumns:"80px 80px 100px 100px 1fr",gap:16,paddingRight:40}}>
            {[{label:"סטים",key:"sets",type:"number",min:1},{label:"חזרות",key:"reps",type:"number",min:1},{label:"מנוחה (שנ')",key:"rest",type:"number",min:0},{label:"משקל (ק״ג)",key:"weight",type:"number",min:0}].map(f=><div key={f.key}>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6,whiteSpace:"nowrap"}}>{f.label}</label>
              <input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,boxSizing:"border-box"}}/>
            </div>)}
            <div className="full-w"><label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>הערות</label><input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,boxSizing:"border-box"}} placeholder="דגשים..."/></div>
          </div>
        </div>)}
      </div>:<div style={{background:"#fff",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",minHeight:400,color:"#bbb",flexDirection:"column",gap:16}}><div style={{fontSize:48}}>📋</div><div style={{fontSize:16, fontWeight:500}}>בחר יום מהרשימה</div></div>}
    </div>

    <Modal open={importModalOpen} onClose={()=>setImportModalOpen(false)} title="בחר תבנית לייבוא">
      <div style={{display:"flex",flexDirection:"column",gap:10, maxHeight:"400px", overflowY:"auto"}}>
        {savedSets.map(s=>(
          <div key={s.id} onClick={()=>importSavedSet(s.id)} style={{background:"#f8f9fa",padding:"16px",borderRadius:"12px",cursor:"pointer",border:"1px solid #e0e0e0",transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="#e3f2fd"} onMouseLeave={e=>e.currentTarget.style.background="#f8f9fa"}>
            <div style={{fontWeight:600,fontSize:16,color:"#1a1a2e"}}>{s.name}</div><div style={{fontSize:13,color:"#666",marginTop:4}}>{s.exercises.length} תרגילים בסט</div>
          </div>
        ))}
        {!savedSets.length && <div style={{textAlign:"center",padding:"20px",color:"#888"}}>אין תבניות שמורות במערכת. צור תבנית באזור "תבניות וסטים" קודם.</div>}
      </div>
    </Modal>
  </div>;
}

function ProgramsPage({db,onAdd,onEdit,onDelete,onAssign}){
  const {programs, trainers}=db;
  const [assignModalProg, setAssignModalProg] = useState(null);
  return <div className="main-pad" style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div style={{fontSize:24,fontWeight:700,color:"#1a1a2e"}}>תוכניות אימון</div><Btn primary onClick={onAdd}>+ תוכנית</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {programs.map(p=>(
        <div key={p.id} className="prog-card" onClick={()=>onEdit(p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:12,padding:"20px 24px",cursor:"pointer",boxShadow:"0 2px 10px rgba(33,150,243,.06)",borderRight:"6px solid #2196F3"}}>
          <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}><div style={{fontSize:18,fontWeight:700,color:"#1a1a2e"}}>{p.name}</div><span style={{background:"#e3f2fd",color:"#1565C0",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:600}}>{p.level}</span></div><div style={{fontSize:14,color:"#666"}}>{p.desc||"ללא תיאור לתוכנית זו"}</div></div>
          <div className="prog-stats" style={{display:"flex",alignItems:"center",gap:40,marginLeft:24}}><div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:"#1565C0"}}>{p.sessionsPerWeek}</div><div style={{fontSize:12,color:"#888"}}>אימונים בשבוע</div></div><div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:"#1565C0"}}>{p.days?.length||0}</div><div style={{fontSize:12,color:"#888"}}>ימים</div></div></div>
          <div className="prog-actions" style={{display:"flex",alignItems:"center",gap:16}}><Btn sm onClick={(e)=>{e.stopPropagation(); setAssignModalProg(p);}} style={{background:"#e3f2fd",color:"#1565C0"}}>🔗 שיוך</Btn><button onClick={(e)=>{e.stopPropagation(); onDelete(p.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:8,width:40,height:40,fontSize:18,cursor:"pointer"}}>🗑</button></div>
        </div>
      ))}
      {!programs.length&&<div style={{textAlign:"center",padding:"60px 0",color:"#bbb",background:"#fff",borderRadius:16}}><div style={{fontSize:48,marginBottom:12}}>📋</div><div style={{fontSize:16}}>אין תוכניות אימון</div></div>}
    </div>
    <Modal open={!!assignModalProg} onClose={()=>setAssignModalProg(null)} title={`שיוך תוכנית: ${assignModalProg?.name}`}>
      <div style={{display:"flex",flexDirection:"column",gap:10, maxHeight:"300px", overflowY:"auto", paddingRight:4}}>
        {trainers.map(t=>(<label key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"#f8f9fa",borderRadius:12,cursor:"pointer",border:"1px solid #e0e0e0"}}><div style={{display:"flex",alignItems:"center",gap:12}}><Avatar trainer={t} size={32}/><span style={{fontSize:15,fontWeight:500,color:"#1a1a2e"}}>{t.fname} {t.lname}</span></div><input type="checkbox" checked={t.programId === assignModalProg?.id} onChange={e => onAssign(t.id, e.target.checked ? assignModalProg.id : null)} style={{width:20,height:20,cursor:"pointer",accentColor:"#2196F3"}}/></label>))}
      </div>
      <div style={{marginTop:20}}><Btn primary full onClick={()=>setAssignModalProg(null)}>סיום ושמירה</Btn></div>
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
  else if (!form.email?.trim() || !emailRegex.test(form.email.trim())) errorMsg = "יש להזין כתובת אימייל תקינה (שדה חובה)";
  else if (!form.password || form.password.length < 8) errorMsg = "הסיסמה חייבת להכיל לפחות 8 תווים (שדה חובה)";
  else if (!form.phone?.trim() || !phoneRegex.test(form.phone.trim())) errorMsg = "מספר הטלפון חייב להכיל בדיוק 10 ספרות, ללא מקפים (לדוגמה: 0501234567)";

  const currentProgramName = form.programId ? programs.find(p=>p.id===form.programId)?.name : null;

  return <Modal open={open} onClose={onClose} title={initial?"עריכת מתאמן":"הוספת מתאמן חדש"}>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="שם פרטי *" value={form.fname} onChange={e=>set("fname",e.target.value)} placeholder="אותיות בעברית בלבד"/>
      <Inp label="שם משפחה *" value={form.lname} onChange={e=>set("lname",e.target.value)} placeholder="אותיות בעברית בלבד"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="אימייל *" type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} placeholder="email@example.com"/>
      <Inp label="סיסמה *" type="password" value={form.password||""} onChange={e=>set("password",e.target.value)} placeholder="לפחות 8 תווים"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="טלפון *" value={form.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="10 ספרות (לדוגמה 0501234567)"/>
      <Inp label="משקל - ק״ג" type="number" value={form.weight||""} onChange={e=>set("weight",e.target.value)} placeholder="אופציונלי"/>
    </div>
    <div className="modal-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="מטרת אימון" value={form.goal||""} onChange={e=>set("goal",e.target.value)} placeholder="אופציונלי"/>
      <div>
        <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4,fontWeight:500}}>תוכנית אימון משויכת</label>
        <div style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",background:"#f5f5f5",color:currentProgramName?"#1565C0":"#888",fontWeight:currentProgramName?600:400,fontFamily:"inherit"}}>
          {currentProgramName ? `📋 ${currentProgramName}` : "❌ ללא תוכנית"}
        </div>
      </div>
    </div>
    {!valid && errorMsg && <div style={{color:"#d32f2f",fontSize:13,fontWeight:600,marginTop:12,textAlign:"center",background:"#ffebee",padding:"8px",borderRadius:"6px"}}>{errorMsg}</div>}
    <div style={{display:"flex",gap:8,marginTop:16}}><Btn primary disabled={!valid} full onClick={()=>{ onSave({...form, goal: form.goal?.trim()}); onClose(); }}>{initial?"שמור שינויים":"הוסף מתאמן"}</Btn><Btn full onClick={onClose}>ביטול</Btn></div>
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

  if (authChecking) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",direction:"rtl",fontSize:24}}>בודק התחברות...</div>;
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;

  // תצוגת אזור מתאמנים - עדיין בבנייה
  if (role === "user") {
    return <div style={{display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"#F0F4FF", direction:"rtl", fontFamily:"sans-serif"}}>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        <div style={{background:"#fff", padding:"40px 60px", borderRadius:"24px", textAlign:"center", boxShadow:"0 10px 30px rgba(21,101,192,0.1)"}}>
            <div style={{fontSize:64, marginBottom:16}}>🚧</div>
            <h1 style={{color:"#1a1a2e", marginBottom:8}}>אזור מתאמנים</h1>
            <p style={{color:"#666", marginBottom:24, fontSize:16}}>האזור האישי שלך נמצא כרגע בבנייה. נחזור בקרוב!</p>
            <Btn primary onClick={handleLogout}>🚪 התנתק</Btn>
        </div>
    </div>;
  }

  // --- המשך תצוגת המנהל ---
  if(loading || !db) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",direction:"rtl",fontSize:24}}>טוען נתונים מהשרת...</div>;

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
    <div className="app-layout" style={{display:"flex",height:"100vh",direction:"rtl",fontFamily:"sans-serif"}}>
      <Sidebar page={page} setPage={navTo} onLogout={handleLogout} />
      {saving&&<div style={{position:"fixed",bottom:20,left:20,background:"#1565C0",color:"#fff",padding:"8px 16px",borderRadius:8,zIndex:9999}}>שומר...</div>}

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