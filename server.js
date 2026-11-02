const express=require('express'),http=require('http'),crypto=require('crypto'),path=require('path');
const {Server}=require('socket.io'),{DatabaseSync}=require('node:sqlite'),bcrypt=require('bcryptjs'),QR=require('qrcode');
const helmet=require('helmet'),rateLimit=require('express-rate-limit');
const PORT=process.env.PORT||3000, DB=process.env.DB_PATH||path.join(__dirname,'data','midmar.db');
require('fs').mkdirSync(path.dirname(DB),{recursive:true});
const db=new DatabaseSync(DB);db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;');
db.transaction=f=>(...a)=>{db.exec('BEGIN');try{const r=f(...a);db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
db.exec(`
CREATE TABLE IF NOT EXISTS teachers(id INTEGER PRIMARY KEY,username TEXT UNIQUE,hash TEXT);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,teacher_id INTEGER,created INTEGER);
CREATE TABLE IF NOT EXISTS quizzes(id INTEGER PRIMARY KEY,teacher_id INTEGER,title TEXT,description TEXT DEFAULT '',image TEXT DEFAULT '',
 time_limit INTEGER DEFAULT 0,shuffle_q INTEGER DEFAULT 0,shuffle_a INTEGER DEFAULT 0,show_correct INTEGER DEFAULT 1,allow_retry INTEGER DEFAULT 0,
 start_at INTEGER,end_at INTEGER,code TEXT UNIQUE,archived INTEGER DEFAULT 0,board TEXT DEFAULT 'shown',created INTEGER);
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY,quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,pos INTEGER,type TEXT,text TEXT,image TEXT DEFAULT '',points INTEGER DEFAULT 1,options TEXT,correct INTEGER);
CREATE TABLE IF NOT EXISTS groups(id INTEGER PRIMARY KEY,quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,name TEXT,token TEXT UNIQUE,seed INTEGER,started INTEGER,finished INTEGER,UNIQUE(quiz_id,name));
CREATE TABLE IF NOT EXISTS answers(id INTEGER PRIMARY KEY,group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,question_id INTEGER,choice INTEGER,correct INTEGER,points INTEGER,at INTEGER,UNIQUE(group_id,question_id));
`);
const app=express(),server=http.createServer(app),io=new Server(server);
app.set('trust proxy',1);app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'6mb'}));
const now=()=>Date.now(), wrap=f=>(q,s,n)=>Promise.resolve().then(()=>f(q,s,n)).catch(e=>{console.error(e);s.status(500).json({error:'خطأ في الخادم'})});
const cookie=(q,k)=>((q.headers.cookie||'').split(/;\s*/).find(c=>c.startsWith(k+'='))||'').slice(k.length+1);
function auth(q,s,n){const r=db.prepare('SELECT teacher_id FROM sessions WHERE sid=?').get(cookie(q,'sid'));if(!r)return s.status(401).json({error:'غير مصرح'});q.tid=r.teacher_id;n()}
// ---- auth
const lim=rateLimit({windowMs:15*60e3,max:10,standardHeaders:true,message:{error:'محاولات كثيرة، حاولي بعد 15 دقيقة'}});
const login=(s,id)=>{const sid=crypto.randomBytes(24).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid,id,now());
 s.setHeader('Set-Cookie',`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600${process.env.NODE_ENV==='production'?'; Secure':''}`)};
app.get('/api/me',(q,s)=>{const r=db.prepare('SELECT t.username FROM sessions x JOIN teachers t ON t.id=x.teacher_id WHERE sid=?').get(cookie(q,'sid'));
 s.json({user:r?.username||null,needsSetup:false})});
app.post('/api/setup',lim,(q,s)=>{if(db.prepare('SELECT 1 FROM teachers').get())return s.status(403).json({error:'تم الإعداد مسبقًا'});
 const {username,password}=q.body;if(!username||!password||password.length<6)return s.status(400).json({error:'كلمة المرور 6 أحرف على الأقل'});
 const id=db.prepare('INSERT INTO teachers(username,hash) VALUES(?,?)').run(username.trim(),bcrypt.hashSync(password,10)).lastInsertRowid;login(s,id);s.json({ok:1})});
app.post('/api/login',lim,(q,s)=>{const username=String(q.body.username||'').trim().slice(0,80),code=String(q.body.code||'');
 if(!username)return s.status(400).json({error:'اكتبي اسم المعلمة'});
 if(code!=='1234')return s.status(401).json({error:'رمز المعلمة غير صحيح'});
 let t=db.prepare('SELECT * FROM teachers WHERE username=?').get(username);
 if(!t){const id=db.prepare('INSERT INTO teachers(username,hash) VALUES(?,NULL)').run(username).lastInsertRowid;t={id,username}}
 login(s,t.id);s.json({ok:1})});
app.post('/api/logout',(q,s)=>{db.prepare('DELETE FROM sessions WHERE sid=?').run(cookie(q,'sid'));s.setHeader('Set-Cookie','sid=; Max-Age=0; Path=/');s.json({ok:1})});
app.post('/api/password',auth,(q,s)=>{const t=db.prepare('SELECT * FROM teachers WHERE id=?').get(q.tid);
 if(!bcrypt.compareSync(String(q.body.old||''),t.hash)||String(q.body.new||'').length<6)return s.status(400).json({error:'تحققي من كلمة المرور الحالية والجديدة (6 أحرف فأكثر)'});
 db.prepare('UPDATE teachers SET hash=? WHERE id=?').run(bcrypt.hashSync(q.body.new,10),q.tid);s.json({ok:1})});
// ---- quizzes
const newCode=()=>{for(;;){const c=String(crypto.randomInt(100000,999999));if(!db.prepare('SELECT 1 FROM quizzes WHERE code=?').get(c))return c}};
const own=(q,s)=>{const r=db.prepare('SELECT * FROM quizzes WHERE id=? AND teacher_id=?').get(q.params.id,q.tid);if(!r)s.status(404).json({error:'غير موجود'});return r};
const qs=id=>db.prepare('SELECT * FROM questions WHERE quiz_id=? ORDER BY pos').all(id).map(x=>({...x,options:JSON.parse(x.options)}));
function saveQuestions(id,list){db.prepare('DELETE FROM questions WHERE quiz_id=?').run(id);const ins=db.prepare('INSERT INTO questions(quiz_id,pos,type,text,image,points,options,correct) VALUES(?,?,?,?,?,?,?,?)');
 list.forEach((x,i)=>{const tf=x.type==='tf',op=tf?['صح','خطأ']:x.options.map(String).filter(o=>o.trim());
  if(!String(x.text||'').trim())throw Error('نص السؤال مطلوب');if(op.length<2||op.length>6)throw Error('الخيارات من 2 إلى 6');
  if(x.correct===null||x.correct===undefined||x.correct===''||!Number.isInteger(+x.correct)||x.correct<0||x.correct>=op.length)throw Error('حددي الإجابة الصحيحة لكل سؤال');
  ins.run(id,i,tf?'tf':'mc',x.text.trim(),x.image||'',Math.max(1,+x.points||1),JSON.stringify(op),+x.correct)})}
const fields=b=>[String(b.title||'').trim()||(()=>{throw Error('اسم المسابقة مطلوب')})(),b.description||'',b.image||'',Math.max(0,+b.time_limit||0),b.shuffle_q?1:0,b.shuffle_a?1:0,b.show_correct?1:0,b.allow_retry?1:0,b.start_at||null,b.end_at||null];
app.get('/api/quizzes',auth,(q,s)=>s.json(db.prepare(`SELECT z.*,(SELECT COUNT(*) FROM questions WHERE quiz_id=z.id) nq,(SELECT COUNT(*) FROM groups WHERE quiz_id=z.id) ng FROM quizzes z WHERE teacher_id=? ORDER BY id DESC`).all(q.tid)));
app.post('/api/quizzes',auth,(q,s)=>{try{const id=db.transaction(()=>{const r=db.prepare('INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,start_at,end_at,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
 .run(...fields(q.body),q.tid,newCode(),now()).lastInsertRowid;saveQuestions(r,q.body.questions||[]);return r})();s.json({id})}catch(e){s.status(400).json({error:e.message})}});
app.get('/api/quizzes/:id',auth,(q,s)=>{const z=own(q,s);if(z)s.json({...z,questions:qs(z.id)})});
app.put('/api/quizzes/:id',auth,(q,s)=>{const z=own(q,s);if(!z)return;try{db.transaction(()=>{db.prepare('UPDATE quizzes SET title=?,description=?,image=?,time_limit=?,shuffle_q=?,shuffle_a=?,show_correct=?,allow_retry=?,start_at=?,end_at=? WHERE id=?').run(...fields(q.body),z.id);
 if(!db.prepare('SELECT 1 FROM groups WHERE quiz_id=?').get(z.id))saveQuestions(z.id,q.body.questions||[]);})();s.json({ok:1})}catch(e){s.status(400).json({error:e.message})}});
app.post('/api/quizzes/:id/copy',auth,(q,s)=>{const z=own(q,s);if(!z)return;const id=db.transaction(()=>{const r=db.prepare('INSERT INTO quizzes(title,description,image,time_limit,shuffle_q,shuffle_a,show_correct,allow_retry,teacher_id,code,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
 .run(z.title+' (نسخة)',z.description,z.image,z.time_limit,z.shuffle_q,z.shuffle_a,z.show_correct,z.allow_retry,q.tid,newCode(),now()).lastInsertRowid;saveQuestions(r,qs(z.id));return r})();s.json({id})});
app.post('/api/quizzes/:id/archive',auth,(q,s)=>{const z=own(q,s);if(!z)return;db.prepare('UPDATE quizzes SET archived=? WHERE id=?').run(z.archived?0:1,z.id);s.json({ok:1})});
app.post('/api/quizzes/:id/board',auth,(q,s)=>{const z=own(q,s);if(!z)return;db.prepare('UPDATE quizzes SET board=? WHERE id=?').run(q.body.state==='hidden'?'hidden':'shown',z.id);push(z.id);s.json({ok:1})});
app.delete('/api/quizzes/:id',auth,(q,s)=>{const z=own(q,s);if(!z)return;db.prepare('DELETE FROM quizzes WHERE id=?').run(z.id);s.json({ok:1})});
app.delete('/api/groups/:gid',auth,(q,s)=>{const g=db.prepare('SELECT g.* FROM groups g JOIN quizzes z ON z.id=g.quiz_id WHERE g.id=? AND z.teacher_id=?').get(q.params.gid,q.tid);if(!g)return s.status(404).json({error:'غير موجود'});
 db.prepare('DELETE FROM groups WHERE id=?').run(g.id);push(g.quiz_id);s.json({ok:1})});
// ---- ranking / stats
function ranking(z){const total=db.prepare('SELECT COALESCE(SUM(points),0) t,COUNT(*) n FROM questions WHERE quiz_id=?').get(z.id);
 const rows=db.prepare(`SELECT g.id,g.name,g.started,g.finished,COUNT(a.id) answered,COALESCE(SUM(a.correct),0) correct,COALESCE(SUM(a.points),0) score,MAX(a.at) last FROM groups g LEFT JOIN answers a ON a.group_id=g.id WHERE g.quiz_id=? GROUP BY g.id`).all(z.id)
 .map(r=>({...r,done:r.finished?1:0,duration:Math.round(((r.finished||r.last||r.started)-r.started)/1000)}));
 rows.sort((a,b)=>b.score-a.score||a.duration-b.duration||a.id-b.id);
 rows.forEach((r,i)=>{const p=rows[i-1];r.rank=p&&p.score===r.score&&p.duration===r.duration?p.rank:i+1;r.tie=rows.some(o=>o!==r&&o.score===r.score&&o.duration===r.duration)});
 return {rows,totalPoints:total.t,nq:total.n}}
function boardData(z){const r=ranking(z),hidden=z.board==='hidden';
 return {title:z.title,code:z.code,hidden,totalPoints:r.totalPoints,nq:r.nq,finished:r.rows.filter(x=>x.done).length,playing:r.rows.filter(x=>!x.done).length,
  rows:hidden?[]:r.rows.map(({id,name,rank,tie,score,correct,duration,done,answered})=>({id,name,rank,tie,score,correct,duration,done,answered}))}}
const push=id=>{const z=db.prepare('SELECT * FROM quizzes WHERE id=?').get(id);if(z)io.to('b'+z.code).emit('board',boardData(z))};
io.on('connection',so=>{so.on('watch',code=>{const z=db.prepare('SELECT * FROM quizzes WHERE code=?').get(String(code));if(z){so.join('b'+z.code);so.emit('board',boardData(z))}})});
app.get('/api/board/:code',(q,s)=>{const z=db.prepare('SELECT * FROM quizzes WHERE code=?').get(q.params.code);z?s.json(boardData(z)):s.status(404).json({error:'غير موجود'})});
app.get('/api/quizzes/:id/results',auth,(q,s)=>{const z=own(q,s);if(!z)return;const r=ranking(z);
 const per=db.prepare(`SELECT q.id,q.text,q.pos,COUNT(a.id) answered,COALESCE(SUM(a.correct),0) correct FROM questions q LEFT JOIN answers a ON a.question_id=q.id WHERE q.quiz_id=? GROUP BY q.id ORDER BY q.pos`).all(z.id)
 .map(x=>({...x,wrong:x.answered-x.correct,pct:x.answered?Math.round(100*x.correct/x.answered):null}));
 const ans=per.filter(x=>x.answered);const avg=r.rows.length?Math.round(10*r.rows.reduce((a,b)=>a+b.score,0)/r.rows.length)/10:0;
 const sorted=[...ans].sort((a,b)=>a.pct-b.pct);
 s.json({quiz:{id:z.id,title:z.title,code:z.code},...r,avg,questions:per,hardest:sorted[0]||null,easiest:sorted[sorted.length-1]||null,
  mostMissed:ans.filter(x=>x.wrong>x.correct)})});
app.get('/api/quizzes/:id/export.csv',auth,(q,s)=>{const z=own(q,s);if(!z)return;const r=ranking(z);const esc=v=>{v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return `"${v.replace(/"/g,'""')}"`};
 const lines=[['المركز','المجموعة','الدرجة','الإجابات الصحيحة','عدد الأسئلة المجاب عنها','مدة الإنجاز (ثانية)','الحالة'].map(esc).join(',')];
 r.rows.forEach(x=>lines.push([x.rank,x.name,x.score,x.correct,x.answered,x.duration,x.done?'أنهت':'لم تنه'].map(esc).join(',')));
 s.setHeader('Content-Type','text/csv; charset=utf-8');s.setHeader('Content-Disposition',`attachment; filename="results-${z.id}.csv"`);s.send('\ufeff'+lines.join('\r\n'))});
app.get('/api/dashboard',auth,(q,s)=>{const zs=db.prepare('SELECT * FROM quizzes WHERE teacher_id=? ORDER BY id DESC').all(q.tid);let ng=0,sum=0,best=null;
 const chart=zs.slice(0,8).reverse().map(z=>{const r=ranking(z);ng+=0;return {title:z.title,groups:r.rows.length,avg:r.rows.length?Math.round(10*r.rows.reduce((a,b)=>a+b.score,0)/r.rows.length)/10:0,max:r.totalPoints}});
 zs.forEach(z=>{const r=ranking(z);ng+=r.rows.length;r.rows.forEach(x=>{sum+=x.score;if(!best||x.score/(r.totalPoints||1)>best.ratio)best={name:x.name,quiz:z.title,score:x.score,total:r.totalPoints,ratio:x.score/(r.totalPoints||1)}})});
 s.json({quizzes:zs.length,active:zs.filter(z=>!z.archived).length,groups:ng,avg:ng?Math.round(10*sum/ng)/10:0,best,recent:zs.slice(0,5).map(z=>({id:z.id,title:z.title,archived:z.archived})),chart})});
app.get('/api/qr',(q,s)=>{const t=String(q.query.text||'').slice(0,300);QR.toString(t,{type:'svg',margin:1},(e,svg)=>{s.type('image/svg+xml').send(svg)})});
// ---- players
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const shuffle=(arr,r)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const status=z=>z.archived?'مؤرشفة':z.start_at&&now()<z.start_at?'لم تبدأ بعد':z.end_at&&now()>z.end_at?'أُغلقت':'open';
app.get('/api/join/:code',(q,s)=>{const z=db.prepare('SELECT * FROM quizzes WHERE code=?').get(q.params.code);if(!z)return s.status(404).json({error:'رمز غير صحيح'});
 s.json({title:z.title,description:z.description,image:z.image,time_limit:z.time_limit,nq:db.prepare('SELECT COUNT(*) n FROM questions WHERE quiz_id=?').get(z.id).n,status:status(z)})});
app.post('/api/join/:code',rateLimit({windowMs:60e3,max:30}),(q,s)=>{const z=db.prepare('SELECT * FROM quizzes WHERE code=?').get(q.params.code);if(!z)return s.status(404).json({error:'رمز غير صحيح'});
 const st=status(z);if(st!=='open')return s.status(403).json({error:'المسابقة '+st});const name=String(q.body.name||'').trim().slice(0,40);if(!name)return s.status(400).json({error:'اكتبي اسم المجموعة'});
 if(!db.prepare('SELECT 1 FROM questions WHERE quiz_id=?').get(z.id))return s.status(400).json({error:'لا توجد أسئلة'});
 try{const token=crypto.randomBytes(16).toString('hex');db.prepare('INSERT INTO groups(quiz_id,name,token,seed,started) VALUES(?,?,?,?,?)').run(z.id,name,token,crypto.randomInt(1,2**31),now());push(z.id);s.json({token})}
 catch(e){s.status(409).json({error:'اسم المجموعة مستخدم، اختاري اسمًا آخر'})}});
function ctx(token){const g=db.prepare('SELECT * FROM groups WHERE token=?').get(token);if(!g)return null;const z=db.prepare('SELECT * FROM quizzes WHERE id=?').get(g.quiz_id);
 let list=qs(z.id);if(z.shuffle_q)list=shuffle(list,rng(g.seed));return {g,z,list,answered:db.prepare('SELECT * FROM answers WHERE group_id=?').all(g.id)}}
const deadline=(z,g)=>z.time_limit?g.started+z.time_limit*60000:null;
function finish(g,at){if(!g.finished){db.prepare('UPDATE groups SET finished=? WHERE id=?').run(at,g.id);g.finished=at}}
function state(c){const {g,z,list,answered}=c,dl=deadline(z,g),n=list.length,done=answered.length>=n||g.finished||(dl&&now()>dl);
 if(done&&!g.finished)finish(g,Math.min(now(),dl||now()));
 const sc=answered.reduce((a,b)=>a+b.points,0),tot=list.reduce((a,b)=>a+b.points,0),base={title:z.title,group:g.name,total:n,answered:answered.length,deadline:dl,now:now(),score:sc,totalPoints:tot,correct:answered.filter(a=>a.correct).length,retry:!!z.allow_retry};
 if(done){const rk=ranking(z).rows.find(r=>r.id===g.id);return {...base,done:true,duration:Math.round(((g.finished||now())-g.started)/1000),rank:z.board==='hidden'?null:rk?.rank}}
 const cur=list.find(x=>!answered.some(a=>a.question_id===x.id)),r=rng(g.seed+cur.id);let opts=cur.options.map((t,i)=>({i,t}));if(z.shuffle_a&&cur.type==='mc')opts=shuffle(opts,r);
 return {...base,done:false,question:{id:cur.id,type:cur.type,text:cur.text,image:cur.image,points:cur.points,options:opts}}}
app.get('/api/play/:token',(q,s)=>{const c=ctx(q.params.token);if(!c)return s.status(404).json({error:'جلسة غير صالحة'});s.json(state(c));push(c.z.id)});
app.post('/api/play/:token/answer',rateLimit({windowMs:10e3,max:40}),(q,s)=>{const c=ctx(q.params.token);if(!c)return s.status(404).json({error:'جلسة غير صالحة'});
 const st=state(c);if(st.done)return s.status(409).json({error:'انتهت المسابقة',state:st});
 const cur=c.list.find(x=>x.id===+q.body.question_id);if(!cur||cur.id!==st.question.id)return s.status(409).json({error:'هذا ليس السؤال الحالي',state:st});
 const ch=+q.body.choice;if(!Number.isInteger(ch)||ch<0||ch>=cur.options.length)return s.status(400).json({error:'اختيار غير صالح'});
 const ok=ch===cur.correct?1:0;try{db.prepare('INSERT INTO answers(group_id,question_id,choice,correct,points,at) VALUES(?,?,?,?,?,?)').run(c.g.id,cur.id,ch,ok,ok?cur.points:0,now())}
 catch(e){return s.status(409).json({error:'تم إرسال الإجابة مسبقًا'})}
 const c2=ctx(q.params.token),ns=state(c2);push(c.z.id);s.json({correct:c.z.show_correct?!!ok:null,right:c.z.show_correct?cur.correct:null,state:ns})});
app.post('/api/play/:token/retry',(q,s)=>{const c=ctx(q.params.token);if(!c||!c.z.allow_retry)return s.status(403).json({error:'غير مسموح'});if(status(c.z)!=='open')return s.status(403).json({error:'أُغلقت المسابقة'});
 db.prepare('DELETE FROM answers WHERE group_id=?').run(c.g.id);db.prepare('UPDATE groups SET started=?,finished=NULL,seed=? WHERE id=?').run(now(),crypto.randomInt(1,2**31),c.g.id);push(c.z.id);s.json({ok:1})});
// ---- static / pages
const P=f=>(q,s)=>s.sendFile(path.join(__dirname,'public',f));
app.get('/j/:code',P('play.html'));app.get('/board/:code',P('board.html'));app.use(express.static(path.join(__dirname,'public'),{index:'index.html'}));
if(require.main===module)server.listen(PORT,()=>console.log('مِضمار يعمل على http://localhost:'+PORT));
module.exports={app,server,db};
