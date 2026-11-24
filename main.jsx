import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Flame, Target, Clock3, Bell, Trophy, LogOut, CheckCircle2, Plus, Sparkles, ShieldCheck, CreditCard, CalendarClock } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const ADMIN_EMAIL = 'shubhamshxrma987@gmail.com';
const DEFAULT_PRICE = { currency_code:'INR', symbol:'₹', monthly:399, yearly:3999, ai_monthly:100, rate_date:'INR base price' };

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [tab, setTab] = useState('Today');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [authMode, setAuthMode] = useState('signin');
  const [taskTitle, setTaskTitle] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [coupon, setCoupon] = useState('');
  const [addingAI, setAddingAI] = useState(false);
  const [localPrice, setLocalPrice] = useState(DEFAULT_PRICE);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) loadData();
    else { setProfile(null); setSubscription(null); setTasks([]); setReminders([]); setLoading(false); }
  }, [session?.user?.id]);

  async function loadData() {
    setLoading(true);
    try {
      const u = session.user;
      const [{ data: p }, { data: s }, { data: t }, { data: r }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('tasks').select('*').eq('user_id', u.id).order('created_at', { ascending: false }),
        supabase.from('reminders').select('*').eq('user_id', u.id).order('remind_at', { ascending: true })
      ]);
      setProfile(p); setSubscription(s); setTasks(t || []); setReminders(r || []);
      if (p) { const { data: quote, error: quoteError } = await supabase.functions.invoke('get-pricing', { body: {} }); if (!quoteError && quote?.currency_code) setLocalPrice(quote); }
      if (!p) {
        const { error } = await supabase.from('profiles').insert({ id: u.id, email: u.email, display_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'DayForge User', country_code: u.user_metadata?.country_code || 'IN', currency_code: ({IN:'INR',US:'USD',GB:'GBP',NG:'NGN',CA:'CAD',AU:'AUD',AE:'AED',EU:'EUR'})[u.user_metadata?.country_code || 'IN'] || 'INR' });
        if (!error) { const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single(); setProfile(data); const { data: quote } = await supabase.functions.invoke('get-pricing', { body: {} }); if (quote?.currency_code) setLocalPrice(quote); }
      }
    } catch (e) { setMessage(e.message || 'Could not load your account.'); }
    setLoading(false);
  }

  const isAdmin = profile?.role === 'admin' && session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = trialEnd && trialEnd.getTime() > Date.now();
  const paidActive = subscription?.status === 'active' && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  const hasAccess = Boolean(isAdmin || trialActive || paidActive);
  const daysLeft = trialActive ? Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;
  const fmtPrice = (amount) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(amount));

  async function signIn(e) {
    e.preventDefault(); setMessage('');
    if (!supabase) { setMessage('Add your Supabase URL and anon key in GitHub repository secrets / .env, then rebuild.'); return; }
    const fn = authMode === 'signup' ? supabase.auth.signUp({ email, password, options: { data: { full_name: name, country_code: countryCode } } }) : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    if (error) setMessage(error.message);
    else if (authMode === 'signup') setMessage('Check your email to verify your account, then sign in.');
  }
  async function signOut() { await supabase.auth.signOut(); }
  async function addTask(e) {
    e.preventDefault(); if (!taskTitle.trim()) return;
    const { data, error } = await supabase.from('tasks').insert({ user_id: session.user.id, title: taskTitle.trim() }).select().single();
    if (error) setMessage(error.message); else { setTasks([data, ...tasks]); setTaskTitle(''); }
  }
  async function toggleTask(task) {
    const { data, error } = await supabase.from('tasks').update({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }).eq('id', task.id).select().single();
    if (error) setMessage(error.message); else setTasks(tasks.map(t => t.id === task.id ? data : t));
  }
  async function addReminder(e) {
    e.preventDefault(); if (!reminderTitle.trim() || !reminderAt) return;
    const date = new Date(reminderAt);
    if (date <= new Date()) { setMessage('Choose a future reminder time.'); return; }
    const { data, error } = await supabase.from('reminders').insert({ user_id: session.user.id, title: reminderTitle.trim(), remind_at: date.toISOString() }).select().single();
    if (error) { setMessage(error.message); return; }
    setReminders([...reminders, data].sort((a,b) => new Date(a.remind_at)-new Date(b.remind_at)));
    if (Capacitor.isNativePlatform()) {
      try { await LocalNotifications.requestPermissions(); await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now()%2147483000), title: 'DayForge reminder', body: data.title, schedule: { at: date } }] }); }
      catch { setMessage('Reminder saved. Device notification permission may need to be enabled in Settings.'); }
    } else if ('Notification' in window) {
      try { if (Notification.permission === 'default') await Notification.requestPermission(); } catch {}
      setMessage('Reminder saved. Browser notifications depend on browser/device support and may require DayForge to be open.');
    } else setMessage('Reminder saved. Device notifications are not supported in this browser.');
    setReminderTitle(''); setReminderAt('');
  }
  async function startCheckout(plan) {
    setMessage('');
    if (!supabase) { setMessage('Supabase is not configured yet.'); return; }
    try {
      const { data, error } = await supabase.functions.invoke('create-razorpay-subscription', { body: { plan, ai_coach: addingAI, coupon: coupon.trim() } });
      if (error) throw error;
      if (!data?.subscription_id || !data?.key_id) throw new Error(data?.error || 'Checkout setup is incomplete. Configure Supabase and Razorpay server secrets.');
      setMessage(`Opening secure checkout for ${data.symbol}${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(data.amount)} ${data.currency}.`);
      if (!window.Razorpay) { setMessage('Razorpay Checkout failed to load. Check your internet connection and reload.'); return; }
      const checkout = new window.Razorpay({
        key: data.key_id, subscription_id: data.subscription_id, name: 'DayForge',
        description: `${plan === 'monthly' ? 'DayForge monthly subscription' : 'DayForge yearly subscription'} — ${data.currency}`,
        prefill: { email: session.user.email },
        theme: { color: '#8c9cff' },
        handler: () => { setMessage('Payment submitted. Your access will unlock after Razorpay confirms it securely. Refresh in a moment.'); setTimeout(loadData, 2500); },
        modal: { ondismiss: () => setMessage('Checkout closed. Your access has not changed.') }
      });
      checkout.on('payment.failed', (response) => setMessage(response.error?.description || 'Payment failed. Please try again.'));
      checkout.open();
    } catch (e) { setMessage(e.message || 'Could not start checkout.'); }
  }
  async function adminUpdatePrice(plan, amount) {
    const { error } = await supabase.from('app_settings').upsert({ key: `price_${plan}`, value: String(amount), updated_by: session.user.id });
    setMessage(error ? error.message : 'Price setting saved. Also update the corresponding Razorpay plan if its price changed.');
  }

  if (loading) return <div className="center"><div className="orb" /><p>Preparing your DayForge…</p></div>;
  if (!supabase) return <div className="auth-shell"><div className="brand"><div className="brand-icon"><Sparkles /></div><span>DAYFORGE</span></div><div className="auth-card"><h1>Your day.<br/><em>Your forge.</em></h1><p className="muted">Build discipline one day at a time.</p><div className="notice error">Backend setup required: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local environment / GitHub Actions secrets and rebuild the APK.</div><a className="primary full" href="https://supabase.com" target="_blank" rel="noreferrer">Open Supabase</a></div></div>;
  if (!session) return <div className="auth-shell"><div className="brand"><div className="brand-icon"><Sparkles /></div><span>DAYFORGE</span></div><div className="auth-card"><p className="eyebrow">DISCIPLINE, DESIGNED</p><h1>Your day.<br/><em>Your forge.</em></h1><p className="muted">Turn intentions into a life you are proud of.</p><form onSubmit={signIn} className="stack">{authMode==='signup' && <><label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="What should we call you?" required /></label><label>Country / region<select value={countryCode} onChange={e=>setCountryCode(e.target.value)}><option value="IN">India (INR ₹)</option><option value="US">United States (USD $)</option><option value="GB">United Kingdom (GBP £)</option><option value="NG">Nigeria (NGN ₦)</option><option value="CA">Canada (CAD C$)</option><option value="AU">Australia (AUD A$)</option><option value="AE">United Arab Emirates (AED د.إ)</option><option value="EU">Euro area (EUR €)</option></select><small className="tiny">You can choose your country. Final checkout currency depends on a configured payment plan.</small></label></>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" /></label><label>Password<input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="At least 8 characters" /></label><button className="primary full">{authMode==='signup'?'Create account':'Sign in'} <span>→</span></button></form><button className="text-button" onClick={()=>setAuthMode(authMode==='signup'?'signin':'signup')}>{authMode==='signup'?'Already have an account? Sign in':'New to DayForge? Create an account'}</button>{message && <p className="notice">{message}</p>}<p className="tiny">By continuing, you agree to the Terms and Privacy Policy.</p></div></div>;

  if (!hasAccess) return <div className="auth-shell"><div className="brand"><div className="brand-icon"><Sparkles /></div><span>DAYFORGE</span></div><div className="auth-card"><div className="lock-icon"><ShieldCheck /></div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>Your trial has<br/><em>ended.</em></h1><p className="muted">Choose a plan to unlock your tasks, routines, reminders, and progress again. Your account data stays yours.</p><div className="plan"><div><b>Monthly</b><p>Flexible, billed monthly</p></div><strong>{localPrice.symbol}{fmtPrice(localPrice.monthly)}<small>/{localPrice.currency_code} per month</small></strong><button onClick={()=>startCheckout('monthly')} className="primary">Choose</button></div><div className="plan"><div><b>Yearly</b><p>Save versus monthly billing</p></div><strong>{localPrice.symbol}{fmtPrice(localPrice.yearly)}<small>/{localPrice.currency_code} per year</small></strong><button onClick={()=>startCheckout('yearly')} className="primary">Choose</button></div><label className="check-row"><input type="checkbox" checked={addingAI} onChange={e=>setAddingAI(e.target.checked)}/> Add AI Coach <b>+{localPrice.symbol}{fmtPrice(localPrice.ai_monthly)}/{localPrice.currency_code}/month</b></label><label>Coupon code<input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Enter coupon (optional)" /></label><p className="tiny">Prices are converted from ₹399/month and ₹3,999/year using the latest available exchange rate, then rounded. Exchange rates and supported checkout currencies can change; Razorpay Checkout shows the final amount. AI Coach billing is not yet enabled.</p>{message && <p className="notice">{message}</p>}<button className="text-button" onClick={signOut}>Sign out</button></div></div>;

  return <div className="app-shell"><header className="topbar"><div className="brand"><div className="brand-icon"><Sparkles /></div><span>DAYFORGE</span></div><div className="top-right">{trialActive && !isAdmin && <span className="trial-pill">{daysLeft} trial day{daysLeft===1?'':'s'} left</span>}<button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={18}/></button></div></header>
  <main className="main-content"><section className="hero"><div><p className="eyebrow">{isAdmin?'ADMIN CONTROL CENTER':'YOUR DAILY RESET'}</p><h1>{isAdmin?'Command the forge.':<>Make today<br/><em>count.</em></>}</h1><p className="muted">{isAdmin?'Manage subscriptions, coupons and access.':'Small promises kept. Big change built.'}</p></div><div className="hero-orb"><div className="orb-ring"><Sparkles size={25}/></div></div></section>
  {message && <div className="notice" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
  {isAdmin ? <AdminPanel supabase={supabase} session={session} updatePrice={adminUpdatePrice} /> : <>
    <div className="stats"><div className="stat"><span><Target size={16}/></span><strong>{tasks.filter(t=>t.completed).length}/{tasks.length}</strong><small>Tasks done</small></div><div className="stat"><span><Flame size={16}/></span><strong>{tasks.filter(t=>t.completed).length*10}</strong><small>XP earned*</small></div><div className="stat"><span><Bell size={16}/></span><strong>{reminders.filter(r=>new Date(r.remind_at)>new Date()).length}</strong><small>Upcoming</small></div></div>
    <nav className="tabs">{['Today','Reminders','Progress'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    {tab==='Today' && <section className="panel"><div className="section-head"><div><p className="eyebrow">FOCUS ON WHAT MATTERS</p><h2>Today's tasks</h2></div><span className="pill">{tasks.filter(t=>t.completed).length} completed</span></div><form className="add-row" onSubmit={addTask}><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Add a task you want to finish…" required/><button aria-label="Add task" className="primary square"><Plus/></button></form><div className="task-list">{tasks.map(t=><button key={t.id} className={`task ${t.completed?'done':''}`} onClick={()=>toggleTask(t)}><span className="task-check">{t.completed&&<CheckCircle2 size={19}/>}</span><span>{t.title}<small>{t.completed?'Completed':'Tap when finished'}</small></span></button>)}{!tasks.length&&<div className="empty"><Target/><p>Your next win starts with one task.</p></div>}</div></section>}
    {tab==='Reminders' && <section className="panel"><div className="section-head"><div><p className="eyebrow">DON'T LET IT SLIP</p><h2>Reminders</h2></div><CalendarClock/></div><form className="stack" onSubmit={addReminder}><label>What should you remember?<input value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} required placeholder="e.g. Study for 30 minutes"/></label><label>Date and time<input type="datetime-local" value={reminderAt} onChange={e=>setReminderAt(e.target.value)} required/></label><button className="primary full"><Bell size={17}/> Save reminder</button></form><div className="reminder-list">{reminders.map(r=><div className="reminder" key={r.id}><Bell size={18}/><div><b>{r.title}</b><small>{new Date(r.remind_at).toLocaleString()}</small></div></div>)}{!reminders.length&&<p className="muted">No reminders yet. Add one above.</p>}</div></section>}
    {tab==='Progress' && <section className="panel"><p className="eyebrow">PROGRESS, NOT PERFECTION</p><h2>Your progress</h2><div className="progress-bar"><span style={{width:`${tasks.length?Math.round(tasks.filter(t=>t.completed).length/tasks.length*100):0}%`}}/></div><p className="muted">{tasks.length?Math.round(tasks.filter(t=>t.completed).length/tasks.length*100):0}% of your tasks completed.</p><div className="achievement"><Trophy/><div><b>First steps</b><small>Complete a task to start building your record.</small></div></div><p className="tiny">*XP shown here is a local progress estimate. Competitive global rankings need server-side scoring and anti-cheat rules before launch.</p></section>}
  </>}
  <footer><span>DAYFORGE © 2026</span><span>Build the life you mean to live.</span></footer></main></div>;
}

function AdminPanel({supabase, session, updatePrice}) {
  const [users,setUsers]=useState([]); const [subs,setSubs]=useState([]); const [coupons,setCoupons]=useState([]);
  const [code,setCode]=useState(''); const [discount,setDiscount]=useState('10'); const [kind,setKind]=useState('percent'); const [couponError,setCouponError]=useState('');
  const [monthly,setMonthly]=useState('399'); const [yearly,setYearly]=useState('3999');
  useEffect(()=>{(async()=>{const [u,s,c,pm,py]=await Promise.all([supabase.from('profiles').select('id,email,display_name,role,trial_ends_at,created_at').order('created_at',{ascending:false}).limit(100),supabase.from('subscriptions').select('*').order('created_at',{ascending:false}).limit(100),supabase.from('coupons').select('*').order('created_at',{ascending:false}).limit(100),supabase.from('app_settings').select('value').eq('key','price_monthly').maybeSingle(),supabase.from('app_settings').select('value').eq('key','price_yearly').maybeSingle()]);setUsers(u.data||[]);setSubs(s.data||[]);setCoupons(c.data||[]);if(pm.data?.value)setMonthly(pm.data.value);if(py.data?.value)setYearly(py.data.value);})();},[]);
  async function createCoupon(e){e.preventDefault();setCouponError('');const clean=code.trim().toUpperCase();if(!clean){setCouponError('Enter a coupon code.');return;}const {error}=await supabase.from('coupons').insert({code:clean,discount_type:kind,discount_value:Number(discount),created_by:session.user.id,active:true});if(error)setCouponError(error.message);else{setCoupons([{code:clean,discount_type:kind,discount_value:Number(discount),active:true},...coupons]);setCode('');}}
  const active=subs.filter(s=>s.status==='active').length;
  return <div className="admin-stack"><div className="stats"><div className="stat"><span><ShieldCheck size={16}/></span><strong>{users.length}</strong><small>Recent users</small></div><div className="stat"><span><CreditCard size={16}/></span><strong>{active}</strong><small>Active plans</small></div><div className="stat"><span><Trophy size={16}/></span><strong>{coupons.length}</strong><small>Coupons</small></div></div>
  <section className="panel"><div className="section-head"><div><p className="eyebrow">REVENUE SETTINGS</p><h2>Automatic global pricing</h2></div></div><p className="muted">Base prices are ₹399/month and ₹3,999/year. The server fetches the latest available INR exchange rates and rounds the converted amount for the user's country. Razorpay must approve and support recurring payments in the selected currency.</p><p className="tiny">Base price changes require a code/schema update and retesting. Do not promise a currency until it has been verified in your Razorpay account.</p></section>
  <section className="panel"><div className="section-head"><div><p className="eyebrow">PROMOTIONS</p><h2>Create coupon</h2></div></div><form className="stack" onSubmit={createCoupon}><label>Coupon code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" required/></label><div className="two-col"><label>Discount type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="percent">Percentage</option><option value="fixed">Fixed ₹</option></select></label><label>Discount value<input type="number" min="1" max={kind==='percent'?100:100000} value={discount} onChange={e=>setDiscount(e.target.value)} required/></label></div><button className="primary full">Create coupon</button>{couponError&&<p className="notice error">{couponError}</p>}</form><div className="simple-list">{coupons.map((c,i)=><div className="simple-item" key={c.code||i}><b>{c.code}</b><span>{c.discount_type==='percent'?`${c.discount_value}%`:`₹${c.discount_value}`} · {c.active?'Active':'Inactive'}</span></div>)}</div></section>
  <section className="panel"><div className="section-head"><div><p className="eyebrow">ACCOUNT OVERVIEW</p><h2>Users</h2></div></div><div className="simple-list">{users.map(u=><div className="simple-item" key={u.id}><div><b>{u.display_name||'DayForge user'}</b><small>{u.email}</small></div><span>{u.role||'user'}</span></div>)}</div><p className="tiny">Payments are verified from Razorpay webhooks; never manually grant paid access from this screen.</p></section>
  <section className="panel"><div className="section-head"><div><p className="eyebrow">SUBSCRIPTION HEALTH</p><h2>Recent subscriptions</h2></div></div><div className="simple-list">{subs.map(s=><div className="simple-item" key={s.id}><div><b>{s.plan||'Plan'}</b><small>{s.user_id}</small></div><span className={`status ${s.status==='active'?'good':''}`}>{s.status}</span></div>)}{!subs.length&&<p className="muted">No subscriptions recorded yet.</p>}</div></section></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
