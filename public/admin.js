const $=(s,r=document)=>r.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(u,m='GET',b){const r=await fetch(u,{method:m,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'حدث خطأ');return j}
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2500)}
function confirmBox(msg){return new Promise(res=>{const d=document.createElement('dialog');d.innerHTML=`<p>${esc(msg)}</p><div class=row><button class="btn d" value=y>نعم، تأكيد</button><button class=btn value=n>إلغاء</button></div>`;
 document.body.append(d);d.showModal();d.onclick=e=>{if(e.target.value){d.close();d.remove();res(e.target.value==='y')}}})}
let me=null;
async function render(){me=me||await fetch('/api/me').then(r=>r.json());
 const h=location.hash.slice(1)||'/';const m=h.match(/^\/quiz\/(new|\d+)\/?(edit|results)?$/);
 app.innerHTML=`<nav class=nav><div class=wrap><b>مِضمار</b><a href="#/" data-p="/">الرئيسية</a><a href="#/quizzes" data-p="/quizzes">المسابقات</a><a href="#/quiz/new" data-p="/quiz/new">مسابقة جديدة</a><a href="#/settings" data-p="/settings">الإعدادات</a><span class=sp></span><span class="brand-mark" title="حقوق إنتريت" aria-label="حقوق إنتريت"><img src="/entrit-logo.svg" alt="إنتريت"></span></div></nav><main class=wrap id=main></main>`;
 document.querySelectorAll('.nav a[data-p]').forEach(a=>a.classList.toggle('on',a.dataset.p===h));
 const M=$('#main');try{if(h==='/')await home(M);else if(h==='/quizzes')await list(M);else if(h==='/settings')settings(M);
  else if(m&&m[1]==='new')editor(M,null);else if(m&&m[2]==='results')await results(M,m[1]);else if(m)await editor(M,m[1]);else M.textContent='الصفحة غير موجودة'}catch(e){if(e.message!=='401')M.innerHTML='<p class=err>'+esc(e.message)+'</p>'}}
addEventListener('hashchange',render);
const dur=s=>s>=60?`${Math.floor(s/60)}د ${s%60}ث`:s+'ث';
function chart(d){const W=Math.max(320,d.length*90),mx=Math.max(1,...d.map(x=>x.max));return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} 190" width="${W}" role=img aria-label="متوسط الدرجات لكل مسابقة">${d.map((x,i)=>{const h=Math.round(120*x.avg/mx),X=i*90+20;
 return `<rect x=${X} y=${140-h} width=50 height=${h} rx=6 fill="var(--g)"/><text x=${X+25} y=${134-h} text-anchor=middle fill="var(--ink)" font-size=13>${x.avg}/${x.max}</text><text x=${X+25} y=165 text-anchor=middle fill="var(--mut)" font-size=12>${esc(x.title.slice(0,10))}</text>`}).join('')}</svg></div>`}
async function home(M){const d=await api('/api/dashboard');M.innerHTML=`<h1>الرئيسية</h1><div class=grid>
 <div class="card stat"><b>${d.quizzes}</b><span>إجمالي المسابقات (${d.active} نشطة)</span></div><div class="card stat"><b>${d.groups}</b><span>إجمالي المجموعات المشاركة</span></div>
 <div class="card stat"><b>${d.avg}</b><span>متوسط الدرجات</span></div><div class="card stat"><b>${d.best?esc(d.best.name):'—'}</b><span>${d.best?`أعلى نتيجة: ${d.best.score}/${d.best.total} في «${esc(d.best.quiz)}»`:'لا توجد نتائج بعد'}</span></div></div>
 <div class=card style="margin-top:1em"><h2>متوسط الدرجات حسب المسابقة</h2>${d.chart.length?chart(d.chart):'<p>أنشئي مسابقة لتظهر هنا النتائج.</p>'}</div>
 <div class=card style="margin-top:1em"><h2>آخر المسابقات</h2>${d.recent.map(r=>`<p><a href="#/quiz/${r.id}/results">${esc(r.title)}</a> ${r.archived?'<span class=tag>مؤرشفة</span>':''}</p>`).join('')||'<p>لا توجد مسابقات بعد.</p>'}<a class="btn p" href="#/quiz/new">إنشاء مسابقة</a></div>`}
let tab='active';
async function list(M){const all=await api('/api/quizzes');const L=all.filter(z=>tab==='active'?!z.archived:z.archived);
 M.innerHTML=`<div class=row><h1 class=sp>المسابقات</h1><button class="btn ${tab==='active'?'p':''}" data-t=active>النشطة</button><button class="btn ${tab==='arch'?'p':''}" data-t=arch>السابقة (المؤرشفة)</button></div>
 ${L.map(z=>`<div class=card style="margin:.7em 0"><div class=row><div class=sp><h3 style="margin:0">${esc(z.title)}</h3><small style="color:var(--mut)">${z.nq} سؤال · ${z.ng} مجموعة · الرمز ${z.code}</small></div>
 <a class="btn p" target=_blank href="/board/${z.code}">ابدأ المسابقة</a><a class="btn s" href="#/quiz/${z.id}/results">النتائج</a><a class="btn s" href="#/quiz/${z.id}/edit">تعديل</a>
 <button class="btn s" data-a=copy data-id=${z.id}>نسخ</button><button class="btn s" data-a=arch data-id=${z.id}>${z.archived?'إلغاء الأرشفة':'أرشفة'}</button><button class="btn s d" data-a=del data-id=${z.id}>حذف</button></div></div>`).join('')||'<p>لا توجد مسابقات هنا.</p>'}`;
 M.onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.t){tab=b.dataset.t;return list(M)}const id=b.dataset.id,z=all.find(x=>x.id==id);
  if(b.dataset.a==='copy'){await api(`/api/quizzes/${id}/copy`,'POST');toast('تم النسخ');list(M)}
  if(b.dataset.a==='arch'){await api(`/api/quizzes/${id}/archive`,'POST');list(M)}
  if(b.dataset.a==='del'&&await confirmBox(`حذف «${z.title}» ونتائجها نهائيًا؟`)){await api('/api/quizzes/'+id,'DELETE');toast('تم الحذف');list(M)}
  if(b.dataset.a==='share')share(z)}}
function share(z){const url=`${location.origin}/j/${z.code}`,d=document.createElement('dialog');d.innerHTML=`<h3>${esc(z.title)}</h3><img alt="QR" src="/api/qr?text=${encodeURIComponent(url)}" width=220 height=220 style="display:block;margin:auto;background:#fff"><p>رمز الدخول: <b style="font-size:1.4em">${z.code}</b></p><input readonly value="${url}" onfocus=this.select()><div class=row style="margin-top:.7em"><button class="btn p" id=cp>نسخ الرابط</button><button class=btn id=cl>إغلاق</button></div>`;
 document.body.append(d);d.showModal();$('#cp',d).onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('تم النسخ'));$('#cl',d).onclick=()=>{d.close();d.remove()}}
async function settings(M){const d=await api('/api/me');M.innerHTML=`<h1>الإعدادات</h1><div class=card style="max-width:520px"><h2>حساب المعلمة</h2><p><b>البريد الإلكتروني:</b> ${esc(d.email||'—')}</p><p><b>طريقة الدخول:</b> ${d.provider==='google'?'Google':d.provider==='microsoft'?'Microsoft':'—'}</p><p style="color:var(--mut)">يتم تسجيل الدخول عبر مزوّد الحساب، ولا تُخزّن كلمة مرور Google أو Microsoft في مِضمار.</p></div>`}
const toMs=v=>v?new Date(v).getTime():null,fromMs=v=>v?new Date(v-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16):'';
const readImg=f=>new Promise((res,rej)=>{if(!f)return res('');if(f.size>1.5e6)return rej(Error('الصورة كبيرة (الحد 1.5 ميغابايت)'));const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)});
async function editor(M,id){const z=id?await api('/api/quizzes/'+id):{title:'',description:'',image:'',time_limit:0,shuffle_q:0,shuffle_a:0,show_correct:1,allow_retry:0,start_at:null,end_at:null,questions:[],ng:0};
 const locked=id&&(await api('/api/quizzes')).find(x=>x.id==id).ng>0;let Q=z.questions.map(x=>({...x}));
 const ck=(k,t)=>`<label style="display:flex;gap:.5em;align-items:center;font-weight:400"><input type=checkbox id=${k} style="width:auto" ${z[k]?'checked':''}>${t}</label>`;
 M.innerHTML=`<h1>${id?'تعديل المسابقة':'مسابقة جديدة'}</h1><div class=card><label>اسم المسابقة</label><input id=title value="${esc(z.title)}"><label>الوصف / التعليمات</label><textarea id=desc rows=3>${esc(z.description)}</textarea>
 <label>صورة (اختيارية)</label><input type=file id=img accept="image/*"><div class=grid><div><label>مدة المسابقة بالدقائق (0 = بلا حد)</label><input type=number min=0 id=tl value=${z.time_limit}></div><div><label>موعد البدء</label><input type=datetime-local id=sa value="${fromMs(z.start_at)}"></div><div><label>موعد الإغلاق</label><input type=datetime-local id=ea value="${fromMs(z.end_at)}"></div></div>
 ${ck('shuffle_q','ترتيب الأسئلة عشوائي')}${ck('shuffle_a','ترتيب الإجابات عشوائي')}${ck('show_correct','إظهار الإجابة الصحيحة بعد كل سؤال')}${ck('allow_retry','السماح بإعادة المحاولة')}</div>
 <h2>الأسئلة (${locked?'مقفلة: بدأت مجموعات اللعب':'اسحبي ⠿ لإعادة الترتيب'})</h2><div id=qs></div>${locked?'':'<div class=row><button class="btn" id=addmc>+ اختيار من متعدد</button><button class="btn" id=addtf>+ صح أو خطأ</button></div>'}
 <p class=err id=e></p><button class="btn p" id=save>حفظ المسابقة</button>`;
 const draw=()=>{const box=$('#qs');box.innerHTML=Q.map((q,i)=>`<div class=q data-i=${i} ${locked?'':'draggable=true'}><div class=row><span class=handle>⠿</span><b>سؤال ${i+1} · ${q.type==='tf'?'صح أو خطأ':'اختيار من متعدد'}</b><span class=sp></span><label style="margin:0;font-weight:400">الدرجة <input type=number min=1 style="width:5em" data-f=points value=${q.points}></label>${locked?'':'<button class="btn s d" data-del>حذف</button>'}</div>
  <label>نص السؤال</label><textarea rows=2 data-f=text>${esc(q.text)}</textarea><label>صورة السؤال (اختيارية)</label><input type=file accept="image/*" data-img>${q.image?`<img src="${q.image}" height=60 alt=""> <button class="btn s" data-noimg>إزالة</button>`:''}
  <label>الخيارات (حددي الصحيح)</label>${(q.type==='tf'?['صح','خطأ']:q.options).map((o,j)=>`<div class=opt><input type=radio name=c${i} data-c=${j} ${q.correct===j?'checked':''}>${q.type==='tf'?`<b>${o}</b>`:`<input data-o=${j} value="${esc(o)}" placeholder="الخيار ${j+1}"><button class="btn s" data-rm=${j} ${q.options.length<=2?'disabled':''}>×</button>`}</div>`).join('')}
  ${q.type==='mc'&&q.options.length<6&&!locked?'<button class="btn s" data-addo>+ خيار</button>':''}</div>`).join('')||'<p>أضيفي أول سؤال.</p>';
  if(locked)box.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true)};draw();
 const box=$('#qs');box.oninput=e=>{const q=Q[e.target.closest('.q').dataset.i],t=e.target;if(t.dataset.f)q[t.dataset.f]=t.dataset.f==='points'?+t.value:t.value;if(t.dataset.o!==undefined)q.options[+t.dataset.o]=t.value};
 box.onchange=async e=>{const q=Q[e.target.closest('.q').dataset.i],t=e.target;if(t.dataset.c!==undefined)q.correct=+t.dataset.c;if(t.dataset.img!==undefined){try{q.image=await readImg(t.files[0]);draw()}catch(x){toast(x.message)}}};
 box.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=+b.closest('.q').dataset.i,q=Q[i];if('del'in b.dataset){Q.splice(i,1)}else if('noimg'in b.dataset)q.image='';else if('addo'in b.dataset)q.options.push('');else if(b.dataset.rm){q.options.splice(+b.dataset.rm,1);if(q.correct>=q.options.length)q.correct=null}else return;draw()};
 let from=null;box.ondragstart=e=>{from=+e.target.closest('.q')?.dataset.i};box.ondragover=e=>{e.preventDefault();box.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));e.target.closest('.q')?.classList.add('over')};
 box.ondrop=e=>{e.preventDefault();const to=+e.target.closest('.q')?.dataset.i;if(from!==null&&!isNaN(to)&&from!==to){Q.splice(to,0,Q.splice(from,1)[0]);draw()}from=null};
 if(!locked){$('#addmc').onclick=()=>{Q.push({type:'mc',text:'',image:'',points:1,options:['','','',''],correct:null});draw()};$('#addtf').onclick=()=>{Q.push({type:'tf',text:'',image:'',points:1,options:['صح','خطأ'],correct:null});draw()}}
 $('#img').onchange=async e=>{try{z.image=await readImg(e.target.files[0])}catch(x){toast(x.message)}};
 $('#save').onclick=async()=>{const body={title:$('#title').value,description:$('#desc').value,image:z.image,time_limit:$('#tl').value,start_at:toMs($('#sa').value),end_at:toMs($('#ea').value),
  shuffle_q:$('#shuffle_q').checked,shuffle_a:$('#shuffle_a').checked,show_correct:$('#show_correct').checked,allow_retry:$('#allow_retry').checked,questions:Q};
  try{if(id)await api('/api/quizzes/'+id,'PUT',body);else{if(!Q.length)throw Error('أضيفي سؤالًا واحدًا على الأقل');await api('/api/quizzes','POST',body)}toast('تم الحفظ');location.hash='#/quizzes'}catch(x){$('#e').textContent=x.message}}}
async function results(M,id){const r=await api(`/api/quizzes/${id}/results`),z=r.quiz;
 M.innerHTML=`<div class=row><h1 class=sp>نتائج: ${esc(z.title)}</h1><a class="btn p" target=_blank href="/board/${z.code}">ابدأ المسابقة</a><a class="btn p" href="/api/quizzes/${id}/export.csv">تصدير CSV</a></div>
 <div class=row><button class=btn id=hide>إخفاء النتائج عن الشاشة</button><button class=btn id=show>إظهار النتائج</button></div>
 <div class=grid style="margin:1em 0"><div class="card stat"><b>${r.rows.length}</b><span>مجموعة</span></div><div class="card stat"><b>${r.avg}/${r.totalPoints}</b><span>متوسط الدرجات</span></div>
 <div class="card stat"><b>${r.hardest?esc(r.hardest.text.slice(0,30)):'—'}</b><span>أصعب سؤال${r.hardest?` (${r.hardest.pct}% صحيح)`:''}</span></div><div class="card stat"><b>${r.easiest?esc(r.easiest.text.slice(0,30)):'—'}</b><span>أسهل سؤال${r.easiest?` (${r.easiest.pct}% صحيح)`:''}</span></div></div>
 <div class=card style="overflow-x:auto"><h2>ترتيب المجموعات</h2><table><tr><th>المركز<th>المجموعة<th>الدرجة<th>صحيحة<th>خاطئة<th>النسبة<th>الوقت<th>الحالة<th></tr>${r.rows.map(x=>`<tr><td>${x.rank}${x.tie?' <span class=tag>تعادل</span>':''}<td>${esc(x.name)}<td>${x.score}/${r.totalPoints}<td>${x.correct}<td>${x.answered-x.correct}<td>${x.answered?Math.round(100*x.correct/x.answered):0}%<td>${dur(x.duration)}<td>${x.done?'أنهت':'تلعب'}<td><button class="btn s d" data-g=${x.id}>حذف</button></tr>`).join('')||'<tr><td colspan=9>لا توجد مجموعات بعد</tr>'}</table></div>
 <div class=card style="margin-top:1em;overflow-x:auto"><h2>تحليل الأسئلة</h2><table><tr><th>السؤال<th>صحيحة<th>خاطئة<th>نسبة الصحة</tr>${r.questions.map(x=>`<tr><td>${esc(x.text.slice(0,60))}${r.mostMissed.some(m=>m.id===x.id)?' <span class=tag>أخطأت فيه معظم المجموعات</span>':''}<td>${x.correct}<td>${x.wrong}<td>${x.pct===null?'—':x.pct+'%'}</tr>`).join('')}</table></div>`;
 const st=s=>async()=>{await api(`/api/quizzes/${id}/board`,'POST',{state:s});toast(s==='hidden'?'أُخفيت النتائج':'أُظهرت النتائج')};$('#hide').onclick=st('hidden');$('#show').onclick=st('shown');
 M.onclick=async e=>{const b=e.target.closest('[data-g]');if(b&&await confirmBox('حذف هذه المجموعة ونتائجها؟')){await api('/api/groups/'+b.dataset.g,'DELETE');results(M,id)}}}
render();
