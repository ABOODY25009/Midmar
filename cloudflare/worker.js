import { ASSETS } from "./assets.js";

const APP_VERSION = "2.4.0";
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const text = (value,status=200,headers={}) => new Response(value,{status,headers});
const now = () => Date.now();
const cookie = (request,key) => { const raw=request.headers.get("cookie")||""; const p=raw.split(/;\s*/).find(x=>x.startsWith(key+"=")); return p?p.slice(key.length+1):""; };
const token = (bytes=32) => { const b=crypto.getRandomValues(new Uint8Array(bytes)); return Array.from(b,x=>x.toString(16).padStart(2,"0")).join(""); };
const randomInt = max => { const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%max; };
const first = async (env,sql,...args) => env.DB.prepare(sql).bind(...args).first();
const all = async (env,sql,...args) => (await env.DB.prepare(sql).bind(...args).all()).results||[];
const run = async (env,sql,...args) => env.DB.prepare(sql).bind(...args).run();
const batch = async (env,statements) => statements.length?env.DB.batch(statements):[];
const stmt = (env,sql,...args) => env.DB.prepare(sql).bind(...args);
const cookieHeader = sid => "sid="+sid+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000";
const authUser = async (request,env) => {
 const sid=cookie(request,"sid");
 if(!/^[a-f0-9]{64}$/.test(sid))return null;
 return first(env,"SELECT t.id,t.username,t.email,t.provider,t.role,t.display_name,t.email_verified,t.onboarding_version FROM sessions s JOIN teachers t ON t.id=s.teacher_id WHERE s.sid=?",sid);
};
const requireUser = async (request,env) => authUser(request,env);
const requireTeacher = async (request,env) => {const u=await authUser(request,env);return u&&u.role==="teacher"?u:null;};
const requireStudent = async (request,env) => {const u=await authUser(request,env);return u&&u.role==="student"?u:null;};
const hex = bytes => Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
const unhex = value => new Uint8Array((value.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
const hashPassword = async password => {
 const salt=crypto.getRandomValues(new Uint8Array(16)),iterations=210000;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
 return "pbkdf2$"+iterations+"$"+hex(salt)+"$"+hex(bits);
};
const verifyPassword = async (password,stored) => {
 try{
  const [scheme,count,salt,expected]=String(stored||"").split("$");
  if(scheme!=="pbkdf2"||Number(count)<100000||!salt||!expected)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unhex(salt),iterations:Number(count),hash:"SHA-256"},key,256));
  const actual=unhex(expected);if(actual.length!==bits.length)return false;
  let diff=0;for(let i=0;i<bits.length;i++)diff|=bits[i]^actual[i];return diff===0;
 }catch{return false;}
};
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const accessIdsForTeacher = async (env,teacherId,ids) => {
 const idsIn=[...new Set((Array.isArray(ids)?ids:[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))];
 if(!idsIn.length)return [];
 const found=await all(env,"SELECT id FROM student_groups WHERE teacher_id=? AND id IN ("+idsIn.map(()=>"?").join(",")+")",teacherId,...idsIn);
 if(found.length!==idsIn.length)throw Error("إحدى مجموعات الطلاب غير موجودة ضمن حسابك");
 return idsIn;
};
const saveQuizStudentGroups = async (env,quizId,teacherId,ids) => {
 const valid=await accessIdsForTeacher(env,teacherId,ids);
 await batch(env,[stmt(env,"DELETE FROM quiz_student_groups WHERE quiz_id=?",quizId),...valid.map(id=>stmt(env,"INSERT INTO quiz_student_groups(quiz_id,student_group_id) VALUES(?,?)",quizId,id))]);
};
const checkedStudentIds = async (env,emails) => {
 const list=[...new Set((Array.isArray(emails)?emails:[]).map(x=>String(x||"").trim().toLowerCase()).filter(Boolean))];
 if(!list.length)throw Error("أدخل بريدًا إلكترونيًا واحدًا على الأقل");
 const found=[];
 for(const email of list){
  const user=await first(env,"SELECT id,email,display_name,role,email_verified FROM teachers WHERE email=?",email);
  if(!user)throw Error("هذا البريد غير مسجل في مِضمار: "+email);
  if(user.role!=="student")throw Error("هذا الحساب ليس حساب طالب: "+email);
  if(!user.email_verified)throw Error("لم يتم توثيق بريد الطالب بعد: "+email+" — على الطالب ربط حسابه بـGoogle من الإعدادات أولًا");
  found.push(user);
 }
 return found;
};
const fail = (message,status=400) => json({error:message},status);
const bodyOf = async request => {try{return await request.json()}catch{return {}}};
const questionsFor = async (env,id) => (await all(env,"SELECT * FROM questions WHERE quiz_id=? ORDER BY pos",id)).map(x=>({...x,options:JSON.parse(x.options||"[]")}));
const ownedQuiz = async (env,id,tid) => first(env,"SELECT * FROM quizzes WHERE id=? AND teacher_id=?",id,tid);
const newCode = async env => {for(let i=0;i<30;i++){const c=String(100000+randomInt(900000));if(!await first(env,"SELECT id FROM quizzes WHERE code=?",c))return c;}throw Error("تعذر إنشاء رمز جديد");};
const quizFields = b => {
 const title=String(b.title||"").trim();if(!title)throw Error("اسم المسابقة مطلوب");
 return [title,String(b.description||""),String(b.image||""),Math.max(0,Number(b.time_limit)||0),b.shuffle_q?1:0,b.shuffle_a?1:0,b.show_correct?1:0,b.allow_retry?1:0,b.start_at||null,b.end_at||null,["groups","students"].includes(b.participation_mode)?b.participation_mode:"groups",["qr","roster","both"].includes(b.entry_mode)?b.entry_mode:"both",["free","sequential","teacher"].includes(b.progression_mode)?b.progression_mode:"sequential"];
};
const saveQuestions = async (env,id,list) => {
 const stmts=[stmt(env,"DELETE FROM questions WHERE quiz_id=?",id)];
 for(let i=0;i<list.length;i++){
  const x=list[i]||{},type=["tf","order"].includes(x.type)?x.type:"mc",opts=type==="tf"?["صح","خطأ"]:(Array.isArray(x.options)?x.options.map(String).filter(v=>v.trim()):[]);
  if(!String(x.text||"").trim())throw Error("نص السؤال مطلوب");
  if(opts.length<2||opts.length>6)throw Error("الخيارات من 2 إلى 6");
  if(type==="order"&&opts.some(v=>!v.trim()))throw Error("أكمل عناصر سؤال الترتيب");
  if(type!=="order"&&(x.correct===null||x.correct===undefined||!Number.isInteger(Number(x.correct))||Number(x.correct)<0||Number(x.correct)>=opts.length))throw Error("حدد الإجابة الصحيحة");
  stmts.push(stmt(env,"INSERT INTO questions(quiz_id,pos,type,text,image,points,options,correct) VALUES(?,?,?,?,?,?,?,?)",id,i,type,String(x.text).trim(),String(x.image||""),Math.max(1,Number(x.points)||1),JSON.stringify(opts),type==="order"?-1:Number(x.correct)));
 }
 await batch(env,stmts);
};
const saveRoster = async (env,id,names) => {
 const list=String(names||"").split(/[\n,،]+/).map(x=>x.trim().slice(0,40)).filter(Boolean),seen=new Set(),stmts=[stmt(env,"DELETE FROM quiz_roster WHERE quiz_id=? AND claimed=0",id)];
 for(const name of list){const key=name.toLocaleLowerCase("ar");if(!seen.has(key)){seen.add(key);stmts.push(stmt(env,"INSERT OR IGNORE INTO quiz_roster(quiz_id,name) VALUES(?,?)",id,name));}}
 await batch(env,stmts);
};
const ranking = async (env,z) => {
 const total=await first(env,"SELECT COALESCE(SUM(points),0) t,COUNT(*) n FROM questions WHERE quiz_id=?",z.id);
 const rows=await all(env,`SELECT g.id,g.name,g.started,g.finished,COUNT(a.id) answered,COALESCE(SUM(a.correct),0) correct,COALESCE(SUM(a.points),0) score,MAX(a.at) last FROM groups g LEFT JOIN answers a ON a.group_id=g.id WHERE g.quiz_id=? GROUP BY g.id`,z.id);
 const mapped=rows.map(r=>({...r,done:r.finished?1:0,duration:Math.round(((r.finished||r.last||r.started)-r.started)/1000)}));
 mapped.sort((a,b)=>b.score-a.score||a.duration-b.duration||a.id-b.id);
 mapped.forEach((r,i)=>{const p=mapped[i-1];r.rank=p&&p.score===r.score&&p.duration===r.duration?p.rank:i+1;r.tie=mapped.some(o=>o!==r&&o.score===r.score&&o.duration===r.duration)});
 return {rows:mapped,totalPoints:total.t,nq:total.n};
};
const boardData = async (env,z) => {
 const r=await ranking(env,z),hidden=z.board==="hidden";
 const qs=await all(env,"SELECT id,text,pos FROM questions WHERE quiz_id=? ORDER BY pos",z.id);
 const rows=[];
 for(const x of r.rows){
  const done=await all(env,"SELECT question_id FROM answers WHERE group_id=?",x.id),ids=new Set(done.map(a=>a.question_id));
  const activeIndex=z.progression_mode==="teacher"?(z.unlocked_question||0):x.answered;
  rows.push({...x,progress:qs.map((q,i)=>({id:q.id,label:i+1,status:ids.has(q.id)?"done":i===activeIndex?"active":"not-started"}))});
 }
 return {title:z.title,code:z.code,hidden,totalPoints:r.totalPoints,nq:r.nq,participationMode:z.participation_mode||"groups",questions:qs,finished:r.rows.filter(x=>x.done).length,playing:r.rows.filter(x=>!x.done).length,rows:hidden?[]:rows.map(({id,name,rank,tie,score,correct,duration,done,answered,finished,progress})=>({id,name,rank,tie,score,correct,duration,done,answered,finishedAt:finished,progress}))};
};
const quizStatus = z => z.archived?"مؤرشفة":z.start_at&&now()<z.start_at?"لم تبدأ بعد":z.end_at&&now()>z.end_at?"أُغلقت":"open";
const rng = seed => {let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}};
const shuffle = (arr,r) => {const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const getContext = async (env,t) => {
 const g=await first(env,"SELECT * FROM groups WHERE token=?",t);if(!g)return null;
 const z=await first(env,"SELECT * FROM quizzes WHERE id=?",g.quiz_id);if(!z)return null;
 let list=await questionsFor(env,z.id);if(z.shuffle_q&&z.progression_mode!=="teacher")list=shuffle(list,rng(g.seed));
 const answered=await all(env,"SELECT * FROM answers WHERE group_id=?",g.id);
 return {g,z,list,answered};
};
const makeState = async (env,c,requestedId) => {
 const {g,z,list,answered}=c,dl=z.time_limit?g.started+z.time_limit*60000:null,n=list.length;
 const done=answered.length>=n||!!g.finished||!!(dl&&now()>dl);
 if(done&&!g.finished){const finished=Math.min(now(),dl||now());await run(env,"UPDATE groups SET finished=? WHERE id=?",finished,g.id);g.finished=finished;}
 const score=answered.reduce((a,b)=>a+b.points,0),totalPoints=list.reduce((a,b)=>a+b.points,0);
 const base={title:z.title,group:g.name,total:n,answered:answered.length,deadline:dl,now:now(),score,totalPoints,correct:answered.filter(a=>a.correct).length,retry:!!z.allow_retry,progression_mode:z.progression_mode||"sequential"};
 if(done){const rk=(await ranking(env,z)).rows.find(r=>r.id===g.id);return {...base,done:true,duration:Math.round(((g.finished||now())-g.started)/1000),rank:z.board==="hidden"?null:rk?.rank};}
 const available=list.filter(x=>!answered.some(a=>a.question_id===x.id));let cur;
 if(z.progression_mode==="teacher"){const ix=Math.max(0,Math.min(list.length-1,z.unlocked_question||0));cur=list[ix]&&!answered.some(a=>a.question_id===list[ix].id)?list[ix]:available.find(x=>list.indexOf(x)<=ix);}
 else cur=(z.progression_mode==="free"&&requestedId)?available.find(x=>x.id===Number(requestedId))||available[0]:available[0];
 if(!cur)return {...base,done:false,waiting:z.progression_mode==="teacher"};
 let opts=cur.options.map((t,i)=>({i,t}));if(z.shuffle_a&&cur.type==="mc")opts=shuffle(opts,rng(g.seed+cur.id));
 return {...base,done:false,question:{id:cur.id,type:cur.type,text:cur.text,image:cur.image,points:cur.points,options:opts}};
};

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),p=url.pathname,method=request.method;
  try{
   if(p==="/health")return json({ok:true,app:"midmar-v2",version:APP_VERSION,database:"connected",time:new Date().toISOString()});
   if(p==="/api/version")return json({version:APP_VERSION});
   if(p==="/api/me"){
    const u=await authUser(request,env);return json(u?{authenticated:true,id:u.id,student_id:u.role==="student"?"STD-"+String(u.id).padStart(6,"0"):null,user:u.username,name:u.display_name||u.email,email:u.email,provider:u.provider,role:u.role||"teacher",email_verified:!!u.email_verified}:{authenticated:false});
   }
   if(p==="/api/auth/register"&&method==="POST"){
    const b=await bodyOf(request),name=String(b.name||"").trim().slice(0,80),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||""),role=String(b.role||"");
    if(!name)return fail("الاسم مطلوب");
    if(!validEmail(email))return fail("أدخل بريدًا إلكترونيًا صحيحًا");
    if(password.length<8||password.length>128)return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    if(!["teacher","student"].includes(role))return fail("اختر نوع الحساب: طالب أو معلم");
    if(await first(env,"SELECT id FROM teachers WHERE email=?",email))return fail("يوجد حساب بهذا البريد. اختر تسجيل الدخول بدل إنشاء حساب جديد.",409);
    try{
     const hash=await hashPassword(password);
     const ins=await run(env,"INSERT INTO teachers(username,hash,email,provider,role,display_name,email_verified) VALUES(?,?,?,'password',?,?,0)","account:"+email,hash,email,role,name);
     const sid=token(32);await run(env,"INSERT INTO sessions(sid,teacher_id,created) VALUES(?,?,?)",sid,ins.meta.last_row_id,now());
     return json({ok:true,authenticated:true,role,email_verified:false},200,{"set-cookie":cookieHeader(sid)});
    }catch(e){console.error("Registration error",e?.message||e);return fail("تعذر إنشاء الحساب. تحقق من البريد وحاول مجددًا.",409)}
   }
   if(p==="/api/auth/login"&&method==="POST"){
    const b=await bodyOf(request),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
    if(!validEmail(email)||!password)return fail("أدخل البريد الإلكتروني وكلمة المرور");
    const user=await first(env,"SELECT id,hash,role,email_verified FROM teachers WHERE email=?",email);
    if(!user||!user.hash||!await verifyPassword(password,user.hash))return fail("البريد الإلكتروني أو كلمة المرور غير صحيحة",401);
    const sid=token(32);await run(env,"INSERT INTO sessions(sid,teacher_id,created) VALUES(?,?,?)",sid,user.id,now());
    return json({ok:true,authenticated:true,role:user.role,email_verified:!!user.email_verified},200,{"set-cookie":cookieHeader(sid)});
   }
   if(p==="/auth/google"&&method==="GET"){
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return Response.redirect(new URL("/?auth_error=not_configured",url),302);
    const state=token(32),current=await authUser(request,env),link=url.searchParams.get("link")==="1"&&current?"google-link:"+current.id:null,requestedRole=url.searchParams.get("role")==="student"?"student":"teacher",oauthMode=link||"google:"+requestedRole;
    await run(env,"INSERT INTO oauth_states(state,provider,created) VALUES(?,?,?)",state,oauthMode,now());
    const callback=env.GOOGLE_REDIRECT_URI||url.origin+"/auth/google/callback";
    const go=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:"code",scope:"openid email profile",state,nonce:state,prompt:"select_account"}))go.searchParams.set(k,v);
    return Response.redirect(go.toString(),302);
   }
   if(p==="/auth/google/callback"&&method==="GET"){
    const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";
    const saved=await first(env,"SELECT state,provider FROM oauth_states WHERE state=? AND created>?",state,now()-600000);
    await run(env,"DELETE FROM oauth_states WHERE state=?",state);
    if(!saved||!code)return Response.redirect(url.origin+"/?auth_error=invalid_state",302);
    try{
     const callback=env.GOOGLE_REDIRECT_URI||url.origin+"/auth/google/callback";
     const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callback,grant_type:"authorization_code"})});
     const tokens=await tokenRes.json();
     if(!tokenRes.ok||!tokens.id_token)throw Error("google_token_exchange_failed");
     const infoRes=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(tokens.id_token));
     const info=await infoRes.json(),parts=tokens.id_token.split("."),payload=JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/")));
     const email=String(info.email||"").toLowerCase(),exp=Number(info.exp||0);
     if(!infoRes.ok||info.aud!==env.GOOGLE_CLIENT_ID||!["accounts.google.com","https://accounts.google.com"].includes(info.iss)||exp*1000<=now()||payload.nonce!==state||!(info.email_verified===true||info.email_verified==="true")||!info.sub||info.sub!==payload.sub||!email)throw Error("google_identity_invalid");
     const stateMode=String(saved.provider||"google:teacher");
     let teacher=await first(env,"SELECT id,role,email FROM teachers WHERE provider='google' AND provider_sub=?",info.sub);
     if(stateMode.startsWith("google-link:")){
      const linkId=Number(stateMode.slice("google-link:".length)),local=await first(env,"SELECT id,email,provider FROM teachers WHERE id=?",linkId);
      if(!local||local.email!==email)throw Error("google_link_email_mismatch");
      const another=await first(env,"SELECT id FROM teachers WHERE provider='google' AND provider_sub=? AND id<>?",info.sub,linkId);
      if(another)throw Error("google_identity_already_linked");
      await run(env,"UPDATE teachers SET provider='google',provider_sub=?,email_verified=1 WHERE id=?",info.sub,linkId);
      teacher={id:linkId,role:local.role,email};
     }else if(!teacher){
      const byEmail=await first(env,"SELECT id,role,email FROM teachers WHERE email=?",email);
      if(byEmail){
       const another=await first(env,"SELECT id FROM teachers WHERE provider='google' AND provider_sub=? AND id<>?",info.sub,byEmail.id);
       if(another)throw Error("google_identity_already_linked");
       await run(env,"UPDATE teachers SET provider='google',provider_sub=?,email_verified=1,display_name=CASE WHEN display_name='' THEN ? ELSE display_name END WHERE id=?",info.sub,String(info.name||""),byEmail.id);
       teacher=byEmail;
      }else{
       const wantedRole=stateMode==="google:student"?"student":"teacher",name=String(info.name||email.split("@")[0]).slice(0,80);
       const ins=await run(env,"INSERT INTO teachers(username,hash,email,provider,provider_sub,role,display_name,email_verified) VALUES(?,NULL,?,'google',?,?,?,1)","google:"+info.sub,email,info.sub,wantedRole,name);
       teacher={id:ins.meta.last_row_id,role:wantedRole,email};
      }
     }else await run(env,"UPDATE teachers SET email=?,email_verified=1,display_name=CASE WHEN display_name='' THEN ? ELSE display_name END WHERE id=?",email,String(info.name||""),teacher.id);
     const sid=token(32);await run(env,"INSERT INTO sessions(sid,teacher_id,created) VALUES(?,?,?)",sid,teacher.id,now());
     return new Response(null,{status:302,headers:{location:url.origin+"/", "set-cookie":cookieHeader(sid)}});
    }catch(e){console.error("Google OAuth error",e.message);return Response.redirect(url.origin+"/?auth_error=google_failed",302);}
   }
   if(p==="/api/logout"&&method==="POST"){
    const sid=cookie(request,"sid");if(sid)await run(env,"DELETE FROM sessions WHERE sid=?",sid);
    return json({ok:1},200,{"set-cookie":"sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});
   }
   if(p==="/api/onboarding"&&method==="GET"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const v=Number(u.onboarding_version||0);return json({version:v,showTutorial:v===0,showUpdateNotice:v===1});
   }
   if(p==="/api/onboarding/complete"&&method==="POST"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    await run(env,"UPDATE teachers SET onboarding_version=2 WHERE id=?",u.id);return json({ok:true,version:2});
   }
   if(p==="/api/ai/status"&&method==="GET"){
    const u=await requireTeacher(request,env);if(!u)return fail("هذه الصفحة مخصصة للمعلم",403);
    return json({configured:!!env.OPENAI_API_KEY,provider:"OpenAI",model:"gpt-4o-mini"});
   }
   if(p==="/api/ai/parse-sheet"&&method==="POST"){
    const u=await requireTeacher(request,env);if(!u)return fail("هذه العملية مخصصة للمعلم",403);
    if(!env.OPENAI_API_KEY)return fail("مفتاح OpenAI غير مضاف. أضف Secret باسم OPENAI_API_KEY في إعدادات Worker.",503);
    const b=await bodyOf(request),image=String(b.image||"");
    if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>3000000)return fail("الصورة غير صالحة أو حجمها كبير. استخدم PNG أو JPG أو WEBP بحجم مناسب.",400);
    try{
     const prompt='استخرج كل أسئلة الاختبار الظاهرة في الصورة فقط. أعد JSON صالحًا دون Markdown بهذا الشكل: {"questions":[{"type":"mc","text":"نص السؤال","options":["الخيار 1","الخيار 2"],"correct":0,"points":1}]}. الأنواع: mc للاختيار المتعدد، tf للصواب والخطأ (options ["صح","خطأ"])، order للترتيب. لا تخترع أي محتوى. إذا لم تكن الإجابة الصحيحة ظاهرة فاجعل correct:null. حافظ على لغة الورقة ونصها.';
     const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{authorization:"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0.1,response_format:{type:"json_object"},messages:[{role:"system",content:"أنت مساعد متخصص في قراءة أوراق الاختبارات. أعد JSON فقط."},{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:image,detail:"high"}}]}]})});
     const data=await response.json();if(!response.ok){console.error("OpenAI parse failed",response.status,data?.error?.type);return fail(data?.error?.message||"تعذر تحليل الورقة عبر OpenAI",502)}
     const parsed=JSON.parse(data.choices?.[0]?.message?.content||"{}"),raw=Array.isArray(parsed.questions)?parsed.questions:[];
     const questions=raw.map(q=>{
      const t=String(q.type||"mc").toLowerCase(),type=["tf","true_false","truefalse"].includes(t)?"tf":["order","ordering","sequence"].includes(t)?"order":"mc";
      const options=type==="tf"?["صح","خطأ"]:Array.isArray(q.options)?q.options.map(v=>String(v||"").trim()).filter(Boolean).slice(0,6):[];
      let correct=Number.isInteger(q.correct)?q.correct:null;
      if(type!=="order"&&(correct===null||correct<0||correct>=options.length))correct=null;
      return {type,text:String(q.text||"").trim(),options,correct,points:Math.max(1,Math.min(100,Number(q.points)||1))};
     }).filter(q=>q.text&&q.options.length>=2);
     if(!questions.length)return fail("لم يتم العثور على أسئلة واضحة. جرّب صورة أكثر وضوحًا.",422);
     return json({questions,model:"gpt-4o-mini",reviewRequired:true});
    }catch(e){console.error("OpenAI question extraction error",e?.message||e);return fail("تعذر تحليل الصورة. تحقق من المفتاح أو جرّب صورة أوضح.",502)}
   }

   if(p==="/api/student/quizzes"&&method==="GET"){
    const u=await requireStudent(request,env);if(!u)return fail("سجّل الدخول بحساب طالب أولًا",401);
    if(!u.email_verified)return fail("وثّق بريدك الإلكتروني من الإعدادات باستخدام Google قبل المشاركة.",403);
    const rows=await all(env,"SELECT DISTINCT z.*,(SELECT COUNT(*) FROM questions WHERE quiz_id=z.id) nq FROM quizzes z JOIN quiz_student_groups qsg ON qsg.quiz_id=z.id JOIN student_group_members sgm ON sgm.student_group_id=qsg.student_group_id WHERE sgm.student_id=? AND z.archived=0 ORDER BY z.id DESC",u.id);
    const output=[];for(const z of rows){const g=await first(env,"SELECT id,token,started,finished FROM groups WHERE quiz_id=? AND student_id=?",z.id,u.id);output.push({id:z.id,title:z.title,description:z.description,code:z.code,nq:z.nq,status:quizStatus(z),group_id:g?.id||null,finished:!!g?.finished,can_open:quizStatus(z)==="open"});}
    return json({student:{id:u.id,student_id:"STD-"+String(u.id).padStart(6,"0"),name:u.display_name,email:u.email},quizzes:output});
   }
   if(p==="/api/access-groups"&&method==="GET"){
    const u=await requireTeacher(request,env);if(!u)return fail("هذه الصفحة مخصصة للمعلم",403);
    const groups=await all(env,"SELECT g.id,g.name,g.created,COUNT(m.student_id) member_count FROM student_groups g LEFT JOIN student_group_members m ON m.student_group_id=g.id WHERE g.teacher_id=? GROUP BY g.id ORDER BY g.name",u.id);
    for(const g of groups)g.members=await all(env,"SELECT t.id,t.display_name,t.email FROM student_group_members m JOIN teachers t ON t.id=m.student_id WHERE m.student_group_id=? ORDER BY t.display_name,t.email",g.id);
    return json(groups);
   }
   if(p==="/api/access-groups"&&method==="POST"){
    const u=await requireTeacher(request,env);if(!u)return fail("هذه الصفحة مخصصة للمعلم",403);
    const b=await bodyOf(request),name=String(b.name||"").trim().slice(0,80);if(!name)return fail("اكتب اسم المجموعة");
    try{
     const members=await checkedStudentIds(env,b.emails||[]);
     const ins=await run(env,"INSERT INTO student_groups(teacher_id,name,created) VALUES(?,?,?)",u.id,name,now());
     const id=ins.meta.last_row_id;await batch(env,members.map(s=>stmt(env,"INSERT INTO student_group_members(student_group_id,student_id) VALUES(?,?)",id,s.id)));
     return json({id,member_count:members.length});
    }catch(e){return fail(e.message,400)}
   }
   const accessGroupPath=p.match(/^\/api\/access-groups\/(\d+)$/);
   if(accessGroupPath){
    const id=Number(accessGroupPath[1]),u=await requireTeacher(request,env);if(!u)return fail("هذه الصفحة مخصصة للمعلم",403);
    const g=await first(env,"SELECT * FROM student_groups WHERE id=? AND teacher_id=?",id,u.id);if(!g)return fail("المجموعة غير موجودة",404);
    if(method==="DELETE"){await run(env,"DELETE FROM student_groups WHERE id=?",id);return json({ok:true})}
    if(method==="PUT"){
     const b=await bodyOf(request),name=String(b.name||"").trim().slice(0,80);if(!name)return fail("اكتب اسم المجموعة");
     try{const members=await checkedStudentIds(env,b.emails||[]);
      await run(env,"UPDATE student_groups SET name=? WHERE id=?",name,id);
      await run(env,"DELETE FROM student_group_members WHERE student_group_id=?",id);
      await batch(env,members.map(s=>stmt(env,"INSERT INTO student_group_members(student_group_id,student_id) VALUES(?,?)",id,s.id)));
      return json({ok:true,member_count:members.length});
     }catch(e){return fail(e.message,400)}
    }
   }
   const quizPath=p.match(/^\/api\/quizzes\/(\d+)(?:\/(copy|archive|board|results|export\.csv|unlock))?$/);
   if(p==="/api/quizzes"&&method==="GET"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const rows=await all(env,"SELECT z.*,(SELECT COUNT(*) FROM questions WHERE quiz_id=z.id) nq,(SELECT COUNT(*) FROM groups WHERE quiz_id=z.id) ng FROM quizzes z WHERE teacher_id=? ORDER BY id DESC",u.id);return json(rows);
   }
   if(p==="/api/quizzes"&&method==="POST"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const b=await bodyOf(request);try{
     const f=quizFields(b),ids=await accessIdsForTeacher(env,u.id,b.access_group_ids||[]);
     if(f[10]==="students"&&!ids.length)throw Error("اختر مجموعة طلاب واحدة على الأقل للمسابقة");
     const code=await newCode(env),ins=await run(env,"INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,start_at,end_at,participation_mode,entry_mode,progression_mode,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",...f,u.id,code,now());
     const id=ins.meta.last_row_id;await saveQuestions(env,id,b.questions||[]);await saveRoster(env,id,b.roster||"");await saveQuizStudentGroups(env,id,u.id,ids);return json({id});
    }catch(e){return fail(e.message);}
   }
   if(quizPath){
    const id=Number(quizPath[1]),action=quizPath[2],u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const z=await ownedQuiz(env,id,u.id);if(!z)return fail("غير موجود",404);
    if(!action&&method==="DELETE"){await run(env,"DELETE FROM quizzes WHERE id=?",id);return json({ok:1});}
    if(!action&&method==="GET")return json({...z,questions:await questionsFor(env,id),access_group_ids:(await all(env,"SELECT student_group_id FROM quiz_student_groups WHERE quiz_id=?",id)).map(x=>x.student_group_id),roster:(await all(env,"SELECT name FROM quiz_roster WHERE quiz_id=? ORDER BY name",id)).map(x=>x.name).join("\n")});
    if(!action&&method==="PUT"){
     const b=await bodyOf(request);try{
      const f=quizFields(b),ids=await accessIdsForTeacher(env,u.id,b.access_group_ids||[]);
      if(f[10]==="students"&&!ids.length)throw Error("اختر مجموعة طلاب واحدة على الأقل للمسابقة");
      await run(env,"UPDATE quizzes SET title=?,description=?,image=?,time_limit=?,shuffle_q=?,shuffle_a=?,show_correct=?,allow_retry=?,start_at=?,end_at=?,participation_mode=?,entry_mode=?,progression_mode=? WHERE id=?",...f,id);
      if(!await first(env,"SELECT 1 ok FROM groups WHERE quiz_id=? LIMIT 1",id))await saveQuestions(env,id,b.questions||[]);
      await saveRoster(env,id,b.roster||"");
      await saveQuizStudentGroups(env,id,u.id,ids);return json({ok:1});
     }catch(e){return fail(e.message);}
    }
    if(action==="copy"&&method==="POST"){
     const code=await newCode(env),ins=await run(env,"INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,participation_mode,entry_mode,progression_mode,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",z.title+" (نسخة)",z.description,z.image,z.time_limit,z.shuffle_q,z.shuffle_a,z.show_correct,z.allow_retry,z.participation_mode||"groups",z.entry_mode||"both",z.progression_mode||"sequential",u.id,code,now());
     const nid=ins.meta.last_row_id;await saveQuestions(env,nid,await questionsFor(env,id));await saveRoster(env,nid,(await all(env,"SELECT name FROM quiz_roster WHERE quiz_id=?",id)).map(x=>x.name).join("\n"));
     const accessIds=(await all(env,"SELECT student_group_id FROM quiz_student_groups WHERE quiz_id=?",id)).map(x=>x.student_group_id);await saveQuizStudentGroups(env,nid,u.id,accessIds);return json({id:nid});
    }
    if(action==="archive"&&method==="POST"){await run(env,"UPDATE quizzes SET archived=? WHERE id=?",z.archived?0:1,id);return json({ok:1});}
    if(action==="board"&&method==="POST"){const b=await bodyOf(request);await run(env,"UPDATE quizzes SET board=? WHERE id=?",b.state==="hidden"?"hidden":"shown",id);return json({ok:1});}
    if(action==="unlock"&&method==="POST"){
     if(z.progression_mode!=="teacher")return fail("وضع التحكم بالمعلم غير مفعّل");
     const total=await first(env,"SELECT COUNT(*) n FROM questions WHERE quiz_id=?",id),n=Math.max(0,Math.min(total.n-1,(z.unlocked_question||0)+1));
     await run(env,"UPDATE quizzes SET unlocked_question=? WHERE id=?",n,id);return json({unlocked_question:n});
    }
    if(action==="results"&&method==="GET"){
     const r=await ranking(env,z),per=await all(env,"SELECT q.id,q.text,q.pos,COUNT(a.id) answered,COALESCE(SUM(a.correct),0) correct FROM questions q LEFT JOIN answers a ON a.question_id=q.id WHERE q.quiz_id=? GROUP BY q.id ORDER BY q.pos",id);
     const stats=per.map(x=>({...x,wrong:x.answered-x.correct,pct:x.answered?Math.round(100*x.correct/x.answered):null}));
     const ans=stats.filter(x=>x.answered),avg=r.rows.length?Math.round(10*r.rows.reduce((a,b)=>a+b.score,0)/r.rows.length)/10:0,sorted=[...ans].sort((a,b)=>a.pct-b.pct);
     return json({quiz:{id:z.id,title:z.title,code:z.code},progression_mode:z.progression_mode||"sequential",unlocked_question:z.unlocked_question||0,...r,avg,questions:stats,hardest:sorted[0]||null,easiest:sorted[sorted.length-1]||null,mostMissed:ans.filter(x=>x.wrong>x.correct)});
    }
    if(action==="export.csv"&&method==="GET"){
     const r=await ranking(env,z),esc=v=>{v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
     const lines=[["المركز","المجموعة","الدرجة","الإجابات الصحيحة","عدد الأسئلة المجاب عنها","مدة الإنجاز (ثانية)","الحالة"].map(esc).join(",")];
     r.rows.forEach(x=>lines.push([x.rank,x.name,x.score,x.correct,x.answered,x.duration,x.done?"أنهت":"لم تنه"].map(esc).join(",")));
     return text("\ufeff"+lines.join("\r\n"),200,{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="results-'+id+'.csv"'});
    }
   }
   if(p==="/api/dashboard"&&method==="GET"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const zs=await all(env,"SELECT * FROM quizzes WHERE teacher_id=? ORDER BY id DESC",u.id);let ng=0,sum=0,best=null;const chart=[];
    for(const z of zs){const r=await ranking(env,z);ng+=r.rows.length;
     if(chart.length<8)chart.unshift({title:z.title,groups:r.rows.length,avg:r.rows.length?Math.round(10*r.rows.reduce((a,b)=>a+b.score,0)/r.rows.length)/10:0,max:r.totalPoints});
     for(const x of r.rows){sum+=x.score;if(!best||x.score/(r.totalPoints||1)>best.ratio)best={name:x.name,quiz:z.title,score:x.score,total:r.totalPoints,ratio:x.score/(r.totalPoints||1)};}
    }
    return json({quizzes:zs.length,active:zs.filter(z=>!z.archived).length,groups:ng,avg:ng?Math.round(10*sum/ng)/10:0,best,recent:zs.slice(0,5).map(z=>({id:z.id,title:z.title,archived:z.archived})),chart});
   }
   if(p==="/api/qr"&&method==="GET"){
    const target=String(url.searchParams.get("text")||"").slice(0,300);
    const qr=await fetch("https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data="+encodeURIComponent(target));
    if(!qr.ok)return fail("تعذر إنشاء رمز QR",502);
    return new Response(qr.body,{headers:{"content-type":"image/png","cache-control":"public, max-age=3600"}});
   }
   if(p==="/api/board"||p.startsWith("/api/board/")){
    const code=p.split("/").pop(),z=await first(env,"SELECT * FROM quizzes WHERE code=?",code);return z?json(await boardData(env,z)):fail("غير موجود",404);
   }
   const joinPath=p.match(/^\/api\/join\/(\d{6})$/);
   if(joinPath&&method==="GET"){
    const z=await first(env,"SELECT * FROM quizzes WHERE code=?",joinPath[1]);if(!z)return fail("رمز غير صحيح",404);
    const count=await first(env,"SELECT COUNT(*) n FROM questions WHERE quiz_id=?",z.id);
    let student=null;
    if(z.participation_mode==="students"){
     student=await requireStudent(request,env);if(!student)return fail("سجّل الدخول بحساب طالب للمشاركة",401);
     if(!student.email_verified)return fail("وثّق بريدك الإلكتروني من الإعدادات باستخدام Google قبل المشاركة",403);
     const allowed=await first(env,"SELECT 1 ok FROM quiz_student_groups q JOIN student_group_members m ON m.student_group_id=q.student_group_id WHERE q.quiz_id=? AND m.student_id=? LIMIT 1",z.id,student.id);
     if(!allowed)return fail("بريدك الإلكتروني غير موجود ضمن مجموعات الوصول لهذه المسابقة",403);
    }
    return json({title:z.title,description:z.description,image:z.image,time_limit:z.time_limit,nq:count.n,status:quizStatus(z),participation_mode:z.participation_mode||"groups",entry_mode:z.entry_mode||"both",student_name:student?.display_name||null,student_id:student?"STD-"+String(student.id).padStart(6,"0"):null,roster:(z.participation_mode==="students"&&z.entry_mode!=="qr")?await all(env,"SELECT id,name FROM quiz_roster WHERE quiz_id=? AND claimed=0 ORDER BY name",z.id):[]});
   }
   if(joinPath&&method==="POST"){
    const z=await first(env,"SELECT * FROM quizzes WHERE code=?",joinPath[1]);if(!z)return fail("رمز غير صحيح",404);
    const st=quizStatus(z);if(st!=="open")return fail("المسابقة "+st,403);
    const b=await bodyOf(request),student=z.participation_mode==="students";let name=String(b.name||"").trim().slice(0,40),studentId=null;
    if(student){
     const u=await requireStudent(request,env);if(!u)return fail("سجّل الدخول بحساب طالب للمشاركة",401);
     if(!u.email_verified)return fail("وثّق بريدك الإلكتروني من الإعدادات باستخدام Google قبل المشاركة",403);
     const allowed=await first(env,"SELECT 1 ok FROM quiz_student_groups q JOIN student_group_members m ON m.student_group_id=q.student_group_id WHERE q.quiz_id=? AND m.student_id=? LIMIT 1",z.id,u.id);
     if(!allowed)return fail("بريدك الإلكتروني غير موجود ضمن مجموعات الوصول لهذه المسابقة",403);
     const existing=await first(env,"SELECT token FROM groups WHERE quiz_id=? AND student_id=?",z.id,u.id);
     if(existing)return json({token:existing.token,existing:true});
     studentId=u.id;name=String(u.display_name||u.email||("طالب "+u.id)).slice(0,40);
     const duplicate=await first(env,"SELECT id FROM groups WHERE quiz_id=? AND name=?",z.id,name);if(duplicate)name=(name.slice(0,30)+" · "+u.id).slice(0,40);
    }else if(!name)return fail("اكتب اسم المجموعة");
    if(!await first(env,"SELECT 1 ok FROM questions WHERE quiz_id=? LIMIT 1",z.id))return fail("لا توجد أسئلة");
    const tok=token(16),seed=randomInt(2147483646)+1;
    try{
     if(student)await run(env,"INSERT INTO groups(quiz_id,name,token,seed,started,student_id) VALUES(?,?,?,?,?,?)",z.id,name,tok,seed,now(),studentId);
     else await run(env,"INSERT INTO groups(quiz_id,name,token,seed,started) VALUES(?,?,?,?,?)",z.id,name,tok,seed,now());
     return json({token:tok});
    }catch(e){return fail("تعذر تسجيل المشاركة. ربما سبق تسجيل هذا الطالب.",409)}
   }
   const play=p.match(/^\/api\/play\/([a-f0-9]{32})(?:\/(questions|answer|retry))?$/);
   if(play){
    const tok=play[1],action=play[2]||"",c=await getContext(env,tok);if(!c)return fail("جلسة غير صالحة",404);
    if(c.g.student_id){
     const student=await requireStudent(request,env);
     if(!student||student.id!==c.g.student_id||!student.email_verified)return fail("هذه جلسة طالب مرتبطة بحساب آخر أو لم يعد موثقًا",403);
     const allowed=await first(env,"SELECT 1 ok FROM quiz_student_groups q JOIN student_group_members m ON m.student_group_id=q.student_group_id WHERE q.quiz_id=? AND m.student_id=? LIMIT 1",c.z.id,student.id);
     if(!allowed)return fail("لم تعد ضمن مجموعة الوصول لهذه المسابقة",403);
    }
    if(!action&&method==="GET")return json(await makeState(env,c,url.searchParams.get("question_id")));
    if(action==="questions"&&method==="GET"){
     const done=new Set(c.answered.map(a=>a.question_id));return json({mode:c.z.progression_mode||"sequential",questions:c.list.map((x,i)=>({id:x.id,index:i+1,text:x.text,answered:done.has(x.id),locked:c.z.progression_mode==="teacher"&&i>(c.z.unlocked_question||0)}))});
    }
    if(action==="retry"&&method==="POST"){
     if(!c.z.allow_retry)return fail("غير مسموح",403);if(quizStatus(c.z)!=="open")return fail("أُغلقت المسابقة",403);
     await batch(env,[stmt(env,"DELETE FROM answers WHERE group_id=?",c.g.id),stmt(env,"UPDATE groups SET started=?,finished=NULL,seed=? WHERE id=?",now(),randomInt(2147483646)+1,c.g.id)]);return json({ok:1});
    }
    if(action==="answer"&&method==="POST"){
     const st=await makeState(env,c),b=await bodyOf(request);if(st.done)return json({error:"انتهت المسابقة",state:st},409);
     const cur=c.list.find(x=>x.id===Number(b.question_id)),mode=c.z.progression_mode||"sequential";
     if(!cur||c.answered.some(a=>a.question_id===cur.id)||(mode!=="free"&&cur.id!==st.question?.id)||(mode==="teacher"&&c.list.indexOf(cur)>(c.z.unlocked_question||0)))return json({error:"هذا السؤال غير متاح حاليًا",state:st},409);
     const isOrder=cur.type==="order",choice=isOrder?b.order:b.choice;
     if(isOrder){if(!Array.isArray(choice)||choice.length!==cur.options.length||new Set(choice).size!==choice.length||choice.some(n=>!Number.isInteger(n)||n<0||n>=cur.options.length))return fail("ترتيب غير صالح");}
     else if(!Number.isInteger(Number(choice))||Number(choice)<0||Number(choice)>=cur.options.length)return fail("اختيار غير صالح");
     const correct=isOrder?(choice.every((v,i)=>v===i)?1:0):(Number(choice)===cur.correct?1:0);
     try{await run(env,"INSERT INTO answers(group_id,question_id,choice,correct,points,at) VALUES(?,?,?,?,?,?)",c.g.id,cur.id,isOrder?JSON.stringify(choice):Number(choice),correct,correct?cur.points:0,now());}
     catch(e){return fail("تم إرسال الإجابة مسبقًا",409);}
     const c2=await getContext(env,tok),ns=await makeState(env,c2);
     return json({correct:c.z.show_correct?!!correct:null,right:c.z.show_correct?(isOrder?cur.options.map((_,i)=>i):cur.correct):null,state:ns});
    }
   }
   const groupDelete=p.match(/^\/api\/groups\/(\d+)$/);
   if(groupDelete&&method==="DELETE"){
    const u=await requireTeacher(request,env);if(!u)return fail("يلزم تسجيل الدخول",401);
    const g=await first(env,"SELECT g.* FROM groups g JOIN quizzes z ON z.id=g.quiz_id WHERE g.id=? AND z.teacher_id=?",Number(groupDelete[1]),u.id);
    if(!g)return fail("غير موجود",404);await run(env,"DELETE FROM groups WHERE id=?",g.id);return json({ok:1});
   }
   if(p==="/j/"+p.split("/").pop()&&/^\/j\//.test(p))return text(ASSETS["/play.html"],200,{"content-type":"text/html; charset=utf-8"});
   if(p==="/board/"+p.split("/").pop()&&/^\/board\//.test(p))return text(ASSETS["/board.html"],200,{"content-type":"text/html; charset=utf-8"});
   if(p==="/midmar-logo.webp"){
    const logoUrl="https://raw.githubusercontent.com/ABOODY25009/Midmar/cloudflare-v2/public/midmar-logo.webp";
    const cacheKey=new Request(logoUrl),cache=caches.default;let logo=await cache.match(cacheKey);
    if(!logo){const upstream=await fetch(logoUrl);if(!upstream.ok)return fail("تعذر تحميل شعار مِضمار",502);logo=new Response(upstream.body,{headers:{"content-type":"image/webp","cache-control":"public, max-age=86400","x-content-type-options":"nosniff"}});ctx.waitUntil(cache.put(cacheKey,logo.clone()))}
    return logo;
   }
   const asset=ASSETS[p];if(asset!==undefined){const type=p.endsWith(".js")?"text/javascript; charset=utf-8":p.endsWith(".css")?"text/css; charset=utf-8":p.endsWith(".svg")?"image/svg+xml":"text/html; charset=utf-8";return text(asset,200,{"content-type":type,"cache-control":p==="/admin.js"?"no-cache":"public, max-age=180"});}
   return fail("الصفحة غير موجودة",404);
  }catch(e){console.error("Worker error",e?.stack||e);return fail("حدث خطأ داخلي في مِضمار",500);}
 }
};
