import { useState, useEffect, useCallback } from "react";

// ─── API Configuration ────────────────────────────────────────────────────────
const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8000";

// ─── Storage DB (Local Fallback) ──────────────────────────────────────────────
const DB_KEY = "noamtrains_data_v2";

async function loadLocalDB() {
  try { 
    const r = localStorage.getItem(DB_KEY); 
    if (r) return JSON.parse(r); 
  } catch (_) {}
  return null;
}

async function saveLocalDB(data) {
  try { 
    localStorage.setItem(DB_KEY, JSON.stringify(data)); 
  } catch (e) { 
    console.error(e); 
  }
}

const defaultData = {
  trainers: [
    { id:1, fname:"דניאל", lname:"לוי",     email:"daniel@gmail.com", phone:"052-1111111", goal:"חיזוק שרירים",   programId:1, avatar:"" },
    { id:2, fname:"מיכל",  lname:"כהן",     email:"michal@gmail.com", phone:"054-2222222", goal:"ירידה במשקל",   programId:1, avatar:"" },
    { id:3, fname:"רוני",  lname:"ישראלי",  email:"roni@gmail.com",   phone:"050-3333333", goal:"כושר כללי",     programId:2, avatar:"" },
  ],
  programs: [],
  sessions:[],
  nextTrainerId:6, nextProgramId:3, nextSessionId:10,
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const COLORS = ["#2196F3","#1976D2","#00BCD4","#0097A7","#26A69A"];
const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const initials = t => (t.fname?.[0]||"")+(t.lname?.[0]||"");
const colorFor  = id => COLORS[(id-1)%COLORS.length];
let _uid = Date.now();
const uid = () => ++_uid;

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
const getDayCount = (sessions,tid,offset) => {
  const {sun}=getWeekRange();
  const d=new Date(sun); d.setDate(d.getDate()+offset);
  const ds=d.toISOString().slice(0,10);
  return sessions.filter(s=>s.trainerId===tid&&s.date===ds).length;
};

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
    <div style={{background:"#fff",borderRadius:16,padding:"24px 28px",width:wide?720:480,maxWidth:"96vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{fontSize:17,fontWeight:700,color:"#1a1a2e"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage}){
  const nav=[
    {id:"dashboard",icon:"🏠",label:"סקירה כללית"},
    {id:"trainers",icon:"👥",label:"מתאמנים"},
    {id:"programs",icon:"📋",label:"תוכניות אימון"},
    {id:"settings",icon:"⚙️",label:"הגדרות"},
  ];
  return <div style={{width:200,flexShrink:0,background:"#1565C0",display:"flex",flexDirection:"column",paddingTop:28}}>
    <div style={{textAlign:"center",marginBottom:32,paddingBottom:20,borderBottom:"1px solid rgba(255,255,255,.15)"}}>
      <div style={{fontSize:28,marginBottom:4}}>🏋️</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:18}}>FitCoach</div>
    </div>
    {nav.map(n=><div key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",cursor:"pointer",color:page===n.id?"#fff":"rgba(255,255,255,.7)",background:page===n.id?"rgba(255,255,255,.15)":"transparent",borderRight:page===n.id?"4px solid #fff":"4px solid transparent",fontWeight:page===n.id?600:400,fontSize:14,transition:"all .15s"}}>
      <span>{n.icon}</span>{n.label}
    </div>)}
  </div>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({db,onAddTrainer}){
  const {trainers,sessions}=db;
  const totalWeek=sessions.filter(s=>{const{sun,sat}=getWeekRange();return s.date>=sun&&s.date<=sat;}).length;
  const avgPer=trainers.length?(totalWeek/trainers.length).toFixed(1):0;
  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
      <div><div style={{fontSize:22,fontWeight:700,color:"#1a1a2e"}}>שלום מאמן! 👋</div><div style={{color:"#666",fontSize:14,marginTop:4}}>סקירת שבוע</div></div>
      <Btn primary onClick={onAddTrainer}>+ הוסף מתאמן</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:28}}>
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

// ─── Trainers Page ─────────────────────────────────────────────────────────────
function TrainersPage({db,onAdd,onDelete,onEdit,onSelect}){
  const {trainers,sessions,programs}=db;
  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:20,fontWeight:700,color:"#1a1a2e"}}>מתאמנים</div>
      <Btn primary onClick={onAdd}>+ הוסף מתאמן</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
      {trainers.map(t=>{
        const prog=t.programId?programs.find(p=>p.id===t.programId):null;
        const wc=getWeekCount(sessions,t.id);
        const freq=prog?.sessionsPerWeek||0;
        return <div key={t.id} onClick={()=>onSelect(t)} style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(33,150,243,.08)",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}><Avatar trainer={t} size={44}/>
            <div><div style={{fontWeight:600,fontSize:15,color:"#1a1a2e"}}>{t.fname} {t.lname}</div></div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn sm full onClick={e=>{e.stopPropagation();onEdit(t);}}>✏️ עריכה</Btn>
            <Btn sm full danger onClick={e=>{e.stopPropagation();onDelete(t.id);}}>🗑️ מחיקה</Btn>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ─── Trainer Detail ────────────────────────────────────────────────────────────
function TrainerDetail({trainer,db,onBack,onLogSession}){
  const {sessions,programs}=db;
  const prog=trainer.programId?programs.find(p=>p.id===trainer.programId):null;
  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"#2196F3",fontSize:14,marginBottom:20}}>← חזרה</button>
    <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 12px rgba(33,150,243,.08)"}}>
      <Avatar trainer={trainer} size={64}/>
      <div style={{fontWeight:700,fontSize:18,color:"#1a1a2e",marginTop:12}}>{trainer.fname} {trainer.lname}</div>
      <button onClick={()=>onLogSession(trainer)} style={{width:"100%",marginTop:20,padding:12,borderRadius:10,background:"#2196F3",color:"#fff",border:"none",cursor:"pointer",fontSize:14}}>+ רישום אימון</button>
    </div>
  </div>;
}

// ─── Program Builder ─────────────────────────────────────
function ProgramBuilder({program:initProg,onSave,onCancel}){
  const isNew=!initProg;
  const blankProg={name:"",desc:"",level:"בינוני",sessionsPerWeek:3,days:[]};
  const [prog,setProg]=useState(isNew?blankProg:{...initProg});
  const [selDay,setSelDay]=useState(0);
  const upd=patch=>setProg(p=>({...p,...patch}));

  const addDay=()=>{
    const n={id:uid(),name:`יום ${prog.days.length+1}`,exercises:[]};
    setProg(p=>({...p,days:[...p.days,n]}));
  };

  const dayExercises=prog.days[selDay]?.exercises||[];
  const addExercise=()=>{
    const exs=[...dayExercises,{id:uid(),name:"",sets:3,reps:10}];
    setProg(p=>({...p,days:p.days.map((d,i)=>i===selDay?{...d,exercises:exs}:d)}));
  };

  const valid=prog.name.trim()&&prog.days.length>0;

  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:20,fontWeight:700,color:"#1a1a2e"}}>{isNew?"תוכנית חדשה":"עריכת תוכנית"}</div>
      <div style={{display:"flex",gap:8}}>
        <Btn onClick={onCancel}>ביטול</Btn>
        <Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור תוכנית</Btn>
      </div>
    </div>

    <div style={{background:"#fff",borderRadius:16,padding:"20px 24px",marginBottom:20}}>
      <input style={{width:"100%",padding:"10px",border:"1.5px solid #e0e0e0",borderRadius:7}} value={prog.name} onChange={e=>upd({name:e.target.value})} placeholder="שם התוכנית"/>
    </div>

    <div style={{display:"flex",gap:20,alignItems:"start"}}>
      <div style={{width:200,background:"#fff",borderRadius:16,padding:"16px"}}>
        {prog.days.map((d,i)=><div key={d.id} onClick={()=>setSelDay(i)} style={{padding:"8px",background:selDay===i?"#E3F2FD":"#f9f9f9",cursor:"pointer",marginBottom:8}}>{d.name}</div>)}
        <button onClick={addDay}>+ הוסף יום</button>
      </div>

      {prog.days[selDay]&&<div style={{flex:1,background:"#fff",borderRadius:16,padding:"20px 24px"}}>
        <Btn sm primary onClick={addExercise}>+ הוסף תרגיל</Btn>
        {dayExercises.map((ex,i)=><div key={ex.id} style={{padding:"10px",background:"#F8FBFF",marginBottom:10,marginTop:10}}>
          <input value={ex.name} onChange={e=>{
            const val=e.target.value;
            setProg(p=>({...p,days:p.days.map((d,di)=>di===selDay?{...d,exercises:d.exercises.map((eObj,ei)=>ei===i?{...eObj,name:val}:eObj)}:d)}));
          }} placeholder="שם התרגיל"/>
        </div>)}
      </div>}
    </div>
  </div>;
}

// ─── Programs Page ───────────────────────────────────────────
function ProgramsPage({db,onAdd,onEdit,onDelete,onAssign}){
  const {programs}=db;
  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:20,fontWeight:700,color:"#1a1a2e"}}>תוכניות אימון</div>
      <Btn primary onClick={onAdd}>+ תוכנית חדשה</Btn>
    </div>
    {programs.map(p=><div key={p.id} style={{background:"#fff",padding:16,marginBottom:10,borderRadius:10}}>
      <div style={{fontWeight:"bold"}}>{p.name}</div>
      <Btn sm onClick={()=>onEdit(p)}>עריכה</Btn>
    </div>)}
  </div>;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function LogSessionModal({open,onClose,db,defaultTrainer,onSave}){
  return <Modal open={open} onClose={onClose} title="רישום אימון"><Btn onClick={onClose}>סגור</Btn></Modal>;
}
function TrainerModal({open,onClose,onSave,initial,programs}){
  return <Modal open={open} onClose={onClose} title="מתאמן"><Btn onClick={onClose}>סגור</Btn></Modal>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(){
  const [db,setDb]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [selectedTrainer,setSelectedTrainer]=useState(null);
  const [modal,setModal]=useState(null);
  const [editTarget,setEditTarget]=useState(null);
  const [logTarget,setLogTarget]=useState(null);
  const [programBuilderTarget,setProgramBuilderTarget]=useState(null);

  useEffect(()=>{ 
    async function initApp() {
      const localData = await loadLocalDB();
      const finalData = localData || defaultData;
      try {
        const res = await fetch(`${API_URL}/programs`);
        if (res.ok) {
          const apiPrograms = await res.json();
          if (apiPrograms && apiPrograms.length > 0) finalData.programs = apiPrograms;
        }
      } catch (error) {}
      setDb(finalData); setLoading(false); 
    }
    initApp();
  },[]);

  const updateDb=useCallback(async updater=>{
    setSaving(true);
    setDb(prev=>{
      const next=updater(prev);
      saveLocalDB(next).then(()=>setSaving(false));
      return next;
    });
  },[]);

  if(loading) return <div>טוען...</div>;

  const saveProgram=async prog=>{
    setSaving(true);
    let finalProg = prog;
    try {
      if (!prog.id || (typeof prog.id === 'number')) {
        const res = await fetch(`${API_URL}/programs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prog)
        });
        if (res.ok) {
          const apiData = await res.json();
          finalProg = { ...prog, id: apiData._id || apiData.id }; 
        }
      } 
    } catch(e) {}

    updateDb(prev=>{
      const isUpdate = prev.programs.some(p => p.id === finalProg.id);
      const newPrograms = isUpdate 
        ? prev.programs.map(p => p.id === finalProg.id ? finalProg : p)
        : [...prev.programs, { ...finalProg, id: finalProg.id || prev.nextProgramId }];
      return { ...prev, programs: newPrograms };
    });
    setProgramBuilderTarget(null);
    setSaving(false);
  };

  const navTo=p=>{ setPage(p); setSelectedTrainer(null); setProgramBuilderTarget(null); };
  const showBuilder=programBuilderTarget!==null;

  return <div style={{display:"flex",height:"100vh",direction:"rtl"}}>
    <Sidebar page={page} setPage={navTo}/>
    {saving&&<div style={{position:"fixed",bottom:20,left:20,background:"#1565C0",color:"#fff",padding:10}}>שומר...</div>}

    {showBuilder
      ? <ProgramBuilder program={programBuilderTarget==="new"?null:programBuilderTarget} onSave={saveProgram} onCancel={()=>setProgramBuilderTarget(null)}/>
      : <>
          {page==="dashboard"&&!selectedTrainer&&<Dashboard db={db} onAddTrainer={()=>setModal("add-trainer")}/>}
          {page==="trainers"&&!selectedTrainer&&<TrainersPage db={db} onAdd={()=>setModal("add-trainer")} onSelect={t=>setSelectedTrainer(t)}/>}
          {page==="trainers"&&selectedTrainer&&<TrainerDetail trainer={selectedTrainer} db={db} onBack={()=>setSelectedTrainer(null)}/>}
          {page==="programs"&&<ProgramsPage db={db} onAdd={()=>setProgramBuilderTarget("new")} onEdit={p=>setProgramBuilderTarget(p)} />}
        </>
    }
  </div>;
}