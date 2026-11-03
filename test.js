const {spawn}=require('child_process'),{io}=require('socket.io-client'),fs=require('fs'),{DatabaseSync}=require('node:sqlite');
const DB='/tmp/mid_test.db';['','-wal','-shm'].forEach(x=>{try{fs.unlinkSync(DB+x)}catch{}});
const B='http://localhost:3911';let proc,res=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
const start=()=>new Promise(r=>{proc=spawn('node',['server.js'],{env:{...process.env,PORT:3911,DB_PATH:DB}});proc.stdout.on('data',r);proc.stderr.on('data',d=>{if(!/Experimental|trace-warnings/.test(String(d)))console.error(String(d))})});
const f=async(u,m='GET',b,c='')=>{const r=await fetch(B+u,{method:m,headers:{'Content-Type':'application/json',cookie:c},body:b?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');
 const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return {s:r.status,j,ck:sc?sc.split(';')[0]:''}};
const ok=(n,c)=>{res.push(!!c);console.log((c?'✔ ':'✘ ')+n)};
const qs=[{type:'mc',text:'٢+٢؟',points:2,options:['3','4','5'],correct:1},{type:'tf',text:'الشمس نجم',points:1,correct:0},{type:'mc',text:'عاصمة السعودية',points:3,options:['جدة','الرياض','مكة','الدمام'],correct:1}];
(async()=>{await start();const db=new DatabaseSync(DB);
 // ---- 1) الدخول بالاسم والرمز
 ok('رفض الدخول بدون جلسة',(await f('/api/quizzes')).s===401);
 ok('رفض رمز خاطئ',(await f('/api/login','POST',{username:'معلمة أ',code:'0000'})).s===401);
 ok('رفض استخدام الاسم كرمز دخول',(await f('/api/login','POST',{username:'1234x',code:'1234x'})).s===401);
 ok('رفض بدون اسم',(await f('/api/login','POST',{username:'',code:'1234'})).s===400);
 const la=await f('/api/login','POST',{username:'معلمة أ',code:'1234'});const A=la.ck;ok('دخول باسم المعلمة والرمز 1234',la.s===200&&A);
 ok('اسم المعلمة يظهر في /api/me',(await f('/api/me','GET',0,A)).j.user==='معلمة أ');
 const B2=(await f('/api/login','POST',{username:'معلمة ب',code:'1234'})).ck;ok('معلمة ثانية بنفس الرمز',(await f('/api/me','GET',0,B2)).j.user==='معلمة ب');
 ok('نفس الاسم يعيد نفس الحساب',(await f('/api/login','POST',{username:' معلمة   أ ',code:'1234'})).s===200&&db.prepare('SELECT COUNT(*) n FROM teachers').get().n===2);
 ok('إزالة إنشاء الحسابات وكلمات المرور',(await f('/api/setup','POST',{},A)).s===404&&(await f('/api/password','POST',{},A)).s===404);
 // ---- 2) مسابقة + بدء
 const id=(await f('/api/quizzes','POST',{title:'اختبار',show_correct:1,shuffle_q:1,shuffle_a:1,questions:qs},A)).j.id;const z=(await f('/api/quizzes/'+id,'GET',0,A)).j;
 ok('معلمة أخرى لا ترى مسابقتي',(await f('/api/quizzes/'+id,'GET',0,B2)).s===404&&(await f('/api/quizzes','GET',0,B2)).j.length===0);
 ok('الانضمام مرفوض قبل «ابدأ المسابقة»',(await f(`/api/join/${z.code}`,'POST',{name:'س'})).s===403);
 ok('معلمة أخرى لا تستطيع بدء مسابقتي',(await f(`/api/quizzes/${id}/start`,'POST',0,B2)).s===404);
 const so=io(B);const evs=[];so.on('board',d=>evs.push(d));await new Promise(r=>so.on('connect',r));so.emit('watch',z.code);await wait(150);
 ok('بدء المسابقة يعيد الرمز ويفتح الجلسة',(await f(`/api/quizzes/${id}/start`,'POST',0,A)).j.code===z.code);await wait(150);
 ok('لوحة العرض: مرحلة الانتظار مع الاسم والانضمام مفتوح',evs.at(-1).phase==='lobby'&&evs.at(-1).joinOpen&&evs.at(-1).teacher==='معلمة أ');
 // ---- 3) انضمام فرق
 const tok={};for(const n of ['X','Y','Z']){const r=await f(`/api/join/${z.code}`,'POST',{name:n});tok[n]=r.j.token;await wait(60)}
 ok('انضمام 3 فرق وظهورها لحظيًا',evs.at(-1).names.join()==='X,Y,Z'&&evs.at(-1).phase==='lobby');
 ok('منع تكرار اسم الفريق',(await f(`/api/join/${z.code}`,'POST',{name:'X'})).s===409);
 const real=q=>z.questions.find(x=>x.id===q.id);
 const play=async(t,mode,max=99)=>{let k=0;for(;;){const s=(await f('/api/play/'+t)).j;if(s.done||k>=max)return s;const r=real(s.question);
   if(!s.question.options.every(o=>!('correct'in o)))throw Error('leak');const pick=mode==='right'?r.correct:(r.correct+1)%r.options.length;
   const a=await f(`/api/play/${t}/answer`,'POST',{question_id:s.question.id,choice:pick});if(a.s!==200)throw Error(JSON.stringify(a.j));k++}};
 await play(tok.Z,'wrong',1);await play(tok.X,'right');await wait(250);let e=evs.at(-1);
 ok('أول فريق ينهي: المرحلة تتحول وتظهر «اكتمل الفريق الأول»',e.phase==='first'&&e.first.name==='X'&&e.first.score===6&&e.finished===1&&e.playing===2);
 ok('ترتيب لحظي للفرق المنتهية فقط والانضمام ما زال مفتوحًا (QR يبقى)',e.rows.length===1&&e.rows[0].name==='X'&&e.joinOpen);
 const late=await f(`/api/join/${z.code}`,'POST',{name:'W'});ok('فريق ينضم بعد انتهاء الأول',late.s===200);tok.W=late.j.token;
 await play(tok.Y,'right');await wait(250);e=evs.at(-1);
 // فريقان بنفس الدرجة: Y أنهى ثانيًا لكنه أسرع زمنًا
 const fin=n=>db.prepare('SELECT finished FROM groups WHERE token=?').get(tok[n]).finished;
 db.prepare('UPDATE groups SET started=? WHERE token=?').run(fin('X')-9000,tok.X);db.prepare('UPDATE groups SET started=? WHERE token=?').run(fin('Y')-3000,tok.Y);
 await f('/api/play/'+tok.X);await wait(250);e=evs.at(-1);
 ok('تساوي الدرجة: الأقل زمنًا يتقدّم (Y قبل X)',e.rows[0].name==='Y'&&e.rows[1].name==='X'&&e.rows[0].rank===1&&e.rows[1].rank===2);
 ok('الفريق الأول المُعلن هو من أنهى أولًا (X) رغم أن Y أسرع',e.first.name==='X');
 db.prepare('UPDATE groups SET started=? WHERE token=?').run(fin('Y')-5000,tok.Y);db.prepare('UPDATE groups SET started=? WHERE token=?').run(fin('X')-5000-(fin('Y')-fin('X'))*0,tok.X);
 // تعادل كامل: نفس الدرجة ونفس الزمن بالملّي ثانية
 db.prepare('UPDATE groups SET started=?,finished=? WHERE token=?').run(1000,6000,tok.X);db.prepare('UPDATE groups SET started=?,finished=? WHERE token=?').run(2000,7000,tok.Y);
 db.prepare('UPDATE answers SET at=6000 WHERE group_id=(SELECT id FROM groups WHERE token=?)').run(tok.X);db.prepare('UPDATE answers SET at=7000 WHERE group_id=(SELECT id FROM groups WHERE token=?)').run(tok.Y);
 await f('/api/play/'+tok.X);await wait(250);e=evs.at(-1);ok('التعادل الكامل يظهر بوضوح',e.rows[0].tie&&e.rows[1].tie&&e.rows[0].rank===1&&e.rows[1].rank===1);
 const before=fin('X');await f(`/api/play/${tok.X}/answer`,'POST',{question_id:z.questions[0].id,choice:0});await f('/api/play/'+tok.X);ok('لا يُسجَّل الإكمال أكثر من مرة',fin('X')===before&&db.prepare('SELECT COUNT(*) n FROM answers WHERE group_id=(SELECT id FROM groups WHERE token=?)').get(tok.X).n===3);
 // ---- 4) انتهاء الجميع
 await play(tok.Z,'wrong');await play(tok.W,'wrong');await wait(300);e=evs.at(-1);
 ok('انتهاء الجميع: مرحلة الترتيب الكامل',e.phase==='done'&&e.rows.length===4&&e.playing===0&&e.rows.at(-1).score<=e.rows[0].score);
 await f(`/api/quizzes/${id}/board`,'POST',{state:'hidden'},A);await wait(200);ok('إخفاء النتائج لا يسرّب الترتيب ولا الفريق الأول',evs.at(-1).hidden&&evs.at(-1).rows.length===0&&evs.at(-1).first===null);
 await f(`/api/quizzes/${id}/board`,'POST',{state:'shown'},A);
 await f(`/api/quizzes/${id}/session`,'POST',{open:false},A);await wait(200);
 ok('إيقاف الانضمام: فريق جديد مرفوض واللعب الحالي يعمل',(await f(`/api/join/${z.code}`,'POST',{name:'Q'})).s===403&&(await f('/api/play/'+tok.X)).s===200&&evs.at(-1).joinOpen===false);
 await f(`/api/quizzes/${id}/start`,'POST',0,A);
 // ---- 5) باقي الوظائف
 const r=(await f(`/api/quizzes/${id}/results`,'GET',0,A)).j;ok('الإحصائيات',r.hardest&&r.easiest&&r.avg>=0&&r.quiz.session_open===1);
 const csv=await f(`/api/quizzes/${id}/export.csv`,'GET',0,A);ok('تصدير CSV',typeof csv.j==='string'&&csv.j.includes('المجموعة')&&csv.j.split('\n').length>=5);
 const cp=await f(`/api/quizzes/${id}/copy`,'POST',0,A);ok('نسخ المسابقة (لا تبدأ مفتوحة)',cp.s===200&&(await f(`/api/join/${(await f('/api/quizzes/'+cp.j.id,'GET',0,A)).j.code}`,'POST',{name:'س'})).s===403);
 await f(`/api/quizzes/${cp.j.id}/archive`,'POST',0,A);ok('أرشفة',(await f('/api/quizzes','GET',0,A)).j.find(x=>x.id===cp.j.id).archived===1&&(await f(`/api/quizzes/${cp.j.id}/start`,'POST',0,A)).s===400);
 const cl=await f('/api/quizzes','POST',{title:'مغلقة',end_at:Date.now()-5000,questions:qs},A);ok('بدء مسابقة موعد إغلاقها مضى مرفوض',(await f(`/api/quizzes/${cl.j.id}/start`,'POST',0,A)).s===400);
 const fut=await f('/api/quizzes','POST',{title:'مستقبل',start_at:Date.now()+86400000,questions:qs},A);const fz=(await f('/api/quizzes/'+fut.j.id,'GET',0,A)).j;await f(`/api/quizzes/${fut.j.id}/start`,'POST',0,A);ok('زر البدء يتجاوز موعد بدء مؤجل',(await f(`/api/join/${fz.code}`,'POST',{name:'ف'})).s===200);
 const tl=await f('/api/quizzes','POST',{title:'وقت',time_limit:1,questions:qs},A);const tz=(await f('/api/quizzes/'+tl.j.id,'GET',0,A)).j;await f(`/api/quizzes/${tl.j.id}/start`,'POST',0,A);
 const tj=await f(`/api/join/${tz.code}`,'POST',{name:'ز'});db.prepare('UPDATE groups SET started=started-120000 WHERE token=?').run(tj.j.token);
 const se=io(B);const ev2=[];se.on('board',d=>ev2.push(d));await new Promise(r=>se.on('connect',r));se.emit('watch',tz.code);await wait(5800);
 ok('انتهاء الوقت يُنهي الفريق تلقائيًا ويحدّث الشاشة دون تدخل الطالبات',ev2.at(-1).finished===1&&ev2.at(-1).phase==='done'&&ev2.at(-1).first===null);se.close();
 ok('حذف مسابقة',(await f('/api/quizzes/'+cp.j.id,'DELETE',0,A)).s===200);
 so.close();proc.kill();await wait(500);await start();
 const A2=(await f('/api/login','POST',{username:'معلمة أ',code:'1234'})).ck;ok('البيانات باقية بعد إعادة التشغيل',(await f('/api/quizzes/'+id,'GET',0,A2)).j.questions.length===3&&(await f(`/api/board/${z.code}`)).j.rows.length===4);
 let blocked=0;for(let i=0;i<12;i++)if((await f('/api/login','POST',{username:'x1',code:'bad'})).s===429)blocked++;ok('حماية من محاولات الدخول المتكررة',blocked>0);
 proc.kill();console.log(`\n${res.filter(Boolean).length}/${res.length} نجحت`);process.exit(res.every(Boolean)?0:1)})().catch(e=>{console.error(e);proc&&proc.kill();process.exit(1)});
