# مِضمار — نسخة Cloudflare v2

## الهدف والنطاق
هذه نسخة مستقلة عن Render مبنية في الفرع `cloudflare-v2`. التطوير والنشر هنا لا يغيّران الموقع القديم ولا قاعدة بياناته.

## موارد Cloudflare
- Worker: `midmar-v2-dev`
- الرابط: https://midmar-v2-dev.midmar-v2-dev.workers.dev
- D1: `midmar-dev`
- Database ID: `bab4fc12-ea49-41d8-8925-e70284f03be1`
- المنطقة التي يظهر فيها مورد D1: APAC

## ما تم تنفيذه
- واجهة المعلم مع لوحة رئيسية ومؤشرات المسابقات والمشاركين ومتوسط الدرجات.
- قائمة المسابقات النشطة والمؤرشفة، الإنشاء، التعديل، النسخ، الأرشفة والحذف.
- إعدادات المسابقة، أنواع الأسئلة (اختيار متعدد، صح/خطأ، ترتيب)، قوائم الطلاب، وأنماط التقدم.
- واجهات اللعب ولوحة العرض والنتائج والتصدير CSV.
- نقل واجهة العرض من Socket.IO إلى تحديث دوري من API متوافق مع Workers.
- نقل API إلى Cloudflare Worker وربطه بقاعدة D1.
- تفعيل Workers observability logs وtraces.
- تحسين شريط التنقل، شارة الحساب، رأس لوحة المعلم والتصميم المتجاوب.

## تهيئة مطلوبة قبل تسجيل الدخول
لم تُضف بيانات OAuth السرية إلى Worker بعد. في إعدادات Worker > Variables and Secrets أضف:
- `GOOGLE_CLIENT_ID` — Secret
- `GOOGLE_CLIENT_SECRET` — Secret
- `GOOGLE_REDIRECT_URI` — Plain text بالقيمة:
  `https://midmar-v2-dev.midmar-v2-dev.workers.dev/auth/google/callback`
- `GOOGLE_OWNER_EMAIL` — اختياري، البريد الذي سيُربط بحساب المعلم القديم إن كان ذلك مطلوبًا.
- `OPENAI_API_KEY` — اختياري لتفعيل قراءة أوراق الأسئلة بالذكاء الاصطناعي.

أضف رابط callback أعلاه في Google Cloud Console ضمن Authorized redirect URIs للـ OAuth Client نفسه.

## البيانات
- قاعدة D1 الجديدة تحتوي على مخطط الجداول فقط، ولا تحتوي مستخدمين أو مسابقات أو إجابات مستوردة.
- لم تُنقل أي بيانات من Render.
- لا يوجد تغيير على Render أو بياناته.

## التحقق
- نجح رفع Worker bundle إلى Cloudflare.
- تم ربط D1 في إعداد النشر.
- تم نشر الواجهة والـ API في Worker.
- فحص HTTP خارجي مباشر لم يكتمل من بيئة التنفيذ الحالية، لذلك لا نسجل اختبار المتصفح على أنه ناجح حتى يتم فتح الرابط واختباره من متصفح عادي.

## بنية الملفات
- `cloudflare/worker.js`: API وعمليات التطبيق على Workers.
- `cloudflare/assets.js`: حزمة الواجهة المضمنة التي يخدمها Worker.
- `cloudflare/migrations/0001_initial.sql`: مخطط D1 الأولي.
