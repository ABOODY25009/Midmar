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

async function loginScreen(){
 let mode='login',role='student';
 const error=new URLSearchParams(location.search).get('auth_error');
 const authError=error==='not_configured'?'تسجيل Google غير مهيأ في إعدادات الخادم.':error==='google_failed'?'تعذر إكمال التحقق عبر Google. حاول مرة أخرى.':error==='invalid_state'?'انتهت صلاحية جلسة التحقق. أعد المحاولة.':error==='role_required'?'لم يتم العثور على حساب. اختر «إنشاء حساب» وحدد صفتك أولًا.':'';
 const draw=()=>{
  const registering=mode==='register';
  app.innerHTML=`<main class="center auth-shell"><section class="auth-panel card account-auth">
   <img class="auth-logo" src="/midmar-logo.webp" alt="شعار مِضمار">
   <span class="auth-kicker">منصة المسابقات التفاعلية</span>
   <h1>${registering?'إنشاء حساب جديد':'تسجيل الدخول'}</h1>
   <p class="auth-intro">${registering?'أنشئ حسابًا واحدًا لتظهر لك واجهة المعلم أو الطالب تلقائيًا في المرات القادمة.':'أدخل بيانات حسابك المسجل مسبقًا.'}</p>
   <div class="auth-tabs"><button class="btn ${!registering?'p':''}" id="modeLogin" type="button">لدي حساب</button><button class="btn ${registering?'p':''}" id="modeRegister" type="button">إنشاء حساب</button></div>
   ${authError?'<p class="err auth-error">'+esc(authError)+'</p>':''}
   <form id="accountForm" class="auth-form">
    ${registering?'<label for="authName">الاسم الكامل</label><input id="authName" name="name" autocomplete="name" required maxlength="80" placeholder="اسمك كما سيظهر في المسابقات">':''}
    <label for="authEmail">البريد الإلكتروني</label><input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="name@example.com">
    <label for="authPassword">كلمة المرور</label><input id="authPassword" name="password" type="password" autocomplete="${registering?'new-password':'current-password'}" minlength="8" required placeholder="${registering?'8 أحرف على الأقل':'كلمة المرور'}">
    ${registering?'<label for="authRole">نوع الحساب</label><select id="authRole" name="role"><option value="student" selected>طالب</option><option value="teacher">معلم</option></select>':''}
    <p class="err auth-error" id="authError" aria-live="polite"></p>
    <button class="btn p role-action" id="authSubmit" type="submit">${registering?'إنشاء الحساب':'دخول'}</button>
   </form>
   <div class="auth-divider"><span>أو</span></div>
   <a class="btn google-login" id="googleAuth" href="/auth/google${registering?'?role='+role:'' }"><span class="google-g">G</span> ${registering?'إنشاء أو ربط الحساب باستخدام Google':'المتابعة باستخدام Google'}</a>
   <small class="auth-footer">${registering?'عند التسجيل بالبريد وكلمة المرور، يلزم توثيق ملكية البريد عبر Google قبل إضافتك إلى مجموعات الطلاب.':'إذا كان حسابك مرتبطًا بـGoogle، استخدم الزر أعلاه.'}</small>
  </section></main>`;
  $('#modeLogin').onclick=()=>{mode='login';draw()};
  $('#modeRegister').onclick=()=>{mode='register';draw()};
  const roleField=$('#authRole'),google=$('#googleAuth');
  if(roleField)roleField.onchange=()=>{role=roleField.value;google.href='/auth/google?role='+role};
  $('#accountForm').onsubmit=async ev=>{
   ev.preventDefault();
   const button=$('#authSubmit'),errorBox=$('#authError');
   button.disabled=true;button.textContent=registering?'جارٍ إنشاء الحساب...':'جارٍ تسجيل الدخول...';errorBox.textContent='';
   const payload={email:$('#authEmail').value.trim(),password:$('#authPassword').value};
   if(registering){payload.name=$('#authName').value.trim();payload.role=$('#authRole').value}
   try{
    await api(registering?'/api/auth/register':'/api/auth/login','POST',payload);
    const account=await fetch('/api/me',{cache:'no-store'}).then(r=>r.json());
    me=account;history.replaceState(null,'',location.pathname);
    location.hash=account.role==='student'?'#/student':'#/';await render();
   }catch(err){errorBox.textContent=err.message||'تعذر إكمال العملية'}
   finally{button.disabled=false;button.textContent=registering?'إنشاء الحساب':'دخول'}
  };
 };
 draw();
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
 me=await fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).catch(()=>({authenticated:false}));
 if(!me.authenticated){await loginScreen();return}
 const h=location.hash.slice(1)||'/';
 if(me.role==='student'){
  app.innerHTML=`<nav class=nav><div class=wrap><div class=nav-brand><img class=nav-logo src="/midmar-logo.webp" alt="شعار مِضمار"></div><a href="#/student" data-p="/student">الرئيسية</a><div class=nav-account><span class=nav-avatar>ط</span><small>${esc(me.name||me.email||'حساب الطالب')}</small></div><span class=sp></span><button class="btn nav-logout" id=logoutBtn type=button>تسجيل الخروج</button></div></nav><main class=wrap id=main></main>`;
  $('#logoutBtn').onclick=async()=>{await api('/api/logout','POST');me=null;location.hash='/';render()};
  const M=$('#main');
  if(h==='/student'||h==='/')await studentHome(M);else M.innerHTML='<p class=err>الصفحة غير متاحة لحساب الطالب.</p>';
  return;
 }
 if(me.role!=='teacher'){app.innerHTML='<main class=center><section class=card>نوع الحساب غير معروف. سجّل الخروج ثم حاول مرة أخرى.</section></main>';return}
 const m=h.match(/^\/quiz\/(new|\d+)\/?(edit|results)?$/);
 app.innerHTML=`<nav class=nav><div class=wrap><div class=nav-brand><img class=nav-logo src="/midmar-logo.webp" alt="شعار مِضمار"></div><a href="#/" data-p="/">الرئيسية</a><a href="#/quizzes" data-p="/quizzes">المسابقات</a><a href="#/student-groups" data-p="/student-groups">مجموعات الطلاب</a><a href="#/settings" data-p="/settings">الإعدادات</a><a class=nav-create href="#/quiz/new" data-p="/quiz/new">+ إنشاء مسابقة</a><div class=nav-account><span class=nav-avatar>م</span><small>${esc(me.name||me.email||"حساب المعلم")}</small></div><span class=sp></span><button class="btn theme-toggle" id="themeToggle" type="button"></button><button class="btn nav-logout" id="logoutBtn" type="button">تسجيل الخروج</button><button class="brand-mark" id="brandOpen" type="button" aria-label="عرض بطاقة التطوير" aria-haspopup="dialog" aria-controls="brandDialog"><span aria-hidden="true">©</span></button><dialog class="brand-dialog" id="brandDialog" aria-labelledby="brandTitle"><div class="brand-card"><img src="/entrit-logo.svg" alt="شعار أنتريت"><div class="brand-copy"><strong id="brandTitle">تطوير أنتريت</strong><span>تم تطوير مِضمار بواسطة أنتريت</span><small id="brandVersion">إصدار الموقع 2.4.0</small></div></div><button class="btn brand-close" id="brandClose" type="button">إغلاق</button></dialog></div></nav><main class=wrap id=main></main>`;
 applyTheme(currentTheme,false);
 $('#themeToggle').onclick=toggleTheme;
 fetch('/api/version').then(r=>r.json()).then(v=>{const el=$('#brandVersion');if(el)el.textContent='إصدار الموقع '+v.version}).catch(()=>{});
 $('#logoutBtn').onclick=async()=>{await api('/api/logout','POST');me=null;location.hash='/';render()};
 document.querySelectorAll('.nav a[data-p]').forEach(a=>a.classList.toggle('on',a.dataset.p===h));
 const brandDialog=$('#brandDialog');$('#brandOpen').onclick=()=>brandDialog.showModal();$('#brandClose').onclick=()=>brandDialog.close();brandDialog.onclick=e=>{if(e.target===brandDialog)brandDialog.close()};
 const M=$('#main');
 try{
  await onboarding();
  if(h==='/')await home(M);
  else if(h==='/quizzes')await list(M);
  else if(h==='/student-groups')await studentGroups(M);
  else if(h==='/settings')await settings(M);
  else if(m&&m[1]==='new')await editor(M,null);
  else if(m&&m[2]==='results')await results(M,m[1]);
  else if(m)await editor(M,m[1]);
  else M.textContent='الصفحة غير موجودة';
 }catch(e){if(e.message!=='401')M.innerHTML='<p class=err>'+esc(e.message)+'</p>'}
}
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
async function studentHome(M){
 const meData=await api('/api/me');
 let data=null;
 if(meData.email_verified){try{data=await api('/api/student/quizzes')}catch(e){toast(e.message)}}
 M.innerHTML=`<header class="page-head"><div><span class="eyebrow">مساحة الطالب</span><h1>مرحبًا ${esc(meData.name||'')}</h1><p>هذه المساحة تعرض المسابقات التي أضافك المعلم إليها.</p></div></header>
 <section class="card student-profile-card"><div><small>معرّف الطالب</small><strong>${esc(meData.student_id||'—')}</strong></div><div><small>البريد الإلكتروني</small><strong>${esc(meData.email||'—')}</strong></div><div><small>حالة البريد</small><strong>${meData.email_verified?'موثّق':'غير موثّق'}</strong></div></section>
 ${!meData.email_verified?`<section class="card verify-card"><h2>يلزم توثيق بريدك الإلكتروني</h2><p>حتى لا يتمكن شخص آخر من استخدام بريدك والدخول باسمك، اربط حسابك بحساب Google يحمل البريد نفسه. بعد التوثيق يستطيع المعلم إضافتك إلى مجموعات الوصول.</p><a class="btn p" href="/auth/google?link=1">توثيق البريد باستخدام Google</a></section>`:''}
 <section class="card" style="margin-top:1em"><div class="row"><h2 class="sp">المسابقات المخصصة لك</h2><button class="btn" id="reloadStudent">تحديث</button></div><div id="studentQuizList">${meData.email_verified?'جارٍ تحميل المسابقات...':'وثّق بريدك أولًا لتظهر لك المسابقات.'}</div></section>`;
 if(data){
  const list=$('#studentQuizList');
  list.innerHTML=data.quizzes.length?data.quizzes.map(q=>`<article class="student-quiz-row"><div><h3>${esc(q.title)}</h3><p>${esc(q.description||'')}</p><small>${q.nq} سؤال · الرمز ${esc(q.code)}</small></div><div class="student-quiz-action"><span class="tag">${q.finished?'مكتملة':q.status==='open'?'متاحة':esc(q.status)}</span>${q.status==='open'?'<a class="btn p" href="/j/'+esc(q.code)+'">دخول المسابقة</a>':''}</div></article>`).join(''):'<p class="muted">لا توجد مسابقات مخصصة لك حاليًا. اطلب من المعلم إضافتك إلى مجموعة وصول.</p>';
 }
 $('#reloadStudent').onclick=()=>studentHome(M);
}
async function studentGroups(M){
 let groups=await api('/api/access-groups'),editing=null;
 M.innerHTML=`<div class="section-heading"><span class="eyebrow">إدارة الطلاب</span><h1>مجموعات الوصول</h1><p>أنشئ مجموعة مرة واحدة، ثم اخترها عند إنشاء أي مسابقة بدل إعادة كتابة أسماء الطلاب كل مرة.</p></div>
 <section class="card group-editor"><div class="row"><h2 class="sp" id="groupFormTitle">إنشاء مجموعة جديدة</h2><button class="btn" id="resetGroupForm" type="button">تفريغ الحقول</button></div>
 <label for="studentGroupName">اسم المجموعة</label><input id="studentGroupName" maxlength="80" placeholder="مثال: ثالث ثانوي 3/5">
 <label for="studentGroupEmails">بريد الطلاب الإلكتروني</label><textarea id="studentGroupEmails" rows="6" placeholder="ضع بريد كل طالب في سطر مستقل أو افصل بينها بفاصلة"></textarea>
 <small class="muted">يجب أن يكون الطالب قد أنشأ حسابًا بصفة «طالب» ووثّق بريده باستخدام Google. الحسابات غير المسجلة أو غير الموثقة لن تُضاف.</small>
 <p class="err" id="groupFormError"></p><button class="btn p" id="saveStudentGroup" type="button">حفظ المجموعة</button>
 </section>
 <section class="group-list" id="studentGroupList"></section>`;
 const name=$('#studentGroupName'),emails=$('#studentGroupEmails'),error=$('#groupFormError'),save=$('#saveStudentGroup');
 const reset=()=>{editing=null;name.value='';emails.value='';error.textContent='';$('#groupFormTitle').textContent='إنشاء مجموعة جديدة';save.textContent='حفظ المجموعة'};
 $('#resetGroupForm').onclick=reset;
 const draw=()=>{$('#studentGroupList').innerHTML=groups.length?groups.map(g=>`<article class="card access-group-card"><div class="row"><div class="sp"><h3>${esc(g.name)}</h3><small>${g.member_count} طالب</small></div><button class="btn s" data-edit-group="${g.id}">تعديل</button><button class="btn s d" data-delete-group="${g.id}">حذف</button></div><div class="member-chips">${g.members.map(m=>`<span class="member-chip">${esc(m.display_name||m.email)} <small>${esc(m.email)}</small></span>`).join('')}</div></article>`).join(''):'<section class="card"><p>لا توجد مجموعات حتى الآن. أنشئ أول مجموعة من النموذج أعلاه.</p></section>'};
 draw();
 $('#studentGroupList').onclick=async e=>{
  const edit=e.target.closest('[data-edit-group]'),del=e.target.closest('[data-delete-group]');
  if(edit){const g=groups.find(x=>x.id===Number(edit.dataset.editGroup));if(!g)return;editing=g.id;name.value=g.name;emails.value=g.members.map(x=>x.email).join('\n');$('#groupFormTitle').textContent='تعديل مجموعة: '+g.name;save.textContent='حفظ التعديلات';M.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(del){const g=groups.find(x=>x.id===Number(del.dataset.deleteGroup));if(!g||!await confirmBox('حذف مجموعة '+g.name+'؟ ستُسحب صلاحية هذه المجموعة من المسابقات المرتبطة بها.'))return;try{await api('/api/access-groups/'+g.id,'DELETE');groups=await api('/api/access-groups');draw();toast('تم حذف المجموعة')}catch(err){toast(err.message)}}
 };
 save.onclick=async()=>{
  const list=emails.value.split(/[\n,،;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!name.value.trim()||!list.length){error.textContent='أدخل اسم المجموعة وبريد طالب واحد على الأقل.';return}
  save.disabled=true;error.textContent='جارٍ التحقق من حسابات الطلاب...';
  try{
   if(editing)await api('/api/access-groups/'+editing,'PUT',{name:name.value.trim(),emails:list});
   else await api('/api/access-groups','POST',{name:name.value.trim(),emails:list});
   groups=await api('/api/access-groups');reset();draw();toast('تم حفظ مجموعة الوصول');
  }catch(err){error.textContent=err.message}
  finally{save.disabled=false}
 };
}
async function settings(M){
 const d=await api('/api/me');
 const ai=await api('/api/ai/status').catch(()=>({configured:false}));
 const role=d.role==='student'?'طالب':'معلم';
 const provider=d.provider==='google'?'Google':'البريد وكلمة المرور';
 M.innerHTML=`<div class=section-heading><span class=eyebrow>التفضيلات والحساب</span><h1>الإعدادات</h1><p>تحكم في مظهر مِضمار وتفاصيل حسابك وخدماته.</p></div>
 <div class=settings-grid>
  <section class=card settings-card><div class=settings-icon>◐</div><div><h2>مظهر الموقع</h2><p>اختر الألوان المناسبة لك. يُحفظ اختيارك على هذا الجهاز.</p></div>
   <div class=theme-choices><button class="btn" data-theme-choice=light type=button>☀ الوضع الساطع</button><button class="btn" data-theme-choice=dark type=button>☾ الوضع المظلم</button></div><small id=themeModeStatus class=settings-hint></small>
  </section>
  <section class=card settings-card><div class=settings-icon>◎</div><div><h2>حسابك</h2><p><b>الاسم:</b> ${esc(d.name||'—')}</p><p><b>البريد الإلكتروني:</b> ${esc(d.email||'—')}</p><p><b>نوع الحساب:</b> ${role}</p><p><b>معرّف الطالب:</b> ${esc(d.student_id||'غير مخصص')}</p><p><b>طريقة الدخول:</b> ${provider}</p><p><b>توثيق البريد:</b> ${d.email_verified?'موثّق':'غير موثّق'}</p>
   ${!d.email_verified?'<a class="btn p" href="/auth/google?link=1">توثيق البريد باستخدام Google</a><small class="settings-hint">التوثيق مطلوب حتى يمكن إضافتك إلى مجموعات الطلاب.</small>':'<small class=settings-hint>حسابك جاهز للاستخدام.</small>'}
  </div></section>
  <section class=card settings-card ai-settings-card><div class=settings-icon>✦</div><div><h2>الذكاء الاصطناعي</h2><p>يستخدم مِضمار مفتاح OpenAI الخاص بك لقراءة أوراق الأسئلة بالصور.</p>
   <p><b>حالة المفتاح:</b> <span class="ai-state ${ai.configured?'connected':'disconnected'}">${ai.configured?'مضاف ومربوط':'لم تتم إضافته بعد'}</span></p>
   <details class=ai-key-help><summary>طريقة إضافة مفتاح OpenAI</summary><ol>
    <li>افتح <a href="https://dash.cloudflare.com/b4ac92ac5a09c1d1516c1163ad62d9ab/workers/services/view/midmar-v2-dev/production/settings" target="_blank" rel="noopener">إعدادات Worker مِضمار في Cloudflare</a>.</li>
    <li>افتح <b>Settings</b> ثم <b>Variables and Secrets</b>.</li>
    <li>اضغط <b>Add</b> واختر نوع <b>Secret</b>.</li>
    <li>اكتب الاسم حرفيًا: <code>OPENAI_API_KEY</code>.</li>
    <li>الصق مفتاحك في خانة القيمة ثم اختر <b>Save and Deploy</b>.</li>
    <li>ارجع إلى هذه الصفحة واضغط «التحقق من المفتاح».</li>
   </ol><p class=muted>لا تضع المفتاح في GitHub أو في كود المتصفح أو في ملف عام. يبقى مخفيًا داخل إعدادات Worker.</p></details>
   <button class="btn" id=checkAiKey type=button>التحقق من المفتاح</button><small id=aiKeyStatus class=settings-hint></small>
  </div></section>
  <section class=card settings-card><div class=settings-icon>?</div><div><h2>المساعدة</h2><p>يمكنك إعادة مشاهدة شرح أقسام الموقع وطريقة إنشاء المسابقات ومتابعة النتائج.</p><button class="btn p" id=replayTour>إعادة شرح الموقع</button></div></section>
 </div>`;
 applyTheme(currentTheme,false);
 document.querySelectorAll('[data-theme-choice]').forEach(x=>x.onclick=()=>applyTheme(x.dataset.themeChoice));
 $('#replayTour').onclick=showTour;
 $('#checkAiKey').onclick=async()=>{const b=$('#checkAiKey'),status=$('#aiKeyStatus');b.disabled=true;status.textContent='جارٍ التحقق...';try{const v=await api('/api/ai/status');status.textContent=v.configured?'تم العثور على مفتاح OpenAI وربطه بنجاح.':'لم يُعثر على المفتاح بعد.';const state=document.querySelector('.ai-state');if(state){state.textContent=v.configured?'مضاف ومربوط':'لم تتم إضافته بعد';state.classList.toggle('connected',v.configured);state.classList.toggle('disconnected',!v.configured)}}catch(e){status.textContent=e.message}finally{b.disabled=false}};
}

const toMs=v=>v?new Date(v).getTime():null,fromMs=v=>v?new Date(v-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16):'';
const readImg=f=>new Promise((res,rej)=>{if(!f)return res('');if(f.size>1.5e6)return rej(Error('الصورة كبيرة (الحد 1.5 ميغابايت)'));const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)});
async function editor(M,id){
 const z=id?await api('/api/quizzes/'+id):{title:'',description:'',image:'',time_limit:0,shuffle_q:0,shuffle_a:0,show_correct:1,allow_retry:0,start_at:null,end_at:null,participation_mode:'groups',entry_mode:'both',progression_mode:'sequential',roster:'',questions:[],ng:0,access_group_ids:[]};
 const locked=!!(id&&(await api('/api/quizzes')).find(x=>x.id==id)?.ng>0);
 const accessGroups=await api('/api/access-groups');
 let Q=z.questions.map(x=>({...x})),step=0;
 const ck=(k,t)=>`<label style="display:flex;gap:.5em;align-items:center;font-weight:400"><input type=checkbox id=${k} style="width:auto" ${z[k]?'checked':''}>${t}</label>`;
 const selected=new Set((z.access_group_ids||[]).map(Number));
 M.innerHTML=`<div class=row><h1 class=sp>${id?'تعديل المسابقة':'إنشاء مسابقة جديدة'}</h1><a class=btn href="#/quizzes">رجوع</a></div><div class="card quiz-wizard">
 <div class="wizard-steps" id=steps><span class=tag>1 · بيانات المسابقة</span><span class=tag>2 · المشاركة والوصول</span><span class=tag>3 · الأسئلة</span></div>
 <section data-step=0><h2>بيانات المسابقة</h2><label>اسم المسابقة</label><input id=title value="${esc(z.title)}"><label>الوصف / التعليمات</label><textarea id=desc rows=3>${esc(z.description)}</textarea>
 <label>صورة المسابقة</label><input type=file id=img accept="image/*"><div id=coverPreview>${z.image?`<img src="${z.image}" style="max-height:100px">`:''}</div>
 <div class=grid><div><label>المدة بالدقائق (0 بلا حد)</label><input type=number min=0 id=tl value=${z.time_limit}></div><div><label>موعد البدء</label><input type=datetime-local id=sa value="${fromMs(z.start_at)}"></div><div><label>موعد الإغلاق</label><input type=datetime-local id=ea value="${fromMs(z.end_at)}"></div></div>
 <hr><h3>إعدادات عرض الأسئلة</h3>${ck('shuffle_q','ترتيب الأسئلة عشوائي')}${ck('shuffle_a','ترتيب الإجابات عشوائي')}${ck('show_correct','إظهار الإجابة الصحيحة')}${ck('allow_retry','السماح بإعادة المحاولة')}</section>
 <section data-step=1 hidden><h2>طريقة المشاركة ومجموعات الوصول</h2><label>نوع المشاركة</label><select id=participation_mode><option value=groups ${z.participation_mode!=='students'?'selected':''}>مجموعات – جهاز واحد لكل مجموعة</option><option value=students ${z.participation_mode==='students'?'selected':''}>طلاب – حساب مستقل لكل طالب</option></select>
 <div id=studentGroupPicker hidden><div class="access-picker-heading"><h3>من يسمح له بدخول المسابقة؟</h3><a href="#/student-groups" target="_blank">إدارة مجموعات الطلاب</a></div><p class=muted>اختر مجموعة أو أكثر. لن يستطيع الدخول إلا الطلاب المسجلون في هذه المجموعات.</p>
 <div class=access-pick-list>${accessGroups.map(g=>`<label class=access-pick><input type=checkbox class=access-group-checkbox value=${g.id} ${selected.has(g.id)?'checked':''}><span><b>${esc(g.name)}</b><small>${g.member_count} طالب</small></span></label>`).join('')||'<p>لا توجد مجموعات وصول بعد. افتح «مجموعات الطلاب» وأنشئ مجموعتك أولًا.</p>'}</div>
 <small class=muted>الطلاب الذين لم يوثقوا بريدهم الإلكتروني أو لم تتم إضافتهم إلى مجموعة مختارة لن يتمكنوا من المشاركة.</small></div>
 <div id=groupParticipationHint class=card style="margin-top:1em"><b>المشاركة الجماعية</b><p>كل مجموعة تستخدم جهازًا واحدًا، وتدخل اسم مجموعتها في صفحة المسابقة. لإدارة قوائم الطلاب استخدم خيار المشاركة الفردية.</p></div>
 <label>طريقة الانتقال بين الأسئلة</label><select id=progression_mode><option value=sequential ${!z.progression_mode||z.progression_mode==='sequential'?'selected':''}>تسلسلي</option><option value=free ${z.progression_mode==='free'?'selected':''}>حر</option><option value=teacher ${z.progression_mode==='teacher'?'selected':''}>تحكم المعلم</option></select></section>
 <section data-step=2 hidden><h2>الأسئلة</h2><div class=card><h3>إنشاء الأسئلة من صورة</h3><input type=file id=sheet accept="image/png,image/jpeg,image/webp"><button class=btn id=readSheet type=button>قراءة الورقة بالذكاء الاصطناعي</button><small id=aiStatus>ارفع صورة الورقة، ثم راجع نص الأسئلة والإجابات قبل اعتمادها.</small></div>
 <div id=qs></div>${locked?'':'<div class=row><button class=btn id=addmc type=button>+ اختيار متعدد</button><button class=btn id=addtf type=button>+ صح أو خطأ</button><button class=btn id=addorder type=button>+ رتّب العناصر</button></div>'}</section>
 <p class=err id=e></p><div class="wizard-footer"><button class=btn id=prev type=button hidden>السابق</button><span class=sp></span><button class="btn p wizard-action" id=stepAction type=button>التالي</button></div></div>`;
 const show=()=>{M.querySelectorAll('[data-step]').forEach(x=>x.hidden=+x.dataset.step!==step);M.querySelectorAll('#steps .tag').forEach((x,i)=>{x.style.opacity=i===step?'1':'.48';x.classList.toggle('current-step',i===step)});$('#prev').hidden=step===0;$('#stepAction').textContent=step===2?(id?'حفظ التعديلات':'إنشاء المسابقة'):'التالي'};
 const syncParticipation=()=>{const students=$('#participation_mode').value==='students';$('#studentGroupPicker').hidden=!students;$('#groupParticipationHint').hidden=students};
 $('#participation_mode').onchange=syncParticipation;syncParticipation();show();
 const draw=()=>{$('#qs').innerHTML=Q.map((q,i)=>`<div class=q data-i=${i}><div class=row><b>سؤال ${i+1} · ${q.type==='tf'?'صح أو خطأ':q.type==='order'?'رتّب العناصر':'اختيار متعدد'}</b><span class=sp></span><label>الدرجة <input type=number min=1 data-f=points value=${q.points} style="width:4em"></label>${locked?'':'<button class="btn s d" data-del type=button>حذف</button>'}</div><label>نص السؤال</label><textarea data-f=text>${esc(q.text)}</textarea><label>${q.type==='order'?'العناصر بالترتيب الصحيح':'الخيارات'}</label>${(q.type==='tf'?['صح','خطأ']:q.options).map((o,j)=>`<div class=opt>${q.type==='order'?`<b>${j+1}.</b>`:'<input type=radio name=c'+i+' data-c='+j+(q.correct===j?' checked':'')+'>'}<input data-o=${j} value="${esc(o)}" placeholder="عنصر ${j+1}"><button class="btn s" data-rm=${j} type=button ${q.options.length<=2?'disabled':''}>×</button></div>`).join('')}${q.type!=='tf'&&q.options.length<6&&!locked?'<button class=btn data-addo type=button>+ خيار</button>':''}</div>`).join('')||'<p>أضف سؤالًا من الأزرار.</p>'};
 draw();const box=$('#qs');
 box.oninput=e=>{const el=e.target.closest('.q');if(!el)return;const q=Q[+el.dataset.i],t=e.target;if(t.dataset.f)q[t.dataset.f]=t.dataset.f==='points'?+t.value:t.value;if(t.dataset.o!==undefined)q.options[+t.dataset.o]=t.value};
 box.onchange=e=>{const el=e.target.closest('.q');if(el&&e.target.dataset.c!==undefined)Q[+el.dataset.i].correct=+e.target.dataset.c};
 box.onclick=e=>{const b=e.target.closest('button'),el=b?.closest('.q');if(!el)return;const q=Q[+el.dataset.i];if('del'in b.dataset)Q.splice(+el.dataset.i,1);else if('addo'in b.dataset)q.options.push('');else if(b.dataset.rm!==undefined)q.options.splice(+b.dataset.rm,1);else return;draw()};
 if(!locked){$('#addmc').onclick=()=>{Q.push({type:'mc',text:'',points:1,options:['','','',''],correct:null});draw()};$('#addtf').onclick=()=>{Q.push({type:'tf',text:'',points:1,options:['صح','خطأ'],correct:null});draw()};$('#addorder').onclick=()=>{Q.push({type:'order',text:'',points:1,options:['','',''],correct:null});draw()}}
 $('#img').onchange=async e=>{try{z.image=await readImg(e.target.files[0]);$('#coverPreview').innerHTML=z.image?`<img src="${z.image}" style="max-height:100px">`:''}catch(x){toast(x.message)}};
 $('#prev').onclick=()=>{step=Math.max(0,step-1);show()};
 $('#readSheet').onclick=async()=>{const f=$('#sheet').files[0];if(!f)return toast('اختر صورة الورقة');const button=$('#readSheet');button.disabled=true;try{const image=await readImg(f);$('#aiStatus').textContent='جارٍ تحليل الصورة...';const r=await api('/api/ai/parse-sheet','POST',{image});Q.push(...r.questions);draw();$('#aiStatus').textContent='استخرجنا '+r.questions.length+' سؤال. راجع الإجابات قبل الحفظ.'}catch(err){$('#aiStatus').textContent=err.message;toast(err.message)}finally{button.disabled=false}};
 const saveQuiz=async()=>{
  const access_group_ids=[...M.querySelectorAll('.access-group-checkbox:checked')].map(x=>Number(x.value));
  const body={title:$('#title').value,description:$('#desc').value,image:z.image,time_limit:$('#tl').value,start_at:toMs($('#sa').value),end_at:toMs($('#ea').value),shuffle_q:$('#shuffle_q').checked,shuffle_a:$('#shuffle_a').checked,show_correct:$('#show_correct').checked,allow_retry:$('#allow_retry').checked,participation_mode:$('#participation_mode').value,entry_mode:'roster',progression_mode:$('#progression_mode').value,roster:'',access_group_ids,questions:Q};
  if(body.participation_mode==='students'&&!access_group_ids.length){$('#e').textContent='اختر مجموعة وصول واحدة على الأقل في خطوة المشاركة.';step=1;show();return}
  if(!Q.length){$('#e').textContent='أضف سؤالًا واحدًا على الأقل.';return}
  const action=$('#stepAction');action.disabled=true;action.textContent='جارٍ الحفظ...';
  try{if(id)await api('/api/quizzes/'+id,'PUT',body);else await api('/api/quizzes','POST',body);toast(id?'تم حفظ التعديلات':'تم إنشاء المسابقة');location.hash='#/quizzes'}
  catch(err){$('#e').textContent=err.message;action.disabled=false;show()}
 };
 $('#stepAction').onclick=async()=>{
  $('#e').textContent='';
  if(step===0){if(!$('#title').value.trim()){toast('اكتب اسم المسابقة أولًا');return}step=1;show();return}
  if(step===1){if($('#participation_mode').value==='students'&&!M.querySelector('.access-group-checkbox:checked')){toast('اختر مجموعة وصول واحدة على الأقل أو أنشئ مجموعة جديدة');return}step=2;show();return}
  await saveQuiz();
 };
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
