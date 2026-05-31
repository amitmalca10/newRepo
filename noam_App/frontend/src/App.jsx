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
function ProgramBuilder({program:initProg,onSave,onCancel}){
  const isNew=!initProg;
  const blankProg={name:"",desc:"",level:"בינוני",sessionsPerWeek:3,days:[]};
  const [prog,setProg]=useState(isNew?blankProg:{...initProg,days:initProg.days?.map(d=>({...d,exercises:d.exercises?.map(e=>({...e}))}))||[]});
  const [selDay,setSelDay]=useState(0);

  const upd=patch=>setProg(p=>({...p,...patch}));

  const addDay=()=>{
    const n={id:uid(),name:`יום ${prog.days.length+1}`,exercises:[]};
    setProg(p=>({...p,days:[...p.days,n]}));
    setSelDay(prog.days.length);
  };
  const removeDay=idx=>{
    setProg(p=>({...p,days:p.days.filter((_,i)=>i!==idx)}));
    setSelDay(s=>Math.max(0,s-(s>=idx?1:0)));
  };
  const renameDay=(idx,name)=>setProg(p=>({...p,days:p.days.map((d,i)=>i===idx?{...d,name}:d)}));

  const dayExercises=prog.days[selDay]?.exercises||[];
  const updExercises=exs=>setProg(p=>({...p,days:p.days.map((d,i)=>i===selDay?{...d,exercises:exs}:d)}));
  
  const addExercise=()=>updExercises([...dayExercises,{id:uid(),name:"",sets:3,reps:10,rest:60,note:""}]);
  const removeExercise=id=>updExercises(dayExercises.filter(e=>e.id!==id));
  const updExercise=(id,patch)=>updExercises(dayExercises.map(e=>e.id===id?{...e,...patch}:e));
  const moveEx=(idx,dir)=>{
    const exs=[...dayExercises];
    const to=idx+dir;
    if(to<0||to>=exs.length) return;
    [exs[idx],exs[to]]=[exs[to],exs[idx]];
    updExercises(exs);
  };

  // ─── בדיקות תקינות (ולידציה) ───
  const daysHaveExercises = prog.days.length > 0 && prog.days.every(d => d.exercises && d.exercises.length > 0);
  const daysMatchConfig = prog.days.length === Number(prog.sessionsPerWeek);
  const valid = prog.name.trim() && daysHaveExercises && daysMatchConfig;

  let errorMsg = "";
  if (!prog.name.trim()) errorMsg = "יש להזין שם לתוכנית";
  else if (prog.days.length !== Number(prog.sessionsPerWeek)) errorMsg = `יש להגדיר בדיוק ${prog.sessionsPerWeek} ימי אימון (בנית ${prog.days.length} עד כה)`;
  else if (!daysHaveExercises) errorMsg = "לכל יום חייב להיות לפחות תרגיל 1";

  const inputStyle={width:"100%",padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.2s"};

  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:22,fontWeight:700,color:"#1a1a2e"}}>{isNew?"✨ תוכנית אימון חדשה":"✏️ עריכת תוכנית"}</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {/* הצגת שגיאת הולידציה במידה ויש */}
        {errorMsg && <div style={{background:"#ffebee",color:"#d32f2f",padding:"6px 12px",borderRadius:8,fontSize:13,fontWeight:600}}>{errorMsg}</div>}
        
        <Btn onClick={onCancel} style={{background:"#fff",border:"1.5px solid #e0e0e0",color:"#555"}}>ביטול</Btn>
        <Btn primary disabled={!valid} onClick={()=>onSave(prog)}>💾 שמור תוכנית</Btn>
      </div>
    </div>

    {/* פרטי התוכנית */}
    <div style={{background:"#fff",borderRadius:16,padding:"24px",marginBottom:24,boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
      <div style={{fontSize:16,fontWeight:600,color:"#1a1a2e",marginBottom:16}}>הגדרות בסיסיות</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr",gap:16}}>
        <div>
          <label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>שם התוכנית</label>
          <input style={inputStyle} value={prog.name} onChange={e=>upd({name:e.target.value})} placeholder="לדוגמה: פול בודי חיזוק" onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
        </div>
        <div>
          <label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>תיאור</label>
          <input style={inputStyle} value={prog.desc} onChange={e=>upd({desc:e.target.value})} placeholder="תיאור קצר (אופציונלי)" onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
        </div>
        <div>
          <label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>רמת קושי</label>
          <select style={{...inputStyle, background:"#fff", cursor:"pointer"}} value={prog.level} onChange={e=>upd({level:e.target.value})} onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}>
            {["מתחיל","בינוני","מתקדם"].map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:"#555",display:"block",marginBottom:6,fontWeight:500}}>אימונים בשבוע</label>
          <input style={inputStyle} type="number" min={1} max={7} value={prog.sessionsPerWeek} onChange={e=>upd({sessionsPerWeek:Number(e.target.value)})} onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
        </div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:24,alignItems:"start"}}>
      {/* סרגל ימים */}
      <div style={{background:"#fff",borderRadius:16,padding:"20px",boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:"#555"}}>ימי האימון</div>
          <div style={{fontSize:12,color:prog.days.length===Number(prog.sessionsPerWeek)?"#4CAF50":"#d32f2f",fontWeight:600}}>{prog.days.length} / {prog.sessionsPerWeek}</div>
        </div>
        {prog.days.map((d,i)=><div key={d.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div onClick={()=>setSelDay(i)} style={{flex:1,padding:"10px 14px",borderRadius:10,cursor:"pointer",background:selDay===i?"#E3F2FD":"#f8f9fa",border:selDay===i?"2px solid #2196F3":"2px solid transparent",fontSize:14,fontWeight:selDay===i?600:500,color:selDay===i?"#1565C0":"#444",transition:"all 0.2s"}}>
            {d.name||`יום ${i+1}`}
          </div>
          <button onClick={()=>removeDay(i)} style={{background:"#ffebee",border:"none",borderRadius:8,cursor:"pointer",color:"#d32f2f",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"background 0.2s"}}>✕</button>
        </div>)}
        <Btn full onClick={addDay} disabled={prog.days.length>=7} style={{background:"#f0f4ff", color:"#1565C0", border:"2px dashed #90CAF9", marginTop:8}}>+ הוסף יום אימון</Btn>
      </div>

      {/* עורך תרגילים */}
      {prog.days[selDay]?<div style={{background:"#fff",borderRadius:16,padding:"24px",boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24, paddingBottom:16, borderBottom:"1px solid #f0f0f0"}}>
          <div>
            <input value={prog.days[selDay].name} onChange={e=>renameDay(selDay,e.target.value)}
              style={{fontSize:20,fontWeight:700,color:"#1a1a2e",border:"none",outline:"none",background:"transparent",fontFamily:"inherit",direction:"rtl", borderBottom:"2px solid transparent", paddingBottom:4, transition:"border-color 0.2s"}}
              onFocus={e=>e.target.style.borderBottomColor="#2196F3"} onBlur={e=>e.target.style.borderBottomColor="transparent"} placeholder="שם היום (למשל: כוח עליון)"/>
            <div style={{fontSize:13,color:"#888",marginTop:4}}>{dayExercises.length} תרגילים ביום זה</div>
          </div>
          <Btn primary onClick={addExercise}>+ הוסף תרגיל</Btn>
        </div>

        {dayExercises.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"#bbb", background:"#f8f9fa", borderRadius:12}}>
          <div style={{fontSize:40,marginBottom:12}}>🏋️</div>
          <div style={{fontSize:15, fontWeight:500, color:"#d32f2f"}}>חובה להוסיף לפחות תרגיל אחד ליום זה</div>
          <div style={{fontSize:13, marginTop:4}}>לחץ על "הוסף תרגיל" כדי להתחיל לבנות את האימון</div>
        </div>}

        {dayExercises.map((ex,i)=><div key={ex.id} style={{background:"#ffffff",borderRadius:12,padding:"16px",marginBottom:16,border:"1px solid #e0e0e0", boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <button onClick={()=>moveEx(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"#ddd":"#888",fontSize:14}}>▲</button>
              <button onClick={()=>moveEx(i,1)} disabled={i===dayExercises.length-1} style={{background:"none",border:"none",cursor:i===dayExercises.length-1?"default":"pointer",color:i===dayExercises.length-1?"#ddd":"#888",fontSize:14}}>▼</button>
            </div>
            <div style={{background:"#e3f2fd",color:"#1565c0",borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>{i+1}</div>
            
            <input value={ex.name} onChange={e=>updExercise(ex.id,{name:e.target.value})} placeholder="שם התרגיל (למשל: סקוואט)"
              style={{flex:1,padding:"10px 14px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:15,direction:"rtl",outline:"none",fontFamily:"inherit",fontWeight:600, transition:"border-color 0.2s"}}
              onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
            
            <button onClick={()=>removeExercise(ex.id)} style={{background:"#ffebee",border:"none",borderRadius:8,cursor:"pointer",color:"#d32f2f",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"background 0.2s"}}>🗑</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 2fr",gap:16,paddingRight:40}}>
            {[{label:"סטים",key:"sets",type:"number",min:1,holder:"3"},{label:"חזרות (לסט)",key:"reps",type:"number",min:1,holder:"10"},{label:"מנוחה (שניות)",key:"rest",type:"number",min:0,holder:"60"}].map(f=><div key={f.key}>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6,fontWeight:500}}>{f.label}</label>
              <input type={f.type} min={f.min} value={ex[f.key]||""} onChange={e=>updExercise(ex.id,{[f.key]:e.target.value===""?null:Number(e.target.value)})} placeholder={f.holder}
                style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box", transition:"border-color 0.2s"}}
                onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
            </div>)}
            <div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6,fontWeight:500}}>הערות / דגשים</label>
              <input value={ex.note||""} onChange={e=>updExercise(ex.id,{note:e.target.value})} placeholder="למשל: לשמור על גב ישר"
                style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e0e0e0",borderRadius:8,fontSize:14,direction:"rtl",outline:"none",fontFamily:"inherit",boxSizing:"border-box", transition:"border-color 0.2s"}}
                onFocus={e=>e.target.style.borderColor="#2196F3"} onBlur={e=>e.target.style.borderColor="#e0e0e0"}/>
            </div>
          </div>
        </div>)}
      </div>:<div style={{background:"#fff",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",minHeight:400,color:"#bbb",flexDirection:"column",gap:16,boxShadow:"0 4px 16px rgba(33,150,243,.06)"}}>
        <div style={{fontSize:48}}>📋</div><div style={{fontSize:16, fontWeight:500}}>בחר יום מהרשימה או הוסף יום חדש</div>
      </div>}
    </div>
  </div>;
}

// ─── Programs Page (החלף את הרכיב הקיים בזה) ───────────────────────────────────────────
function ProgramsPage({db,onAdd,onEdit,onDelete}){
  const {programs}=db;
  
  return <div style={{padding:"28px 32px",direction:"rtl",flex:1,overflowY:"auto",background:"#F0F4FF"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <div style={{fontSize:24,fontWeight:700,color:"#1a1a2e"}}>תוכניות אימון</div>
      <Btn primary onClick={onAdd}>+ תוכנית חדשה</Btn>
    </div>
    
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {programs.map(p=>(
        <div key={p.id} onClick={()=>onEdit(p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:12,padding:"20px 24px",cursor:"pointer",boxShadow:"0 2px 10px rgba(33,150,243,.06)",borderRight:"6px solid #2196F3",transition:"transform 0.2s, box-shadow 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(33,150,243,.12)"}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 10px rgba(33,150,243,.06)"}}>
          
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{fontSize:18,fontWeight:700,color:"#1a1a2e"}}>{p.name}</div>
              <span style={{background:"#e3f2fd",color:"#1565C0",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:600}}>{p.level}</span>
            </div>
            <div style={{fontSize:14,color:"#666"}}>{p.desc||"ללא תיאור לתוכנית זו"}</div>
          </div>
          
          <div style={{display:"flex",alignItems:"center",gap:40,marginLeft:24}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#1565C0"}}>{p.sessionsPerWeek}</div>
              <div style={{fontSize:12,color:"#888"}}>אימונים בשבוע</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#1565C0"}}>{p.days?.length||0}</div>
              <div style={{fontSize:12,color:"#888"}}>ימים מוגדרים</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#1565C0"}}>
                {p.days?.reduce((total, day) => total + (day.exercises?.length || 0), 0) || 0}
              </div>
              <div style={{fontSize:12,color:"#888"}}>סה"כ תרגילים</div>
            </div>
          </div>
          
          {/* כפתור מחיקה שלא יפעיל את העריכה כשלוחצים עליו */}
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <button onClick={(e)=>{e.stopPropagation(); onDelete(p.id);}} style={{background:"#fff0f0",color:"#d32f2f",border:"none",borderRadius:8,width:40,height:40,fontSize:18,cursor:"pointer",transition:"background 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffebee"} onMouseLeave={e=>e.currentTarget.style.background="#fff0f0"}>
              🗑
            </button>
            <div style={{color:"#ccc",fontSize:24,fontWeight:"bold", transform:"rotate(180deg)"}}>❯</div>
          </div>
        </div>
      ))}
      
      {!programs.length&&<div style={{textAlign:"center",padding:"60px 0",color:"#bbb",background:"#fff",borderRadius:16,boxShadow:"0 2px 10px rgba(33,150,243,.06)"}}>
        <div style={{fontSize:48,marginBottom:12}}>📋</div>
        <div style={{fontSize:16}}>אין תוכניות אימון במערכת</div>
      </div>}
    </div>
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

  const saveProgram = async (prog) => {
    setSaving(true);
    let finalProg = prog;

    try {
      // בדיקה אם התוכנית כבר קיימת בבסיס הנתונים (יש לה ID של MongoDB - מחרוזת)
      const isExisting = prog.id && typeof prog.id === 'string';

      if (isExisting) {
        // כאן ניתן להוסיף קריאת PUT לשרת אם תרצה לעדכן גם ב-Backend
        // לעת עתה נעדכן את ה-State המקומי
        finalProg = prog;
      } else {
        // יצירת תוכנית חדשה בשרת
        const res = await fetch(`${API_URL}/programs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prog)
        });
        if (res.ok) {
          const apiData = await res.json();
          // ה-ID החדש מה-DB
          finalProg = { ...prog, id: apiData._id || apiData.id }; 
        }
      }
    } catch(e) {
      console.warn("API save failed. Saving locally.");
    }

    // עדכון ה-State של האפליקציה
    updateDb(prev => {
      // בדיקה אם התוכנית כבר קיימת במערך הקיים
      const index = prev.programs.findIndex(p => p.id === finalProg.id);
      
      let newPrograms = [...prev.programs];
      if (index !== -1) {
        // עדכון תוכנית קיימת
        newPrograms[index] = finalProg;
      } else {
        // הוספת תוכנית חדשה
        newPrograms.push({ ...finalProg, id: finalProg.id || prev.nextProgramId });
      }
      
      return { 
        ...prev, 
        programs: newPrograms,
        nextProgramId: index !== -1 ? prev.nextProgramId : prev.nextProgramId + 1 
      };
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