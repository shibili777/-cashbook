import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt      = n  => '₹' + Number(n).toLocaleString('en-IN')
const fmtDate  = d  => new Date(d + 'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
const today    = () => new Date().toISOString().split('T')[0]
const MODES    = ['cash','bank','upi','card']
const MICON    = {cash:'💵',bank:'🏦',upi:'📲',card:'💳'}
const COLORS   = ['#6366f1','#10b981','#f97316','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#06b6d4','#84cc16','#f43f5e']
const ICONS    = ['💰','🍱','🏠','📱','🚌','🛍️','💊','💼','🎁','⚡','☕','💅','🎮','📚','✈️','🏋️','🐾','🎵','🍕','🚗','💇','🎭','📦','🔧']

// normalise DB rows (snake_case → camelCase)
const nCat = c => ({id:c.id, name:c.name, type:c.type, color:c.color, icon:c.icon})
const nTx  = t => ({id:t.id, type:t.type, amount:Number(t.amount), title:t.title,
                    categoryId:t.category_id, mode:t.payment_mode, notes:t.notes||'', date:t.date})
const nTpl = t => ({id:t.id, title:t.title, type:t.type, amount:Number(t.amount),
                    categoryId:t.category_id, mode:t.payment_mode, isRecurring:t.is_recurring})

// ─── tiny charts ──────────────────────────────────────────────────────────────
function Donut({data, size=120}) {
  const total = data.reduce((s,d)=>s+d.value,0)
  if (!total) return <div style={{width:size,height:size,borderRadius:'50%',background:'var(--bg3)'}}/>
  let a = -90
  const slices = data.map(d=>{const deg=(d.value/total)*360,s=a;a+=deg;return{...d,s,deg}})
  const cx=size/2,cy=size/2,R=size/2-3,ri=R*.58
  const pt=(r,ang)=>[cx+r*Math.cos(ang*Math.PI/180),cy+r*Math.sin(ang*Math.PI/180)]
  return <svg width={size} height={size}>{slices.map((s,i)=>{
    if(s.deg<.5)return null
    const[x1,y1]=pt(R,s.s),[x2,y2]=pt(R,s.s+s.deg),[ix1,iy1]=pt(ri,s.s+s.deg),[ix2,iy2]=pt(ri,s.s)
    const lg=s.deg>180?1:0
    return <path key={i} d={`M${x1},${y1} A${R},${R} 0 ${lg},1 ${x2},${y2} L${ix1},${iy1} A${ri},${ri} 0 ${lg},0 ${ix2},${iy2} Z`} fill={s.color} opacity=".9"/>
  })}</svg>
}

function Bars({data,h=100}) {
  const max = Math.max(...data.map(d=>Math.max(d.in||0,d.out||0)),1)
  return <div style={{display:'flex',alignItems:'flex-end',gap:5,height:h}}>
    {data.map((d,i)=><div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
      <div style={{width:'100%',display:'flex',alignItems:'flex-end',gap:2,height:h-18}}>
        <div style={{flex:1,background:'var(--green)',borderRadius:'3px 3px 0 0',height:`${((d.in||0)/max)*100}%`,opacity:.85}}/>
        <div style={{flex:1,background:'var(--red)',borderRadius:'3px 3px 0 0',height:`${((d.out||0)/max)*100}%`,opacity:.85}}/>
      </div>
      <div style={{fontSize:9,color:'var(--t3)',textAlign:'center'}}>{d.label}</div>
    </div>)}
  </div>
}

function Spark({vals,h=50}) {
  if(vals.length<2)return null
  const max=Math.max(...vals.map(Math.abs),1),W=200
  const pts=vals.map((v,i)=>`${(i/(vals.length-1))*W},${h-((v+max)/(max*2))*(h-4)-2}`).join(' ')
  return <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
    <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
}

// ─── CSS variables ─────────────────────────────────────────────────────────────
const lightVars = `--bg:#f8f9fc;--bg2:#fff;--bg3:#eef0f7;--card:#fff;--t1:#1a1d2e;--t2:#5a6278;--t3:#9aa0b4;--border:#e2e5f0;--accent:#6366f1;--green:#16a34a;--red:#dc2626;--amber:#d97706;--sh:0 2px 16px rgba(0,0,0,.07);`
const darkVars  = `--bg:#0f1117;--bg2:#1a1d27;--bg3:#22263a;--card:#1e2236;--t1:#f1f5f9;--t2:#94a3b8;--t3:#64748b;--border:#2d3452;--accent:#6366f1;--green:#22c55e;--red:#f87171;--amber:#fbbf24;--sh:0 4px 24px rgba(0,0,0,.4);`

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif}
input,select,textarea,button{font-family:inherit}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
.page{padding:16px;max-width:480px;margin:0 auto;padding-bottom:92px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:var(--sh)}
.btn{padding:12px 20px;border-radius:12px;border:none;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;width:100%}
.btn:active{transform:scale(.97)}.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-p{background:var(--accent);color:#fff}
.btn-g{background:var(--green);color:#fff}
.btn-r{background:var(--red);color:#fff}
.btn-ghost{background:var(--bg3);color:var(--t2);border:none}
.inp{width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--bg);color:var(--t1);font-size:15px;outline:none;transition:border .15s}
.inp:focus{border-color:var(--accent)}
select.inp option{background:var(--card);color:var(--t1)}
.lbl{font-size:12px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block}
.fld{margin-bottom:14px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:13px;cursor:pointer;transition:all .15s;background:var(--bg);color:var(--t2);font-weight:600}
.chip.on{border-color:var(--accent);background:var(--accent);color:#fff}
.txrow{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:opacity .15s}
.txrow:hover{opacity:.78}.txrow:last-child{border-bottom:none}
.navbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--card);border-top:1px solid var(--border);display:flex;z-index:100;box-shadow:0 -4px 20px rgba(0,0,0,.1)}
.navi{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 4px 8px;cursor:pointer;gap:3px;border:none;background:none;color:var(--t3);transition:color .15s}
.navi.on{color:var(--accent)}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:22px;color:#fff;font-weight:700;font-size:14px;z-index:9999;animation:fadeUp .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.25)}
@keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:var(--card);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;animation:slideUp .25s ease}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.pbar{height:6px;border-radius:3px;background:var(--bg3);overflow:hidden;margin-top:4px}
.pfill{height:100%;border-radius:3px}
.spin{display:inline-block;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`

// ─── Auth screen ───────────────────────────────────────────────────────────────
function Auth({onAuth}) {
  const [mode,setMode]   = useState('login')
  const [email,setEmail] = useState('')
  const [pass,setPass]   = useState('')
  const [busy,setBusy]   = useState(false)
  const [msg,setMsg]     = useState(null)

  async function go() {
    if(!email||(mode!=='reset'&&!pass)){setMsg({t:'Fill all fields',err:true});return}
    setBusy(true);setMsg(null)
    try {
      if(mode==='login'){
        const{data,error}=await supabase.auth.signInWithPassword({email,password:pass})
        if(error)throw error
        onAuth(data.user)
      } else if(mode==='signup'){
        const{data,error}=await supabase.auth.signUp({email,password:pass})
        if(error)throw error
        if(data.session)onAuth(data.user)
        else{setMsg({t:'Check your email to confirm, then log in.',err:false});setMode('login')}
      } else {
        const{error}=await supabase.auth.resetPasswordForEmail(email)
        if(error)throw error
        setMsg({t:'Reset email sent!',err:false});setMode('login')
      }
    } catch(e){setMsg({t:e.message,err:true})}
    finally{setBusy(false)}
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:20,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 auto 12px'}}>💰</div>
          <div style={{fontSize:28,fontWeight:800,color:'var(--t1)'}}>CashBook</div>
          <div style={{fontSize:14,color:'var(--t3)',marginTop:4}}>Personal money manager</div>
        </div>
        <div className="card">
          {mode!=='reset'&&(
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:12,padding:4,marginBottom:20}}>
              {['login','signup'].map(m=>(
                <button key={m} onClick={()=>{setMode(m);setMsg(null)}}
                  style={{flex:1,padding:8,borderRadius:10,border:'none',fontWeight:700,fontSize:14,cursor:'pointer',transition:'all .2s',
                    background:mode===m?'var(--card)':'transparent',
                    color:mode===m?'var(--t1)':'var(--t3)',
                    boxShadow:mode===m?'0 1px 6px rgba(0,0,0,.1)':'none'}}>
                  {m==='login'?'Log In':'Sign Up'}
                </button>
              ))}
            </div>
          )}
          {mode==='reset'&&<div style={{fontWeight:700,fontSize:16,marginBottom:16}}>Reset Password</div>}
          {msg&&<div style={{padding:'10px 14px',borderRadius:10,marginBottom:14,fontSize:13,fontWeight:600,
            background:msg.err?'rgba(220,38,38,.1)':'rgba(16,185,129,.1)',
            color:msg.err?'var(--red)':'var(--green)'}}>{msg.t}</div>}
          <div className="fld">
            <label className="lbl">Email</label>
            <input className="inp" type="email" placeholder="you@example.com" value={email}
              onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/>
          </div>
          {mode!=='reset'&&<div className="fld">
            <label className="lbl">Password</label>
            <input className="inp" type="password" placeholder={mode==='signup'?'Min 6 characters':'Your password'} value={pass}
              onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/>
          </div>}
          <button className="btn btn-p" onClick={go} disabled={busy}>
            {busy?'Please wait…':mode==='login'?'Log In':mode==='signup'?'Create Account':'Send Reset Email'}
          </button>
          <div style={{textAlign:'center',marginTop:14}}>
            {mode==='login'&&<button onClick={()=>{setMode('reset');setMsg(null)}} style={{background:'none',border:'none',color:'var(--accent)',fontSize:13,cursor:'pointer',fontWeight:700}}>Forgot password?</button>}
            {mode==='reset'&&<button onClick={()=>{setMode('login');setMsg(null)}} style={{background:'none',border:'none',color:'var(--accent)',fontSize:13,cursor:'pointer',fontWeight:700}}>← Back to login</button>}
          </div>
        </div>
        {!import.meta.env.VITE_SUPABASE_URL&&(
          <div style={{marginTop:16,padding:'12px 16px',borderRadius:12,background:'rgba(251,191,36,.15)',border:'1px solid rgba(251,191,36,.4)',fontSize:13,color:'var(--amber)',fontWeight:600}}>
            ⚠️  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,setDark]   = useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [user,setUser]   = useState(null)
  const [ready,setReady] = useState(false)
  const [page,setPage]   = useState('dashboard')
  const [txs,setTxs]     = useState([])
  const [cats,setCats]   = useState([])
  const [tpls,setTpls]   = useState([])
  const [loading,setLoading] = useState(false)
  const [toast,setToast] = useState(null)
  const [modal,setModal] = useState(null)

  // auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setReady(true)})
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setUser(s?.user??null))
    return()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{user?loadAll():(setTxs([]),setCats([]),setTpls([]))},[user])

  async function loadAll() {
    setLoading(true)
    try {
      const[c,t,p]=await Promise.all([
        supabase.from('categories').select('*').order('created_at'),
        supabase.from('transactions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('quick_templates').select('*').order('sort_order'),
      ])
      if(c.error)throw c.error
      if(t.error)throw t.error
      if(p.error)throw p.error
      setCats(c.data.map(nCat))
      setTxs(t.data.map(nTx))
      setTpls(p.data.map(nTpl))
    } catch(e){pop('Load error: '+e.message,'var(--red)')}
    finally{setLoading(false)}
  }

  function pop(msg,color='var(--green)'){setToast({msg,color});setTimeout(()=>setToast(null),2500)}

  // ── tx CRUD ──────────────────────────────────────────────────
  async function addTx(tx) {
    const{data,error}=await supabase.from('transactions').insert({
      user_id:user.id,type:tx.type,amount:tx.amount,title:tx.title,
      category_id:tx.categoryId,payment_mode:tx.mode,notes:tx.notes||'',date:tx.date
    }).select().single()
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setTxs(p=>[nTx(data),...p])
    pop(tx.type==='in'?'Income added ✓':'Expense saved ✓')
  }

  async function editTx(tx) {
    const{error}=await supabase.from('transactions').update({
      amount:tx.amount,title:tx.title,category_id:tx.categoryId,
      payment_mode:tx.mode,notes:tx.notes||'',date:tx.date
    }).eq('id',tx.id)
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setTxs(p=>p.map(t=>t.id===tx.id?{...t,...tx}:t))
    pop('Updated ✓')
  }

  async function delTx(id) {
    const{error}=await supabase.from('transactions').delete().eq('id',id)
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setTxs(p=>p.filter(t=>t.id!==id))
    pop('Deleted','var(--red)')
  }

  // ── cat CRUD ─────────────────────────────────────────────────
  async function addCat(cat) {
    const{data,error}=await supabase.from('categories').insert({user_id:user.id,...cat}).select().single()
    if(error){pop('Error: '+error.message,'var(--red)');return null}
    const nc=nCat(data);setCats(p=>[...p,nc]);return nc
  }
  async function updateCat(cat) {
    const{error}=await supabase.from('categories').update({name:cat.name,color:cat.color,icon:cat.icon}).eq('id',cat.id)
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setCats(p=>p.map(c=>c.id===cat.id?{...c,...cat}:c));pop('Category updated ✓')
  }
  async function delCat(id) {
    if(txs.some(t=>t.categoryId===id)){alert('Category is used in transactions — remove those first.');return}
    const{error}=await supabase.from('categories').delete().eq('id',id)
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setCats(p=>p.filter(c=>c.id!==id));pop('Deleted','var(--red)')
  }

  // ── template CRUD ────────────────────────────────────────────
  async function addTpl(tpl) {
    const{data,error}=await supabase.from('quick_templates').insert({
      user_id:user.id,title:tpl.title,type:tpl.type,
      amount:tpl.amount,category_id:tpl.categoryId,payment_mode:tpl.mode
    }).select().single()
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setTpls(p=>[...p,nTpl(data)]);pop('Template saved ✓')
  }
  async function delTpl(id) {
    const{error}=await supabase.from('quick_templates').delete().eq('id',id)
    if(error){pop('Error: '+error.message,'var(--red)');return}
    setTpls(p=>p.filter(t=>t.id!==id))
  }

  async function signOut(){await supabase.auth.signOut();setPage('dashboard')}

  const catMap = useMemo(()=>Object.fromEntries(cats.map(c=>[c.id,c])),[cats])

  const NAV = [
    {id:'dashboard',icon:'⊞',label:'Home'},
    {id:'add-in',   icon:'+',label:'Cash In', ac:'var(--green)'},
    {id:'add-out',  icon:'−',label:'Spend',   ac:'var(--red)'},
    {id:'history',  icon:'≡',label:'History'},
    {id:'reports',  icon:'◷',label:'Reports'},
  ]
  const TITLES = {dashboard:'Overview','add-in':'Add Income','add-out':'Add Expense',history:'Transactions',reports:'Reports',categories:'Categories'}

  if(!ready) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1117',color:'#94a3b8',fontSize:14}}>Loading…</div>

  if(!user) return(
    <>
      <style>{`:root{${dark?darkVars:lightVars}}${CSS}`}</style>
      <Auth onAuth={setUser}/>
    </>
  )

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:'var(--bg)',color:'var(--t1)',minHeight:'100vh'}}>
      <style>{`:root{${dark?darkVars:lightVars}}${CSS}`}</style>

      {toast&&<div className="toast" style={{background:toast.color}}>{toast.msg}</div>}
      {modal&&<Modal modal={modal} setModal={setModal} cats={cats} catMap={catMap} editTx={editTx} delTx={delTx}/>}

      <div style={{maxWidth:480,margin:'0 auto',minHeight:'100vh',background:'var(--bg)'}}>

        {/* top bar */}
        <div style={{padding:'16px 16px 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11,color:'var(--t3)',fontWeight:700,letterSpacing:'.1em'}}>CASHBOOK</div>
            <div style={{fontSize:20,fontWeight:800}}>{TITLES[page]||''}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {loading&&<span className="spin" style={{fontSize:18,color:'var(--t3)'}}>⟳</span>}
            <Btn icon="🗂️" active={page==='categories'} onClick={()=>setPage('categories')}/>
            <Btn icon={dark?'☀️':'🌙'} onClick={()=>setDark(d=>!d)}/>
            <Btn icon="↪" onClick={signOut} title="Sign out"/>
          </div>
        </div>

        {page==='dashboard'  && <Dashboard txs={txs} catMap={catMap} setPage={setPage} setModal={setModal} tpls={tpls} addTx={addTx} delTpl={delTpl}/>}
        {page==='add-in'     && <AddForm   type="in"  cats={cats} addTx={addTx} setPage={setPage} tpls={tpls} addTpl={addTpl}/>}
        {page==='add-out'    && <AddForm   type="out" cats={cats} addTx={addTx} setPage={setPage} tpls={tpls} addTpl={addTpl}/>}
        {page==='history'    && <History   txs={txs} catMap={catMap} setModal={setModal}/>}
        {page==='reports'    && <Reports   txs={txs} catMap={catMap}/>}
        {page==='categories' && <CatsPage  cats={cats} addCat={addCat} updateCat={updateCat} delCat={delCat} txs={txs}/>}

        <nav className="navbar">
          {NAV.map(n=>(
            <button key={n.id} className={`navi${page===n.id?' on':''}`}
              onClick={()=>setPage(n.id)}
              style={page===n.id&&n.ac?{color:n.ac}:{}}>
              <span style={{fontSize:20,fontWeight:800,lineHeight:1}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:700}}>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

// small icon button
function Btn({icon,active,onClick,title}){
  return(
    <button onClick={onClick} title={title}
      style={{background:active?'var(--accent)':'var(--bg3)',border:'none',borderRadius:10,width:36,height:36,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',color:active?'#fff':'var(--t2)',flexShrink:0}}>
      {icon}
    </button>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({txs,catMap,setPage,setModal,tpls,addTx,delTpl}) {
  const td = today(), mo = td.slice(0,7)
  const totalIn  = txs.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0)
  const totalOut = txs.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0)
  const balance  = totalIn-totalOut
  const mIn  = txs.filter(t=>t.date.startsWith(mo)&&t.type==='in').reduce((s,t)=>s+t.amount,0)
  const mOut = txs.filter(t=>t.date.startsWith(mo)&&t.type==='out').reduce((s,t)=>s+t.amount,0)
  const todayTxs = txs.filter(t=>t.date===td)
  const catExp={}
  txs.filter(t=>t.type==='out').forEach(t=>{catExp[t.categoryId]=(catExp[t.categoryId]||0)+t.amount})
  const topCats=Object.entries(catExp).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>({...catMap[id],value:v})).filter(Boolean)

  return(
    <div className="page">
      {/* balance hero */}
      <div style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:20,padding:'22px 20px',marginBottom:14,color:'#fff',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-24,right:-24,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
        <div style={{position:'absolute',bottom:-32,left:-12,width:100,height:100,borderRadius:'50%',background:'rgba(255,255,255,.05)'}}/>
        <div style={{fontSize:11,opacity:.8,fontWeight:700,letterSpacing:'.08em'}}>CURRENT BALANCE</div>
        <div style={{fontSize:36,fontWeight:800,margin:'4px 0 14px',letterSpacing:'-.5px'}}>{fmt(balance)}</div>
        <div style={{display:'flex',gap:24}}>
          <div><div style={{fontSize:11,opacity:.7}}>TOTAL IN</div><div style={{fontSize:17,fontWeight:700}}>{fmt(totalIn)}</div></div>
          <div style={{width:1,background:'rgba(255,255,255,.2)'}}/>
          <div><div style={{fontSize:11,opacity:.7}}>TOTAL OUT</div><div style={{fontSize:17,fontWeight:700}}>{fmt(totalOut)}</div></div>
        </div>
      </div>

      {/* quick add */}
      {tpls.length>0&&(
        <div className="card">
          <div style={{fontSize:11,fontWeight:700,color:'var(--t3)',marginBottom:10,letterSpacing:'.05em'}}>⚡ QUICK ADD</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {tpls.map(t=>{
              const cat=catMap[t.categoryId]
              return(
                <button key={t.id} onClick={()=>addTx({...t,date:today(),notes:''})}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--t1)'}}>
                  <span>{cat?.icon}</span>
                  <span>{t.title}</span>
                  <span style={{color:t.type==='in'?'var(--green)':'var(--red)',fontWeight:800}}>{t.type==='in'?'+':'−'}{fmt(t.amount)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* month summary */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{fontWeight:700}}>This Month</span>
          <span style={{fontSize:12,color:'var(--t3)'}}>{new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'rgba(22,163,74,.1)',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'var(--green)',fontWeight:700}}>↑ INCOME</div>
            <div style={{fontSize:22,fontWeight:800,color:'var(--green)'}}>{fmt(mIn)}</div>
          </div>
          <div style={{background:'rgba(220,38,38,.1)',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'var(--red)',fontWeight:700}}>↓ EXPENSE</div>
            <div style={{fontSize:22,fontWeight:800,color:'var(--red)'}}>{fmt(mOut)}</div>
          </div>
        </div>
        {mIn>0&&(
          <div style={{marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t3)',marginBottom:4}}>
              <span>Spent {Math.round((mOut/mIn)*100)}% of income</span>
              <span style={{color:mOut<=mIn?'var(--green)':'var(--red)',fontWeight:700}}>{fmt(mIn-mOut)} left</span>
            </div>
            <div className="pbar"><div className="pfill" style={{width:`${Math.min((mOut/mIn)*100,100)}%`,background:mOut<=mIn?'var(--green)':'var(--red)'}}/></div>
          </div>
        )}
      </div>

      {/* top expenses */}
      {topCats.length>0&&(
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontWeight:700}}>Top Expenses</span>
            <Donut data={topCats} size={60}/>
          </div>
          {topCats.map((c,i)=>(
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}><span>{c.icon}</span><span style={{fontSize:14,fontWeight:600}}>{c.name}</span></div>
                <span style={{fontSize:14,fontWeight:700,color:'var(--red)'}}>{fmt(c.value)}</span>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${(c.value/topCats[0].value)*100}%`,background:c.color}}/></div>
            </div>
          ))}
        </div>
      )}

      {/* today */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontWeight:700}}>Today</span>
          <button onClick={()=>setPage('history')} style={{fontSize:13,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>See all →</button>
        </div>
        {todayTxs.length===0
          ?<div style={{textAlign:'center',color:'var(--t3)',padding:'16px 0',fontSize:14}}>No transactions today</div>
          :todayTxs.map(tx=><TxRow key={tx.id} tx={tx} catMap={catMap} onClick={()=>setModal({data:tx})}/>)
        }
      </div>
    </div>
  )
}

// ─── Add Form ──────────────────────────────────────────────────────────────────
function AddForm({type,cats,addTx,setPage,tpls,addTpl}) {
  const [form,setForm] = useState({amount:'',title:'',categoryId:'',mode:'cash',notes:'',date:today()})
  const [busy,setBusy] = useState(false)
  const myCats = cats.filter(c=>c.type===type)
  const myTpls = tpls.filter(t=>t.type===type)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function submit() {
    if(!form.amount||!form.title||!form.categoryId){alert('Fill amount, title and category');return}
    setBusy(true)
    await addTx({type,...form,amount:parseFloat(form.amount)})
    setBusy(false)
    setForm({amount:'',title:'',categoryId:'',mode:'cash',notes:'',date:today()})
    setPage('dashboard')
  }

  async function saveTpl() {
    if(!form.amount||!form.title||!form.categoryId){alert('Fill the form first');return}
    await addTpl({title:form.title,type,amount:parseFloat(form.amount),categoryId:form.categoryId,mode:form.mode})
  }

  return(
    <div className="page">
      {myTpls.length>0&&(
        <div className="card">
          <div style={{fontSize:11,fontWeight:700,color:'var(--t3)',marginBottom:8,letterSpacing:'.05em'}}>⚡ TEMPLATES — tap to fill</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {myTpls.map(t=>{
              const cat=cats.find(c=>c.id===t.categoryId)
              return(
                <button key={t.id}
                  onClick={()=>setForm(f=>({...f,title:t.title,amount:String(t.amount),categoryId:t.categoryId,mode:t.mode}))}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'6px 11px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontSize:12,fontWeight:600,color:'var(--t1)'}}>
                  {cat?.icon} {t.title}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="card">
        <div className="fld">
          <label className="lbl">Amount (₹)</label>
          <input className="inp" type="number" inputMode="decimal" placeholder="0.00" value={form.amount}
            onChange={e=>set('amount',e.target.value)} style={{fontSize:28,fontWeight:800}} autoFocus/>
        </div>
        <div className="fld">
          <label className="lbl">{type==='in'?'Income Source / Title':'Expense Title'}</label>
          <input className="inp" placeholder={type==='in'?'e.g. Salary, Freelance…':'e.g. Lunch, Rent, Recharge…'}
            value={form.title} onChange={e=>set('title',e.target.value)}/>
        </div>
        <div className="fld">
          <label className="lbl">Category</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {myCats.map(c=>(
              <button key={c.id} className={`chip${form.categoryId===c.id?' on':''}`} onClick={()=>set('categoryId',c.id)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <label className="lbl">Payment Mode</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {MODES.map(m=>(
              <button key={m} className={`chip${form.mode===m?' on':''}`} onClick={()=>set('mode',m)}>
                {MICON[m]} {m}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <label className="lbl">Date</label>
          <input className="inp" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
        </div>
        <div className="fld">
          <label className="lbl">Notes (optional)</label>
          <textarea className="inp" rows={2} placeholder="Any notes…" value={form.notes}
            onChange={e=>set('notes',e.target.value)} style={{resize:'none'}}/>
        </div>
        <button className={`btn ${type==='in'?'btn-g':'btn-r'}`} onClick={submit} disabled={busy}>
          {busy?'Saving…':type==='in'?'✓  Add Income':'✓  Record Expense'}
        </button>
        <button onClick={saveTpl}
          style={{marginTop:8,width:'100%',padding:'10px',borderRadius:12,border:'1.5px dashed var(--border)',background:'none',color:'var(--t3)',cursor:'pointer',fontSize:13,fontWeight:700}}>
          💾  Save as Quick Template
        </button>
      </div>
    </div>
  )
}

// ─── History ───────────────────────────────────────────────────────────────────
function History({txs,catMap,setModal}) {
  const [q,setQ]         = useState('')
  const [fType,setFType] = useState('all')
  const [fCat,setFCat]   = useState('all')
  const [fMo,setFMo]     = useState('')

  const allCats = useMemo(()=>[...new Set(txs.map(t=>t.categoryId))].map(id=>catMap[id]).filter(Boolean),[txs,catMap])

  const filtered = useMemo(()=>txs.filter(t=>{
    if(fType!=='all'&&t.type!==fType)return false
    if(fCat!=='all'&&t.categoryId!==fCat)return false
    if(fMo&&!t.date.startsWith(fMo))return false
    if(q){const ql=q.toLowerCase();if(!t.title.toLowerCase().includes(ql)&&!(t.notes||'').toLowerCase().includes(ql))return false}
    return true
  }),[txs,fType,fCat,fMo,q])

  const tIn  = filtered.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0)
  const tOut = filtered.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0)

  const grouped = useMemo(()=>{
    const g={}
    filtered.forEach(t=>{(g[t.date]=g[t.date]||[]).push(t)})
    return Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0]))
  },[filtered])

  function exportCSV() {
    const rows=[['Date','Type','Title','Category','Amount','Mode','Notes'],
      ...filtered.map(t=>[t.date,t.type==='in'?'Cash In':'Cash Out',t.title,catMap[t.categoryId]?.name||'',t.amount,t.mode,t.notes||''])]
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}))
    a.download=`cashbook-${today()}.csv`;a.click()
  }

  return(
    <div className="page">
      <div className="card" style={{padding:'12px 14px'}}>
        <input className="inp" placeholder="🔍  Search title or notes…" value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:10}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['all','in','out'].map(v=>(
            <button key={v} className={`chip${fType===v?' on':''}`} onClick={()=>setFType(v)} style={{fontSize:12,padding:'5px 10px'}}>
              {v==='all'?'All':v==='in'?'✚ In':'✖ Out'}
            </button>
          ))}
          <select className="inp" value={fCat} onChange={e=>setFCat(e.target.value)} style={{flex:1,padding:'5px 10px',fontSize:12,minWidth:120}}>
            <option value="all">All Categories</option>
            {allCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <input type="month" className="inp" value={fMo} onChange={e=>setFMo(e.target.value)} style={{flex:1,padding:'5px 10px',fontSize:12,minWidth:120}}/>
        </div>
      </div>

      {filtered.length>0&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 4px',marginBottom:8}}>
          <span style={{fontSize:12,color:'var(--t3)'}}>{filtered.length} transactions</span>
          <div style={{display:'flex',gap:12,fontSize:13,fontWeight:700}}>
            <span style={{color:'var(--green)'}}>+{fmt(tIn)}</span>
            <span style={{color:'var(--red)'}}>−{fmt(tOut)}</span>
          </div>
        </div>
      )}

      <button onClick={exportCSV}
        style={{display:'block',width:'100%',padding:'9px',marginBottom:12,borderRadius:12,border:'1.5px dashed var(--border)',background:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:700}}>
        ⬇  Export CSV
      </button>

      {grouped.length===0
        ?<div className="card" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No transactions found</div>
        :grouped.map(([date,rows])=>(
          <div key={date} className="card" style={{padding:'12px 16px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--t3)',marginBottom:8,letterSpacing:'.04em',display:'flex',justifyContent:'space-between'}}>
              <span>{fmtDate(date)}</span>
              <span>
                {rows.some(t=>t.type==='in')&&<span style={{color:'var(--green)',marginRight:8}}>+{fmt(rows.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0))}</span>}
                {rows.some(t=>t.type==='out')&&<span style={{color:'var(--red)'}}>−{fmt(rows.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0))}</span>}
              </span>
            </div>
            {rows.map(tx=><TxRow key={tx.id} tx={tx} catMap={catMap} onClick={()=>setModal({data:tx})}/>)}
          </div>
        ))
      }
    </div>
  )
}

// ─── Reports ───────────────────────────────────────────────────────────────────
function Reports({txs,catMap}) {
  const [tab,setTab] = useState('monthly')

  const months = useMemo(()=>{
    const m={}
    txs.forEach(t=>{const mo=t.date.slice(0,7);if(!m[mo])m[mo]={in:0,out:0};m[mo][t.type]+=t.amount})
    return Object.entries(m).sort().slice(-6).map(([k,v])=>({label:k.slice(5)+'/'+k.slice(2,4),in:v.in,out:v.out}))
  },[txs])

  const catTotals = useMemo(()=>{
    const c={}
    txs.filter(t=>t.type==='out').forEach(t=>{c[t.categoryId]=(c[t.categoryId]||0)+t.amount})
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([id,val])=>({cat:catMap[id],val})).filter(x=>x.cat)
  },[txs,catMap])

  const totalOut = catTotals.reduce((s,x)=>s+x.val,0)

  const trend = useMemo(()=>{
    let bal=0
    return [...txs].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{bal+=t.type==='in'?t.amount:-t.amount;return bal})
  },[txs])

  const bal = trend[trend.length-1]??0

  const TABS = [{id:'monthly',l:'Monthly'},{id:'categories',l:'Categories'},{id:'trend',l:'Trend'}]

  return(
    <div className="page">
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {TABS.map(t=><button key={t.id} className={`chip${tab===t.id?' on':''}`} onClick={()=>setTab(t.id)} style={{flex:1,justifyContent:'center'}}>{t.l}</button>)}
      </div>

      {tab==='monthly'&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:16}}>Monthly Income vs Expense</div>
          {months.length===0?<p style={{color:'var(--t3)',fontSize:14}}>No data yet</p>:<>
            <Bars data={months} h={120}/>
            <div style={{display:'flex',gap:16,marginTop:10,fontSize:12}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'var(--green)',display:'inline-block'}}/> Income</span>
              <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'var(--red)',display:'inline-block'}}/> Expense</span>
            </div>
            <div style={{marginTop:16}}>
              {[...months].reverse().map((m,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 1fr 1fr',gap:4,padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:13,alignItems:'center'}}>
                  <span style={{color:'var(--t3)',fontSize:12}}>{m.label}</span>
                  <span style={{color:'var(--green)',fontWeight:700}}>+{fmt(m.in)}</span>
                  <span style={{color:'var(--red)',fontWeight:700}}>−{fmt(m.out)}</span>
                  <span style={{fontWeight:800,textAlign:'right',color:m.in-m.out>=0?'var(--green)':'var(--red)'}}>{m.in-m.out>=0?'+':''}{fmt(m.in-m.out)}</span>
                </div>
              ))}
            </div>
          </>}
        </div>
      )}

      {tab==='categories'&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:14}}>Expense by Category</div>
          {catTotals.length===0?<p style={{color:'var(--t3)',fontSize:14}}>No expense data yet</p>:<>
            <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
              <Donut data={catTotals.map(x=>({...x.cat,value:x.val}))} size={150}/>
            </div>
            {catTotals.map((x,i)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><span>{x.cat.icon}</span><span style={{fontSize:14,fontWeight:600}}>{x.cat.name}</span></div>
                  <div><span style={{fontSize:14,fontWeight:700,color:'var(--red)'}}>{fmt(x.val)}</span><span style={{fontSize:11,color:'var(--t3)',marginLeft:6}}>{Math.round(x.val/totalOut*100)}%</span></div>
                </div>
                <div className="pbar"><div className="pfill" style={{width:`${(x.val/catTotals[0].val)*100}%`,background:x.cat.color}}/></div>
              </div>
            ))}
          </>}
        </div>
      )}

      {tab==='trend'&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:14}}>Balance Trend</div>
          <div style={{fontSize:32,fontWeight:800,color:bal>=0?'var(--green)':'var(--red)',marginBottom:2}}>{fmt(bal)}</div>
          <div style={{fontSize:13,color:'var(--t3)',marginBottom:16}}>Across {txs.length} transactions</div>
          {trend.length>=2?<Spark vals={trend} h={90}/>:<p style={{color:'var(--t3)',fontSize:14}}>Add more transactions to see trend</p>}
          <div style={{marginTop:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {l:'Total Income', v:fmt(txs.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0)),c:'var(--green)'},
              {l:'Total Expense',v:fmt(txs.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0)),c:'var(--red)'},
              {l:'Transactions', v:txs.length, c:'var(--accent)'},
              {l:'Categories used',v:[...new Set(txs.map(t=>t.categoryId))].length, c:'var(--t2)'},
            ].map((s,i)=>(
              <div key={i} style={{background:'var(--bg3)',borderRadius:12,padding:'12px 14px'}}>
                <div style={{fontSize:11,color:'var(--t3)',fontWeight:700,marginBottom:4}}>{s.l.toUpperCase()}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Categories Page ───────────────────────────────────────────────────────────
function CatsPage({cats,addCat,updateCat,delCat,txs}) {
  const [tab,setTab]     = useState('out')
  const [adding,setAdd]  = useState(false)
  const [editId,setEdit] = useState(null)
  const [form,setForm]   = useState({name:'',type:'out',color:'#6366f1',icon:'💡'})
  const [busy,setBusy]   = useState(false)

  function openAdd(){setEdit(null);setForm({name:'',type:tab,color:'#6366f1',icon:'💡'});setAdd(true)}
  function openEdit(c){setEdit(c.id);setForm({name:c.name,type:c.type,color:c.color,icon:c.icon});setAdd(true)}
  function cancel(){setAdd(false);setEdit(null)}

  async function save(){
    if(!form.name.trim()){alert('Enter a name');return}
    setBusy(true)
    if(editId) await updateCat({id:editId,...form})
    else       await addCat(form)
    setBusy(false);cancel()
  }

  const myCats = cats.filter(c=>c.type===tab)

  return(
    <div className="page">
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button className={`chip${tab==='in'?' on':''}`}  onClick={()=>{setTab('in'); cancel()}} style={{flex:1,justifyContent:'center'}}>↑ Income</button>
        <button className={`chip${tab==='out'?' on':''}`} onClick={()=>{setTab('out');cancel()}} style={{flex:1,justifyContent:'center'}}>↓ Expense</button>
      </div>

      {myCats.length>0&&(
        <div className="card">
          {myCats.map(c=>{
            const count=txs.filter(t=>t.categoryId===c.id).length
            return(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:38,height:38,borderRadius:10,background:c.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>{count} transaction{count!==1?'s':''}</div>
                </div>
                <div style={{width:10,height:10,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                <button onClick={()=>openEdit(c)} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,padding:'4px'}}>✏️</button>
                <button onClick={()=>delCat(c.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,padding:'4px',color:'var(--red)'}}>🗑️</button>
              </div>
            )
          })}
        </div>
      )}

      {adding&&(
        <div className="card">
          <div style={{fontWeight:700,fontSize:16,marginBottom:14}}>{editId?'Edit Category':'New Category'}</div>
          <div className="fld">
            <label className="lbl">Name</label>
            <input className="inp" placeholder="Category name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus/>
          </div>
          <div className="fld">
            <label className="lbl">Icon</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {ICONS.map(ic=>(
                <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))}
                  style={{width:38,height:38,borderRadius:10,border:`2px solid ${form.icon===ic?'var(--accent)':'var(--border)'}`,background:form.icon===ic?'rgba(99,102,241,.1)':'var(--bg)',fontSize:18,cursor:'pointer',transition:'all .15s'}}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="fld">
            <label className="lbl">Color</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {COLORS.map(col=>(
                <button key={col} onClick={()=>setForm(f=>({...f,color:col}))}
                  style={{width:30,height:30,borderRadius:'50%',background:col,border:`3px solid ${form.color===col?'var(--t1)':'transparent'}`,cursor:'pointer',transition:'border .15s'}}/>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-p" style={{flex:1}} onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</button>
            <button className="btn btn-ghost" style={{flex:1}} onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {!adding&&<button className="btn btn-p" onClick={openAdd}>+ Add {tab==='in'?'Income':'Expense'} Category</button>}
    </div>
  )
}

// ─── Transaction Modal ─────────────────────────────────────────────────────────
function Modal({modal,setModal,cats,catMap,editTx,delTx}) {
  const tx = modal.data
  const [editing,setEditing] = useState(false)
  const [form,setForm]       = useState({...tx})
  const [busy,setBusy]       = useState(false)
  const cat   = catMap[tx.categoryId]
  const myCats = cats.filter(c=>c.type===tx.type)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save(){
    setBusy(true)
    await editTx({...form,amount:parseFloat(form.amount)})
    setBusy(false);setModal(null)
  }
  async function del(){
    if(!confirm('Delete this transaction?'))return
    await delTx(tx.id);setModal(null)
  }

  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
      <div className="sheet">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:17}}>{editing?'Edit Transaction':'Transaction Details'}</div>
          <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'var(--t3)',lineHeight:1}}>×</button>
        </div>

        {!editing?(
          <>
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',borderBottom:'1px solid var(--border)',marginBottom:16}}>
              <div style={{width:54,height:54,borderRadius:16,background:(cat?.color||'#888')+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>{cat?.icon||'💸'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:17}}>{tx.title}</div>
                <div style={{fontSize:13,color:'var(--t3)',marginTop:2}}>{fmtDate(tx.date)} · {cat?.name}</div>
              </div>
              <div style={{fontWeight:800,fontSize:22,color:tx.type==='in'?'var(--green)':'var(--red)',flexShrink:0}}>
                {tx.type==='in'?'+':'−'}{fmt(tx.amount)}
              </div>
            </div>
            <div style={{background:'var(--bg3)',borderRadius:12,padding:'12px 14px',marginBottom:18}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:tx.notes?8:0}}>
                <span style={{fontSize:13,color:'var(--t3)'}}>Payment mode</span>
                <span style={{fontSize:13,fontWeight:700}}>{MICON[tx.mode]} {tx.mode}</span>
              </div>
              {tx.notes&&<div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:13,color:'var(--t3)'}}>Notes</span>
                <span style={{fontSize:13,maxWidth:'60%',textAlign:'right'}}>{tx.notes}</span>
              </div>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setEditing(true)}>✏️  Edit</button>
              <button className="btn" style={{flex:1,background:'rgba(220,38,38,.1)',color:'var(--red)',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer'}} onClick={del}>🗑️  Delete</button>
            </div>
          </>
        ):(
          <>
            <div className="fld">
              <label className="lbl">Amount</label>
              <input className="inp" type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} style={{fontSize:22,fontWeight:800}}/>
            </div>
            <div className="fld">
              <label className="lbl">Title</label>
              <input className="inp" value={form.title} onChange={e=>set('title',e.target.value)}/>
            </div>
            <div className="fld">
              <label className="lbl">Category</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {myCats.map(c=><button key={c.id} className={`chip${form.categoryId===c.id?' on':''}`} onClick={()=>set('categoryId',c.id)}>{c.icon} {c.name}</button>)}
              </div>
            </div>
            <div className="fld">
              <label className="lbl">Mode</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {MODES.map(m=><button key={m} className={`chip${form.mode===m?' on':''}`} onClick={()=>set('mode',m)}>{MICON[m]} {m}</button>)}
              </div>
            </div>
            <div className="fld">
              <label className="lbl">Date</label>
              <input className="inp" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
            </div>
            <div className="fld">
              <label className="lbl">Notes</label>
              <textarea className="inp" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'none'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-p" style={{flex:1}} onClick={save} disabled={busy}>{busy?'Saving…':'Save Changes'}</button>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Shared TxRow ──────────────────────────────────────────────────────────────
function TxRow({tx,catMap,onClick}) {
  const cat = catMap[tx.categoryId]
  return(
    <div className="txrow" onClick={onClick}>
      <div style={{width:40,height:40,borderRadius:12,background:(cat?.color||'#888')+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
        {cat?.icon||'💸'}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{tx.title}</div>
        <div style={{fontSize:12,color:'var(--t3)'}}>{cat?.name} · {MICON[tx.mode]} {tx.mode}</div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontWeight:800,fontSize:15,color:tx.type==='in'?'var(--green)':'var(--red)'}}>
          {tx.type==='in'?'+':'−'}{fmt(tx.amount)}
        </div>
        {tx.notes&&<div style={{fontSize:11,color:'var(--t3)',maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.notes}</div>}
      </div>
    </div>
  )
}
