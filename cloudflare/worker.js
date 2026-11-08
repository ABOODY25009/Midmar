import { ASSETS } from "./assets.js";
import { LOGO_BASE64 } from "./brand.js";

const APP_VERSION = "3.0.0";
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
 return first(env,"SELECT t.id,t.username,t.email,t.provider,t.onboarding_version FROM sessions s JOIN teachers t ON t.id=s.teacher_id WHERE s.sid=?",sid);
};
const requireUser = async (request,env) => {
 const u=await authUser(request,env);return u||null;
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
   if(p==="/midmar-logo.webp"){
    const binary=atob(LOGO_BASE64),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Response(bytes,{headers:{"content-type":"image/webp","cache-control":"public, max-age=31536000, immutable"}});
   }
   if(p==="/health")return json({ok:true,app:"midmar-v2",version:APP_VERSION,database:"connected",time:new Date().toISOString()});
   if(p==="/api/version")return json({version:APP_VERSION});
   if(p==="/api/me"){
    const u=await authUser(request,env);return json(u?{authenticated:true,user:u.username,email:u.email,provider:u.provider}:{authenticated:false});
   }
   if(p==="/auth/google"&&method==="GET"){
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return Response.redirect(new URL("/?auth_error=not_configured",url),302);
    const state=token(32);
    await run(env,"INSERT INTO oauth_states(state,provider,created) VALUES(?,?,?)",state,"google",now());
    const callback=env.GOOGLE_REDIRECT_URI||url.origin+"/auth/google/callback";
    const go=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:"code",scope:"openid email profile",state,nonce:state,prompt:"select_account"}))go.searchParams.set(k,v);
    return Response.redirect(go.toString(),302);
   }
   if(p==="/auth/google/callback"&&method==="GET"){
    const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";
    const saved=await first(env,"SELECT state FROM oauth_states WHERE state=? AND provider='google' AND created>?",state,now()-600000);
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
     let teacher=await first(env,"SELECT id FROM teachers WHERE provider='google' AND provider_sub=?",info.sub);
     if(!teacher){
      const ownerEmail=String(env.GOOGLE_OWNER_EMAIL||"").trim().toLowerCase();
      const legacy=ownerEmail&&ownerEmail===email?await first(env,"SELECT id FROM teachers WHERE id=1 AND provider_sub IS NULL"):null;
      if(legacy){
       await run(env,"UPDATE teachers SET username=?,email=?,provider='google',provider_sub=? WHERE id=?","google:"+info.sub,email,info.sub,legacy.id);teacher={id:legacy.id};
      }else{
       const ins=await run(env,"INSERT INTO teachers(username,hash,email,provider,provider_sub) VALUES(?,NULL,?,'google',?)","google:"+info.sub,email,info.sub);teacher={id:ins.meta.last_row_id};
      }
     }else await run(env,"UPDATE teachers SET email=? WHERE id=?",email,teacher.id);
     const sid=token(32);await run(env,"INSERT INTO sessions(sid,teacher_id,created) VALUES(?,?,?)",sid,teacher.id,now());
     return new Response(null,{status:302,headers:{location:url.origin+"/", "set-cookie":cookieHeader(sid)}});
    }catch(e){console.error("Google OAuth error",e.message);return Response.redirect(url.origin+"/?auth_error=google_failed",302);}
   }
   if(p==="/api/logout"&&method==="POST"){
    const sid=cookie(request,"sid");if(sid)await run(env,"DELETE FROM sessions WHERE sid=?",sid);
    return json({ok:1},200,{"set-cookie":"sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});
   }
   if(p==="/api/onboarding"&&method==="GET"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const v=Number(u.onboarding_version||0);return json({version:v,showTutorial:v===0,showUpdateNotice:v===1});
   }
   if(p==="/api/onboarding/complete"&&method==="POST"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    await run(env,"UPDATE teachers SET onboarding_version=2 WHERE id=?",u.id);return json({ok:true,version:2});
   }
   if(p==="/api/ai/status"&&method==="GET"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول",401);
    const provider=env.AI?"cloudflare-workers-ai":env.OPENAI_API_KEY?"openai":"none";
    return json({enabled:provider!=="none",provider,model:provider==="cloudflare-workers-ai"?"@cf/qwen/qwen3.8-27b":provider==="openai"?"gpt-4o-mini":null});
   }
   if(p==="/api/ai/parse-sheet"&&method==="POST"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول",401);
    const b=await bodyOf(request),image=String(b.image||"");
    if(!/^data:image\/(png|jpeg|webp);base64,/.test(image)||image.length>3000000)return fail("الصورة غير صالحة أو حجمها كبير (الحد 3 ميغابايت).");
    if(!env.AI&&!env.OPENAI_API_KEY)return fail("خدمة الذكاء الاصطناعي غير مفعّلة على الخادم.",503);
    const systemPrompt='استخرج الأسئلة من صورة ورقة الاختبار. أعد كائن JSON فقط بهذا الشكل: {"questions":[{"type":"mc","text":"نص السؤال","options":["الخيار الأول","الخيار الثاني"],"correct":0,"points":1}]}. استخدم type="tf" لأسئلة صح أو خطأ. لا تخترع سؤالًا أو خيارًا أو إجابة. إذا كانت الإجابة الصحيحة غير ظاهرة بوضوح استخدم correct:null. لا تستنتج الإجابة من معلوماتك؛ اقرأ ما يظهر في الورقة فقط. حافظ على اللغة العربية والنص الأصلي، ولا تضف شرحًا خارج JSON.';
    const userPrompt="اقرأ الصورة كاملة واستخرج الأسئلة والخيارات كما تظهر. لا تضف أسئلة غير موجودة. أعد correct كرقم يبدأ من صفر إذا كانت الإجابة الصحيحة محددة بوضوح، وإلا null.";
    let rawContent="";
    try{
     if(env.AI){
      const result=await env.AI.run("@cf/qwen/qwen3.8-27b",{
       messages:[
        {role:"system",content:systemPrompt},
        {role:"user",content:[{type:"text",text:userPrompt},{type:"image_url",image_url:{url:image}}]}
       ],
       response_format:{type:"json_object"},
       reasoning_effort:"low",
       max_completion_tokens:1800,
       temperature:0.1
      });
      rawContent=result?.choices?.[0]?.message?.content??result?.response??"";
     }else{
      const result=await fetch("https://api.openai.com/v1/chat/completions",{
       method:"POST",
       headers:{authorization:"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},
       body:JSON.stringify({model:"gpt-4o-mini",response_format:{type:"json_object"},messages:[
        {role:"system",content:systemPrompt},
        {role:"user",content:[{type:"text",text:userPrompt},{type:"image_url",image_url:{url:image,detail:"high"}}]}
       ]})
      });
      const data=await result.json();
      if(!result.ok)return fail(data.error?.message||"تعذر تحليل الصورة",502);
      rawContent=data.choices?.[0]?.message?.content||"";
     }
     if(rawContent&&typeof rawContent==="object")rawContent=JSON.stringify(rawContent);
     const clean=String(rawContent).replace(/```(?:json)?/gi,"").replace(/```/g,"").trim();
     const parsed=JSON.parse(clean);
     const questions=(Array.isArray(parsed.questions)?parsed.questions:[])
      .filter(x=>x&&typeof x.text==="string"&&x.text.trim()&&Array.isArray(x.options))
      .map(x=>{
       const type=x.type==="tf"?"tf":"mc";
       const options=type==="tf"?["صح","خطأ"]:x.options.map(v=>String(v).trim()).filter(Boolean).slice(0,6);
       const correct=Number.isInteger(x.correct)&&x.correct>=0&&x.correct<options.length?x.correct:null;
       return {type,text:String(x.text).trim(),options,correct,points:Math.max(1,Math.min(100,Number(x.points)||1))};
      })
      .filter(x=>x.options.length>=2);
     if(!questions.length)return fail("لم يتم العثور على أسئلة واضحة في الصورة. جرّب صورة أوضح.",422);
     return json({questions,provider:env.AI?"cloudflare-workers-ai":"openai"});
    }catch(e){
     console.error("AI sheet parsing failed:",e?.message||e);
     return fail("تعذر تحليل الورقة. تأكد من وضوح الصورة ثم حاول مرة أخرى.",502);
    }
   }

      const quizPath=p.match(/^\/api\/quizzes\/(\d+)(?:\/(copy|archive|board|results|export\.csv|unlock))?$/);
   if(p==="/api/quizzes"&&method==="GET"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const rows=await all(env,"SELECT z.*,(SELECT COUNT(*) FROM questions WHERE quiz_id=z.id) nq,(SELECT COUNT(*) FROM groups WHERE quiz_id=z.id) ng FROM quizzes z WHERE teacher_id=? ORDER BY id DESC",u.id);return json(rows);
   }
   if(p==="/api/quizzes"&&method==="POST"){
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const b=await bodyOf(request);try{
     const f=quizFields(b),code=await newCode(env),ins=await run(env,"INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,start_at,end_at,participation_mode,entry_mode,progression_mode,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",...f,u.id,code,now());
     const id=ins.meta.last_row_id;await saveQuestions(env,id,b.questions||[]);await saveRoster(env,id,b.roster||"");return json({id});
    }catch(e){return fail(e.message);}
   }
   if(quizPath){
    const id=Number(quizPath[1]),action=quizPath[2],u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
    const z=await ownedQuiz(env,id,u.id);if(!z)return fail("غير موجود",404);
    if(!action&&method==="DELETE"){await run(env,"DELETE FROM quizzes WHERE id=?",id);return json({ok:1});}
    if(!action&&method==="GET")return json({...z,questions:await questionsFor(env,id),roster:(await all(env,"SELECT name FROM quiz_roster WHERE quiz_id=? ORDER BY name",id)).map(x=>x.name).join("\n")});
    if(!action&&method==="PUT"){
     const b=await bodyOf(request);try{const f=quizFields(b);
      await run(env,"UPDATE quizzes SET title=?,description=?,image=?,time_limit=?,shuffle_q=?,shuffle_a=?,show_correct=?,allow_retry=?,start_at=?,end_at=?,participation_mode=?,entry_mode=?,progression_mode=? WHERE id=?",...f,id);
      if(!await first(env,"SELECT 1 ok FROM groups WHERE quiz_id=? LIMIT 1",id))await saveQuestions(env,id,b.questions||[]);
      await saveRoster(env,id,b.roster||"");return json({ok:1});
     }catch(e){return fail(e.message);}
    }
    if(action==="copy"&&method==="POST"){
     const code=await newCode(env),ins=await run(env,"INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,participation_mode,entry_mode,progression_mode,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",z.title+" (نسخة)",z.description,z.image,z.time_limit,z.shuffle_q,z.shuffle_a,z.show_correct,z.allow_retry,z.participation_mode||"groups",z.entry_mode||"both",z.progression_mode||"sequential",u.id,code,now());
     const nid=ins.meta.last_row_id;await saveQuestions(env,nid,await questionsFor(env,id));await saveRoster(env,nid,(await all(env,"SELECT name FROM quiz_roster WHERE quiz_id=?",id)).map(x=>x.name).join("\n"));return json({id:nid});
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
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول بحساب Google",401);
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
    return json({title:z.title,description:z.description,image:z.image,time_limit:z.time_limit,nq:count.n,status:quizStatus(z),participation_mode:z.participation_mode||"groups",entry_mode:z.entry_mode||"both",roster:(z.participation_mode==="students"&&z.entry_mode!=="qr")?await all(env,"SELECT id,name FROM quiz_roster WHERE quiz_id=? AND claimed=0 ORDER BY name",z.id):[]});
   }
   if(joinPath&&method==="POST"){
    const z=await first(env,"SELECT * FROM quizzes WHERE code=?",joinPath[1]);if(!z)return fail("رمز غير صحيح",404);
    const st=quizStatus(z);if(st!=="open")return fail("المسابقة "+st,403);
    const b=await bodyOf(request),student=z.participation_mode==="students",entry=z.entry_mode||"both",rosterId=Number(b.roster_id)||null;let name=String(b.name||"").trim().slice(0,40);
    if(student&&rosterId&&entry!=="qr"){const r=await first(env,"SELECT * FROM quiz_roster WHERE id=? AND quiz_id=? AND claimed=0",rosterId,z.id);if(!r)return fail("هذا الاسم لم يعد متاحًا",409);name=r.name;}
    if(student&&entry==="roster"&&!rosterId)return fail("اختاري اسمك من القائمة");
    if(!name)return fail("اكتبي الاسم");
    if(!await first(env,"SELECT 1 ok FROM questions WHERE quiz_id=? LIMIT 1",z.id))return fail("لا توجد أسئلة");
    const tok=token(16),seed=randomInt(2147483646)+1;
    try{const r=await run(env,"INSERT INTO groups(quiz_id,name,token,seed,started) VALUES(?,?,?,?,?)",z.id,name,tok,seed,now());if(rosterId)await run(env,"UPDATE quiz_roster SET claimed=1 WHERE id=? AND quiz_id=?",rosterId,z.id);return json({token:tok});}
    catch(e){return fail("الاسم مستخدم في هذه المسابقة، اختاري اسمًا آخر",409);}
   }
   const play=p.match(/^\/api\/play\/([a-f0-9]{32})(?:\/(questions|answer|retry))?$/);
   if(play){
    const tok=play[1],action=play[2]||"",c=await getContext(env,tok);if(!c)return fail("جلسة غير صالحة",404);
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
    const u=await requireUser(request,env);if(!u)return fail("يلزم تسجيل الدخول",401);
    const g=await first(env,"SELECT g.* FROM groups g JOIN quizzes z ON z.id=g.quiz_id WHERE g.id=? AND z.teacher_id=?",Number(groupDelete[1]),u.id);
    if(!g)return fail("غير موجود",404);await run(env,"DELETE FROM groups WHERE id=?",g.id);return json({ok:1});
   }
   if(p==="/j/"+p.split("/").pop()&&/^\/j\//.test(p))return text(ASSETS["/play.html"],200,{"content-type":"text/html; charset=utf-8"});
   if(p==="/board/"+p.split("/").pop()&&/^\/board\//.test(p))return text(ASSETS["/board.html"],200,{"content-type":"text/html; charset=utf-8"});
   const asset=ASSETS[p];if(asset!==undefined){const type=p.endsWith(".js")?"text/javascript; charset=utf-8":p.endsWith(".css")?"text/css; charset=utf-8":p.endsWith(".svg")?"image/svg+xml":"text/html; charset=utf-8";return text(asset,200,{"content-type":type,"cache-control":p==="/admin.js"?"no-cache":"public, max-age=180"});}
   return fail("الصفحة غير موجودة",404);
  }catch(e){console.error("Worker error",e?.stack||e);return fail("حدث خطأ داخلي في مِضمار",500);}
 }
};
