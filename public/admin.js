const $=(s,r=document)=>r.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(u,m='GET',b){const r=await fetch(u,{method:m,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'حدث خطأ');return j}
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2500)}
function confirmBox(msg){return new Promise(res=>{const d=document.createElement('dialog');d.innerHTML=`<p>${esc(msg)}</p><div class=row><button class="btn d" value=y>نعم، تأكيد</button><button class=btn value=n>إلغاء</button></div>`;
 document.body.append(d);d.showModal();d.onclick=e=>{if(e.target.value){d.close();d.remove();res(e.target.value==='y')}}})}
let me=null;

const THEME_KEY='midmar-theme';
const storedTheme=()=>localStorage.getItem(THEME_KEY);
let currentTheme=storedTheme()|| (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
function applyTheme(theme,save=true){
 currentTheme=theme==='dark'?'dark':'light';
 document.documentElement.dataset.theme=currentTheme;
 if(save)localStorage.setItem(THEME_KEY,currentTheme);
 const btn=$('#themeToggle');
 if(btn){btn.innerHTML=currentTheme==='dark'?'<span aria-hidden="true">☀</span><span>الوضع الساطع</span>':'<span aria-hidden="true">☾</span><span>الوضع المظلم</span>';btn.setAttribute('aria-label',currentTheme==='dark'?'التبديل إلى الوضع الساطع':'التبديل إلى الوضع المظلم');btn.title=btn.getAttribute('aria-label')}
 document.querySelectorAll('[data-theme-choice]').forEach(x=>x.classList.toggle('p',x.dataset.themeChoice===currentTheme));
 const status=$('#themeModeStatus');if(status)status.textContent=currentTheme==='dark'?'الوضع المظلم مفعّل':'الوضع الساطع مفعّل';
}
function toggleTheme(){applyTheme(currentTheme==='dark'?'light':'dark')}
applyTheme(currentTheme,false);

function studentAccessScreen(root){
 root.innerHTML=`<main class="student-entry-wrap"><section class="card student-entry-card"><img class=student-entry-logo src="/midmar-logo.webp" alt="شعار مِضمار"><span class=eyebrow>منصة المسابقات التفاعلية</span><h1>دخول الطالب</h1><p>أدخل رمز المسابقة الذي شاركه المعلم للانضمام مباشرة.</p><form id=studentEnterForm><label for=studentCode>رمز المسابقة</label><input id=studentCode inputmode=numeric autocomplete=one-time-code maxlength=6 pattern="[0-9]{6}" placeholder="مثال: 123456" required><p class=err id=studentEntryError></p><button class="btn p" type=submit>متابعة إلى المسابقة</button></form><small>لا يحتاج الطالب إلى حساب Google؛ يكفي رمز المسابقة.</small><a class=student-back href="/">العودة إلى اختيار نوع الدخول</a></section></main>`;
 const form=$('#studentEnterForm',root),codeInput=$('#studentCode',root);
 codeInput.addEventListener('input',()=>{codeInput.value=codeInput.value.replace(/[^0-9]/g,'').slice(0,6)});
 form.onsubmit=e=>{e.preventDefault();const code=codeInput.value.trim();if(!/^\\d{6}$/.test(code)){$('#studentEntryError',root).textContent='أدخل رمزًا مكوّنًا من 6 أرقام.';return}location.href='/j/'+code};
}
async function loginScreen(){
 const error=new URLSearchParams(location.search).get('auth_error');
 const message=error==='not_configured'?'تسجيل Google غير مهيأ في إعدادات الخادم.':error?'تعذر تسجيل الدخول عبر Google. حاول مرة أخرى.':'';
 app.innerHTML=`<main class=role-login-wrap><header class=role-brand><img src="/midmar-logo.webp" alt="شعار مِضمار"><p>مسابقات تفاعلية... بطريقة أمتع</p></header>${message?`<p class="err auth-error">${esc(message)}</p>`:''}<h1>كيف تريد الدخول إلى مِضمار؟</h1><p class=role-subtitle>اختر نوع الدخول للمتابعة إلى المساحة المناسبة.</p><div class=role-login-grid>
 <section class="card role-login-card teacher-login-card"><div class=role-icon>♙</div><span class=eyebrow>إدارة وتعليم</span><h2>أنا معلم</h2><p>أنشئ المسابقات، وأدر الأسئلة والمشاركين، وتابع النتائج والإحصائيات.</p><a class="btn p" href="/auth/google"><span aria-hidden=true>G</span> المتابعة بحساب Google</a><small>دخول آمن إلى لوحة المعلم.</small></section>
 <section class="card role-login-card student-login-card"><div class=role-icon>▤</div><span class=eyebrow>مشاركة وتحدٍّ</span><h2>أنا طالب</h2><p>انضم إلى مسابقة المعلم باستخدام رمز الدخول، دون إنشاء حساب.</p><form id=studentLoginForm><label for=studentLoginCode>رمز المسابقة</label><input id=studentLoginCode inputmode=numeric maxlength=6 pattern="[0-9]{6}" placeholder="أدخل الرمز المكوّن من 6 أرقام" required><p class=err id=studentLoginError></p><button class="btn p" type=submit>دخول الطالب</button></form><small>يظهر لك الاختبار فور إدخال الرمز الصحيح.</small></section>
 </div><footer class=role-login-footer>مِضمار · بيئة تعليمية تفاعلية</footer></main>`;
 const codeInput=$('#studentLoginCode'),form=$('#studentLoginForm');
 codeInput.addEventListener('input',()=>{codeInput.value=codeInput.value.replace(/[^0-9]/g,'').slice(0,6)});
 form.onsubmit=e=>{e.preventDefault();const code=codeInput.value.trim();if(!/^\\d{6}$/.test(code)){$('#studentLoginError').textContent='أدخل رمزًا مكوّنًا من 6 أرقام.';return}location.href='/j/'+code};
}
let onboardingState=null;
const tourSteps=[
 {title:'الرئيسية',text:'هنا تتابع عدد مسابقاتك والمجموعات المشاركة ومتوسط الدرجات وأعلى نتيجة.'},
 {title:'المسابقات',text:'من صفحة المسابقات تدير اختباراتك، وتفتح النتائج، وتعدّل المسابقة أو تنسخها أو تؤرشفها.'},
 {title:'إنشاء مسابقة',text:'أنشئ مسابقة جديدة، أضف الأسئلة والخيارات وحدد الإجابة الصحيحة والوقت وطريقة المشاركة.'},
 {title:'لوحة العرض ورمز الدخول',text:'ابدأ المسابقة وافتح لوحة العرض. شارك رمز الدخول أو رمز QR مع الطلاب للانضمام.'},
 {title:'النتائج والتقارير',text:'تابع ترتيب المجموعات والدرجات والإحصاءات، ويمكنك تصدير النتائج عند توفرها.'},
 {title:'الإعدادات',text:'راجع الحساب، ويمكنك الرجوع إلى هذا الشرح لاحقًا من صفحة الإعدادات.'}
];
async function finishOnboarding(){await api('/api/onboarding/complete','POST');onboardingState={version:2,showTutorial:false,showUpdateNotice:false}}
function showTour(){
 let i=0;const d=document.createElement('dialog');d.className='brand-dialog';
 const draw=()=>{const x=tourSteps[i];d.innerHTML=`<div class="brand-card" style="display:block"><small>دليل مِضمار · ${i+1} من ${tourSteps.length}</small><h2>${esc(x.title)}</h2><p>${esc(x.text)}</p><div class="row"><button class="btn" id="tourSkip">تخطي الشرح</button><span class="sp"></span><button class="btn p" id="tourNext">${i===tourSteps.length-1?'إنهاء':'التالي'}</button></div></div>`;
 $('#tourSkip',d).onclick=async()=>{await finishOnboarding();d.close();d.remove()};
 $('#tourNext',d).onclick=async()=>{if(i<tourSteps.length-1){i++;draw()}else{await finishOnboarding();d.close();d.remove();toast('اكتمل الشرح')}}};
 document.body.append(d);draw();d.showModal();
}
async function onboarding(){
 onboardingState=await api('/api/onboarding');
 if(onboardingState.showTutorial){showTour();return}
 if(onboardingState.showUpdateNotice){
  const d=document.createElement('dialog');d.className='brand-dialog';
  d.innerHTML='<div class="brand-card" style="display:block"><small>مِضمار 2.0</small><h2>تم تحديث مِضمار</h2><p>أضفنا دليلًا تفاعليًا يشرح أقسام الموقع وطريقة إنشاء المسابقات ومتابعة النتائج. يمكنك بدء الشرح الآن أو تشغيله لاحقًا من الإعدادات.</p><div class="row"><button class="btn" id="updateLater">لاحقًا</button><span class="sp"></span><button class="btn p" id="updateStart">ابدأ الشرح</button></div></div>';
  document.body.append(d);d.showModal();
  $('#updateLater',d).onclick=async()=>{await finishOnboarding();d.close();d.remove()};
  $('#updateStart',d).onclick=()=>{d.close();d.remove();showTour()};
 }
}
async function render(){
 const h=location.hash.slice(1)||'/';
 if(h==='/student'){studentAccessScreen(app);return}
 me=await fetch('/api/me').then(r=>r.json()).catch(()=>({authenticated:false}));
 if(!me.authenticated){await loginScreen();return}
 const m=h.match(/^\/quiz\/(new|\d+)\/?(edit|results)?$/);
 app.innerHTML=`<nav class=nav><div class=wrap><div class=nav-brand><img class=nav-brand-logo src="/midmar-logo.webp" alt="مِضمار"><div><strong>مِضمار</strong><small>منصة المسابقات التفاعلية</small></div></div><a href="#/" data-p="/">الرئيسية</a><a href="#/quizzes" data-p="/quizzes">المسابقات</a><a href="#/settings" data-p="/settings">الإعدادات</a><a href="#/student" data-p="/student">دخول الطلاب</a><a class=nav-create href="#/quiz/new" data-p="/quiz/new">+ إنشاء مسابقة</a><div class=nav-account><span class=nav-avatar>م</span><small>${esc(me.email||"حساب المعلم")}</small></div><span class=sp></span><button class="btn theme-toggle" id="themeToggle" type="button"></button><button class="btn nav-logout" id="logoutBtn" type="button">تسجيل الخروج</button><button class="brand-mark" id="brandOpen" type="button" aria-label="عرض بطاقة التطوير" aria-haspopup="dialog" aria-controls="brandDialog"><span aria-hidden="true">©</span></button><dialog class="brand-dialog" id="brandDialog" aria-labelledby="brandTitle"><div class="brand-card"><img src="/midmar-logo.webp" alt="شعار مِضمار"><div class="brand-copy"><strong id="brandTitle">تطوير أنتريت</strong><span>تم تطوير مِضمار بواسطة أنتريت</span><small id="brandVersion">إصدار الموقع 1.0.0</small></div></div><button class="btn brand-close" id="brandClose" type="button">إغلاق</button></dialog></div></nav><main class=wrap id=main></main>`;
 applyTheme(currentTheme,false);
 $('#themeToggle').onclick=toggleTheme;
 fetch('/api/version').then(r=>r.json()).then(v=>{const el=$('#brandVersion');if(el)el.textContent='إصدار الموقع '+v.version}).catch(()=>{});
 $('#logoutBtn').onclick=async()=>{await api('/api/logout','POST');me=null;location.hash='/';render()};
 document.querySelectorAll('.nav a[data-p]').forEach(a=>a.classList.toggle('on',a.dataset.p===h));
 const brandDialog=$('#brandDialog');$('#brandOpen').onclick=()=>brandDialog.showModal();$('#brandClose').onclick=()=>brandDialog.close();brandDialog.onclick=e=>{if(e.target===brandDialog)brandDialog.close()};
 const M=$('#main');try{await onboarding();if(h==='/')await home(M);else if(h==='/quizzes')await list(M);else if(h==='/settings')settings(M);else if(h==='/student')studentAccessScreen(M);
  else if(m&&m[1]==='new')editor(M,null);else if(m&&m[2]==='results')await results(M,m[1]);else if(m)await editor(M,m[1]);else M.textContent='الصفحة غير موجودة'}catch(e){if(e.message!=='401')M.innerHTML='<p class=err>'+esc(e.message)+'</p>'}}
addEventListener('hashchange',render);
const dur=s=>s>=60?`${Math.floor(s/60)}د ${s%60}ث`:s+'ث';
function chart(d){const W=Math.max(320,d.length*90),mx=Math.max(1,...d.map(x=>x.max));return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} 190" width="${W}" role=img aria-label="متوسط الدرجات لكل مسابقة">${d.map((x,i)=>{const h=Math.round(120*x.avg/mx),X=i*90+20;
 return `<rect x=${X} y=${140-h} width=50 height=${h} rx=6 fill="var(--g)"/><text x=${X+25} y=${134-h} text-anchor=middle fill="var(--ink)" font-size=13>${x.avg}/${x.max}</text><text x=${X+25} y=165 text-anchor=middle fill="var(--mut)" font-size=12>${esc(x.title.slice(0,10))}</text>`}).join('')}</svg></div>`}
async function home(M){const d=await api('/api/dashboard');M.innerHTML=`<header class=page-head><div><span class=eyebrow>لوحة المعلم</span><h1>مرحبًا بك في مِضمار</h1><p>أنشئ مسابقاتك، وأدر المشاركين، وتابع النتائج من مكان واحد.</p></div><a class="btn p page-head-action" href="#/quiz/new">+ إنشاء مسابقة جديدة</a></header><div class=grid>
 <div class="card stat"><b>${d.quizzes}</b><span>إجمالي المسابقات (${d.active} نشطة)</span></div><div class="card stat"><b>${d.groups}</b><span>إجمالي المجموعات المشاركة</span></div>
 <div class="card stat"><b>${d.avg}</b><span>متوسط الدرجات</span></div><div class="card stat"><b>${d.best?esc(d.best.name):'—'}</b><span>${d.best?`أعلى نتيجة: ${d.best.score}/${d.best.total} في «${esc(d.best.quiz)}»`:'لا توجد نتائج بعد'}</span></div></div>
 <div class=card style="margin-top:1em"><h2>متوسط الدرجات حسب المسابقة</h2>${d.chart.length?chart(d.chart):'<p>أنشئي مسابقة لتظهر هنا النتائج.</p>'}</div>
 <div class=card style="margin-top:1em"><h2>آخر المسابقات</h2>${d.recent.map(r=>`<p><a href="#/quiz/${r.id}/results">${esc(r.title)}</a> ${r.archived?'<span class=tag>مؤرشفة</span>':''}</p>`).join('')||'<p>لا توجد مسابقات بعد.</p>'}</div>`}
let tab='active';
async function list(M){
 const all=await api('/api/quizzes');
 const L=all.filter(z=>tab==='active'?!z.archived:z.archived);
 let search='';
 M.innerHTML=`<div class=library-head><div><span class=eyebrow>إدارة المحتوى</span><h1>مكتبة المسابقات</h1><p>كل اختباراتك ومسابقاتك في مكان واحد.</p></div><a class="btn p" href="#/quiz/new">+ إنشاء مسابقة</a></div>
 <section class=library-toolbar><div class=library-tabs><button class="btn ${tab==='active'?'p':''}" data-t=active>النشطة <span>${all.filter(z=>!z.archived).length}</span></button><button class="btn ${tab==='arch'?'p':''}" data-t=arch>الأرشيف <span>${all.filter(z=>z.archived).length}</span></button></div><div class=library-search><span aria-hidden=true>⌕</span><input id=quizSearch type=search placeholder="ابحث باسم المسابقة أو رمزها..." autocomplete=off></div></section>
 <div class=library-summary><strong id=libraryCount>${L.length}</strong><span>مسابقة في هذا القسم</span></div>
 <div id=quizGrid class=quiz-grid></div>`;
 const grid=$('#quizGrid',M),count=$('#libraryCount',M);
 const draw=()=>{
  const q=search.trim().toLocaleLowerCase('ar');
  const rows=L.filter(z=>String(z.title||'').toLocaleLowerCase('ar').includes(q)||String(z.code||'').includes(q));
  count.textContent=rows.length;
  grid.innerHTML=rows.map(z=>`<article class=card quiz-card><div class=quiz-card-top><div class=quiz-card-icon>${z.archived?'▣':'✦'}</div><div class=quiz-card-title><h3>${esc(z.title)}</h3><span class=quiz-status ${z.archived?'data-archived':''}>${z.archived?'مؤرشفة':'نشطة'}</span></div><div class=quiz-code><small>رمز الدخول</small><strong>${z.code}</strong></div></div><div class=quiz-facts><span><b>${z.nq}</b> سؤال</span><i></i><span><b>${z.ng}</b> مشارك</span></div><div class=quiz-actions><a class="btn p" target=_blank rel=noopener href="/board/${z.code}">لوحة المسابقة</a><a class="btn" href="#/quiz/${z.id}/results">النتائج</a><a class="btn" href="#/quiz/${z.id}/edit">تعديل</a><button class="btn" data-a=copy data-id=${z.id}>نسخ</button><button class="btn" data-a=arch data-id=${z.id}>${z.archived?'استعادة':'أرشفة'}</button><button class="btn d" data-a=del data-id=${z.id}>حذف</button></div></article>`).join('')||`<div class=library-empty><div>⌕</div><h3>${q?'لا توجد نتائج مطابقة':'لا توجد مسابقات هنا'}</h3><p>${q?'جرّب البحث باسم مختلف أو رمز الدخول.':'أنشئ أول مسابقة لتظهر هنا.'}</p>${q?'':'<a class="btn p" href="#/quiz/new">إنشاء مسابقة</a>'}</div>`;
 };
 draw();
 $('#quizSearch',M).oninput=e=>{search=e.target.value;draw()};
 M.onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.t){tab=b.dataset.t;return list(M)}
  const id=b.dataset.id,z=all.find(x=>x.id==id);
  try{
   if(b.dataset.a==='copy'){await api(`/api/quizzes/${id}/copy`,'POST');toast('تم نسخ المسابقة');return list(M)}
   if(b.dataset.a==='arch'){await api(`/api/quizzes/${id}/archive`,'POST');toast(z.archived?'تمت استعادة المسابقة':'تمت أرشفة المسابقة');return list(M)}
   if(b.dataset.a==='del'&&await confirmBox(`حذف «${z.title}» ونتائجها نهائيًا؟`)){await api('/api/quizzes/'+id,'DELETE');toast('تم الحذف');return list(M)}
  }catch(err){toast(err.message)}
 };
}
function share(z){const url=`${location.origin}/j/${z.code}`,d=document.createElement('dialog');d.innerHTML=`<h3>${esc(z.title)}</h3><img alt="QR" src="/api/qr?text=${encodeURIComponent(url)}" width=220 height=220 style="display:block;margin:auto;background:#fff"><p>رمز الدخول: <b style="font-size:1.4em">${z.code}</b></p><input readonly value="${url}" onfocus=this.select()><div class=row style="margin-top:.7em"><button class="btn p" id=cp>نسخ الرابط</button><button class=btn id=cl>إغلاق</button></div>`;
 document.body.append(d);d.showModal();$('#cp',d).onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('تم النسخ'));$('#cl',d).onclick=()=>{d.close();d.remove()}}
async function settings(M){
 const d=await api('/api/me');
 M.innerHTML=`<div class=section-heading><span class=eyebrow>التفضيلات والحساب</span><h1>الإعدادات</h1><p>تحكم في مظهر مِضمار وتفاصيل حسابك.</p></div>
 <div class=settings-grid>
  <section class=card settings-card><div class=settings-icon>◐</div><div><h2>مظهر الموقع</h2><p>اختر الألوان المناسبة لك. يُحفظ اختيارك على هذا الجهاز ويُطبّق على صفحات المعلم والطالب ولوحة العرض.</p></div>
   <div class=theme-choices><button class="btn" data-theme-choice=light type=button>☀ الوضع الساطع</button><button class="btn" data-theme-choice=dark type=button>☾ الوضع المظلم</button></div><small id=themeModeStatus class=settings-hint></small>
  </section>
  <section class=card settings-card><div class=settings-icon>◎</div><div><h2>حسابك</h2><p><b>البريد الإلكتروني:</b> ${esc(d.email||'—')}</p><p><b>طريقة الدخول:</b> Google</p><small class=settings-hint>تُحفظ مسابقاتك ضمن مساحة حسابك الخاصة.</small></div></section>
  <section class=card settings-card><div class=settings-icon>?</div><div><h2>المساعدة</h2><p>يمكنك إعادة مشاهدة شرح أقسام الموقع وطريقة إنشاء المسابقات ومتابعة النتائج.</p><button class="btn p" id=replayTour>إعادة شرح الموقع</button></div></section>
 </div>`;
 applyTheme(currentTheme,false);
 document.querySelectorAll('[data-theme-choice]').forEach(x=>x.onclick=()=>applyTheme(x.dataset.themeChoice));
 $('#replayTour').onclick=showTour;
}
const toMs=v=>v?new Date(v).getTime():null,fromMs=v=>v?new Date(v-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16):'';
const readImg=f=>new Promise((res,rej)=>{
 if(!f)return res('');
 if(f.size>1.5e6)return rej(Error('الصورة كبيرة (الحد 1.5 ميغابايت)'));
 const reader=new FileReader();
 reader.onerror=()=>rej(Error('تعذرت قراءة الصورة.'));
 reader.onload=()=>{
  const image=new Image();
  image.onerror=()=>rej(Error('صيغة الصورة غير مدعومة.'));
  image.onload=()=>{
   const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)return rej(Error('تعذر تجهيز الصورة للتحليل.'));
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/png');
   if(data.length>2900000)return rej(Error('الصورة الناتجة كبيرة. قصّ الورقة أو صغّرها ثم أعد المحاولة.'));
   res(data);
  };
  image.src=String(reader.result||'');
 };
 reader.readAsDataURL(f);
});
async function editor(M,id){
 const z=id?await api('/api/quizzes/'+id):{title:'',description:'',image:'',time_limit:0,shuffle_q:0,shuffle_a:0,show_correct:1,allow_retry:0,start_at:null,end_at:null,participation_mode:'groups',entry_mode:'both',progression_mode:'sequential',roster:'',questions:[],ng:0};
 const locked=id&&(await api('/api/quizzes')).find(x=>x.id==id).ng>0;let Q=z.questions.map(x=>({...x})),step=0;
 const ck=(k,t)=>`<label style="display:flex;gap:.5em;align-items:center;font-weight:400"><input type=checkbox id=${k} style="width:auto" ${z[k]?'checked':''}>${t}</label>`;
 M.innerHTML=`<div class=row><h1 class=sp>${id?'تعديل المسابقة':'إنشاء مسابقة جديدة'}</h1><a class=btn href="#/quizzes">رجوع</a></div><div class=card>
 <div class=row id=steps><span class=tag>1 · بيانات المسابقة</span><span class=tag>2 · المشاركة</span><span class=tag>3 · الأسئلة</span></div>
 <section data-step=0><h2>بيانات المسابقة</h2><label>اسم المسابقة</label><input id=title value="${esc(z.title)}"><label>الوصف / التعليمات</label><textarea id=desc rows=3>${esc(z.description)}</textarea>
 <label>صورة المسابقة</label><input type=file id=img accept="image/*"><div id=coverPreview>${z.image?`<img src="${z.image}" style="max-height:100px">`:''}</div>
 <div class=grid><div><label>المدة بالدقائق (0 بلا حد)</label><input type=number min=0 id=tl value=${z.time_limit}></div><div><label>موعد البدء</label><input type=datetime-local id=sa value="${fromMs(z.start_at)}"></div><div><label>موعد الإغلاق</label><input type=datetime-local id=ea value="${fromMs(z.end_at)}"></div></div>
 <hr><h3>إعدادات عرض الأسئلة</h3>${ck('shuffle_q','ترتيب الأسئلة عشوائي')}${ck('shuffle_a','ترتيب الإجابات عشوائي')}${ck('show_correct','إظهار الإجابة الصحيحة')}${ck('allow_retry','السماح بإعادة المحاولة')}</section>
 <section data-step=1 hidden><h2>طريقة المشاركة</h2><label>نوع المشاركة</label><select id=participation_mode><option value=groups ${z.participation_mode!=='students'?'selected':''}>مجموعات – جهاز لكل مجموعة</option><option value=students ${z.participation_mode==='students'?'selected':''}>طلاب – كل طالب بجهازه</option></select>
 <label>طريقة التسجيل</label><select id=entry_mode><option value=both ${!z.entry_mode||z.entry_mode==='both'?'selected':''}>قائمة المعلم أو تسجيل ذاتي</option><option value=qr ${z.entry_mode==='qr'?'selected':''}>QR أو الرابط</option><option value=roster ${z.entry_mode==='roster'?'selected':''}>قائمة المعلم فقط</option></select>
 <label>أسماء الطلاب (اسم في كل سطر)</label><textarea id=roster rows=5>${esc(z.roster||'')}</textarea>
 <label>طريقة الانتقال بين الأسئلة</label><select id=progression_mode><option value=sequential ${!z.progression_mode||z.progression_mode==='sequential'?'selected':''}>تسلسلي</option><option value=free ${z.progression_mode==='free'?'selected':''}>حر</option><option value=teacher ${z.progression_mode==='teacher'?'selected':''}>تحكم المعلم</option></select></section>
 <section data-step=2 hidden><h2>الأسئلة</h2><div class="card ai-sheet-card"><div class=row><h3 class=sp>إنشاء الأسئلة من صورة</h3><span class=ai-status-pill id=aiServiceStatus>التحقق من خدمة الذكاء الاصطناعي...</span></div><p>ارفع صورة ورقة الأسئلة، وسيستخرج مِضمار الأسئلة والخيارات لتراجعها قبل إضافتها.</p><input type=file id=sheet accept="image/png,image/jpeg,image/webp"><button class=btn id=readSheet type=button>قراءة الورقة بالذكاء الاصطناعي</button><small id=aiStatus>الصيغ المدعومة: PNG وJPG وWebP، بحد أقصى 1.5 ميغابايت.</small></div>
 <div id=qs></div>${locked?'':'<div class=row><button class=btn id=addmc>+ اختيار متعدد</button><button class=btn id=addtf>+ صح أو خطأ</button><button class=btn id=addorder>+ رتّب العناصر</button></div>'}</section>
 <p class=err id=e></p><div class=row style="justify-content:space-between;margin-top:1em"><button class=btn id=prev hidden>السابق</button><span class=sp></span><button class="btn p" id=next>التالي</button><button class="btn p" id=save hidden>إنشاء المسابقة</button></div></div>`;
 const show=()=>{M.querySelectorAll('[data-step]').forEach(x=>x.hidden=+x.dataset.step!==step);M.querySelectorAll('#steps .tag').forEach((x,i)=>x.style.opacity=i===step?'1':'.45');$('#prev').hidden=step===0;$('#next').hidden=step===2;$('#save').hidden=step!==2};show();
 const draw=()=>{$('#qs').innerHTML=Q.map((q,i)=>`<div class=q data-i=${i}><div class=row><b>سؤال ${i+1} · ${q.type==='tf'?'صح أو خطأ':q.type==='order'?'رتّب العناصر':'اختيار متعدد'}</b><span class=sp></span><label>الدرجة <input type=number min=1 data-f=points value=${q.points} style="width:4em"></label>${locked?'':'<button class="btn s d" data-del>حذف</button>'}</div><label>نص السؤال</label><textarea data-f=text>${esc(q.text)}</textarea><label>${q.type==='order'?'العناصر بالترتيب الصحيح':'الخيارات'}</label>${(q.type==='tf'?['صح','خطأ']:q.options).map((o,j)=>`<div class=opt>${q.type==='order'?`<b>${j+1}.</b>`:'<input type=radio name=c'+i+' data-c='+j+(q.correct===j?' checked':'')+'>'}<input data-o=${j} value="${esc(o)}" placeholder="عنصر ${j+1}"><button class="btn s" data-rm=${j} ${q.options.length<=2?'disabled':''}>×</button></div>`).join('')}${q.type!=='tf'&&q.options.length<6&&!locked?'<button class=btn data-addo>+ خيار</button>':''}</div>`).join('')||'<p>أضف سؤالًا من الأزرار.</p>';};
 draw();const box=$('#qs');
 box.oninput=e=>{const el=e.target.closest('.q');if(!el)return;const q=Q[+el.dataset.i],t=e.target;if(t.dataset.f)q[t.dataset.f]=t.dataset.f==='points'?+t.value:t.value;if(t.dataset.o!==undefined)q.options[+t.dataset.o]=t.value};
 box.onchange=async e=>{const el=e.target.closest('.q');if(el&&e.target.dataset.c!==undefined)Q[+el.dataset.i].correct=+e.target.dataset.c};
 box.onclick=e=>{const b=e.target.closest('button'),el=b?.closest('.q');if(!el)return;const q=Q[+el.dataset.i];if('del'in b.dataset)Q.splice(+el.dataset.i,1);else if('addo'in b.dataset)q.options.push('');else if(b.dataset.rm!==undefined)q.options.splice(+b.dataset.rm,1);else return;draw()};
 if(!locked){$('#addmc').onclick=()=>{Q.push({type:'mc',text:'',points:1,options:['','','',''],correct:null});draw()};$('#addtf').onclick=()=>{Q.push({type:'tf',text:'',points:1,options:['صح','خطأ'],correct:null});draw()};$('#addorder').onclick=()=>{Q.push({type:'order',text:'',points:1,options:['','',''],correct:null});draw()}}
 $('#img').onchange=async e=>{try{z.image=await readImg(e.target.files[0]);$('#coverPreview').innerHTML=z.image?`<img src="${z.image}" style="max-height:100px">`:''}catch(x){toast(x.message)}};
 $('#prev').onclick=()=>{step=Math.max(0,step-1);show()};$('#next').onclick=()=>{if(step===0&&!$('#title').value.trim())return toast('اكتب اسم المسابقة أولًا');step=Math.min(2,step+1);show()};
 api('/api/ai/status').then(s=>{$('#aiServiceStatus').textContent=s.enabled?'الذكاء الاصطناعي مفعّل':'الذكاء الاصطناعي غير متاح';$('#aiServiceStatus').dataset.enabled=String(s.enabled)}).catch(()=>{$('#aiServiceStatus').textContent='تعذر التحقق من الخدمة'});
 $('#readSheet').onclick=async()=>{const f=$('#sheet').files[0];if(!f)return toast('اختر صورة الورقة');if(f.size>1.5e6)return toast('حجم الصورة أكبر من 1.5 ميغابايت');const button=$('#readSheet');button.disabled=true;try{const image=await readImg(f);$('#aiStatus').textContent='جارٍ تحليل الصورة بالذكاء الاصطناعي...';const r=await api('/api/ai/parse-sheet','POST',{image});Q.push(...r.questions);draw();$('#aiStatus').textContent='استخرجنا '+r.questions.length+' سؤال. راجع النص والإجابات قبل الحفظ.';toast('تم استخراج '+r.questions.length+' سؤال')}catch(e){$('#aiStatus').textContent=e.message;toast(e.message)}finally{button.disabled=false}};
 $('#save').onclick=async()=>{const body={title:$('#title').value,description:$('#desc').value,image:z.image,time_limit:$('#tl').value,start_at:toMs($('#sa').value),end_at:toMs($('#ea').value),shuffle_q:$('#shuffle_q').checked,shuffle_a:$('#shuffle_a').checked,show_correct:$('#show_correct').checked,allow_retry:$('#allow_retry').checked,participation_mode:$('#participation_mode').value,entry_mode:$('#entry_mode').value,progression_mode:$('#progression_mode').value,roster:$('#roster').value,questions:Q};try{if(id)await api('/api/quizzes/'+id,'PUT',body);else{if(!Q.length)throw Error('أضف سؤالًا واحدًا على الأقل');await api('/api/quizzes','POST',body)}toast('تم الحفظ');location.hash='#/quizzes'}catch(e){$('#e').textContent=e.message}};
}
async function results(M,id){const r=await api(`/api/quizzes/${id}/results`),z=r.quiz;
 M.innerHTML=`<div class=row><h1 class=sp>نتائج: ${esc(z.title)}</h1><a class="btn p" target=_blank href="/board/${z.code}">ابدأ المسابقة</a>${r.progression_mode==='teacher'?'<button class="btn p" id="unlockNext">فتح السؤال التالي للمشاركين</button>':''}<a class="btn p" href="/api/quizzes/${id}/export.csv">تصدير CSV</a></div>
 <div class=row><button class=btn id=hide>إخفاء النتائج عن الشاشة</button><button class=btn id=show>إظهار النتائج</button></div>
 <div class=grid style="margin:1em 0"><div class="card stat"><b>${r.rows.length}</b><span>مجموعة</span></div><div class="card stat"><b>${r.avg}/${r.totalPoints}</b><span>متوسط الدرجات</span></div>
 <div class="card stat"><b>${r.hardest?esc(r.hardest.text.slice(0,30)):'—'}</b><span>أصعب سؤال${r.hardest?` (${r.hardest.pct}% صحيح)`:''}</span></div><div class="card stat"><b>${r.easiest?esc(r.easiest.text.slice(0,30)):'—'}</b><span>أسهل سؤال${r.easiest?` (${r.easiest.pct}% صحيح)`:''}</span></div></div>
 <div class=card style="overflow-x:auto"><h2>ترتيب المجموعات</h2><table><tr><th>المركز<th>المجموعة<th>الدرجة<th>صحيحة<th>خاطئة<th>النسبة<th>الوقت<th>الحالة<th></tr>${r.rows.map(x=>`<tr><td>${x.rank}${x.tie?' <span class=tag>تعادل</span>':''}<td>${esc(x.name)}<td>${x.score}/${r.totalPoints}<td>${x.correct}<td>${x.answered-x.correct}<td>${x.answered?Math.round(100*x.correct/x.answered):0}%<td>${dur(x.duration)}<td>${x.done?'أنهت':'تلعب'}<td><button class="btn s d" data-g=${x.id}>حذف</button></tr>`).join('')||'<tr><td colspan=9>لا توجد مجموعات بعد</tr>'}</table></div>
 <div class=card style="margin-top:1em;overflow-x:auto"><h2>تحليل الأسئلة</h2><table><tr><th>السؤال<th>صحيحة<th>خاطئة<th>نسبة الصحة</tr>${r.questions.map(x=>`<tr><td>${esc(x.text.slice(0,60))}${r.mostMissed.some(m=>m.id===x.id)?' <span class=tag>أخطأت فيه معظم المجموعات</span>':''}<td>${x.correct}<td>${x.wrong}<td>${x.pct===null?'—':x.pct+'%'}</tr>`).join('')}</table></div>`;
 const st=s=>async()=>{await api(`/api/quizzes/${id}/board`,'POST',{state:s});toast(s==='hidden'?'أُخفيت النتائج':'أُظهرت النتائج')};if(r.progression_mode==='teacher')$('#unlockNext').onclick=async()=>{try{await api(`/api/quizzes/${id}/unlock`,'POST',{});toast('تم فتح السؤال التالي')}catch(e){toast(e.message)}};$('#hide').onclick=st('hidden');$('#show').onclick=st('shown');
 M.onclick=async e=>{const b=e.target.closest('[data-g]');if(b&&await confirmBox('حذف هذه المجموعة ونتائجها؟')){await api('/api/groups/'+b.dataset.g,'DELETE');results(M,id)}}}
render();
