# إعداد نسخة مِضمار الموسّعة على Cloudflare

## موارد التطبيق
- Worker: `midmar-v2-dev`
- D1 binding: `DB` → `midmar-dev`
- Workers AI binding: `AI` → خدمة نماذج Cloudflare
- عنوان الموقع: `https://midmar-v2-dev.midmar-v2-dev.workers.dev`

## إعداد Wrangler
ملف `wrangler.jsonc` يعرّف اسم Worker ونقطة الدخول وربط D1 وربط Workers AI ومتغير إعادة توجيه Google.
استخدم الملف نفسه عند النشر حتى تبقى الإعدادات متزامنة.

## تسجيل المعلم
في Cloudflare Worker > Settings > Variables and Secrets يجب أن تبقى الأسرار:
- `GOOGLE_CLIENT_ID` — Secret
- `GOOGLE_CLIENT_SECRET` — Secret

ورابط إعادة التوجيه النصي:
`GOOGLE_REDIRECT_URI=https://midmar-v2-dev.midmar-v2-dev.workers.dev/auth/google/callback`

لا تضف الأسرار إلى GitHub أو `wrangler.jsonc`.

## دخول الطالب
الطالب لا يحتاج إلى Google أو حساب دائم. يختار «أنا طالب» ويدخل رمز المسابقة المكوّن من ستة أرقام، ثم يكمل اسمه أو يختاره من قائمة المعلم.

## الذكاء الاصطناعي
- استخراج الأسئلة من صورة الورقة يعمل عبر Cloudflare Workers AI model `@cf/qwen/qwen3.8-27b`.
- ربط AI في `wrangler.jsonc` اسمه `AI`.
- لا يحتاج هذا المسار إلى `OPENAI_API_KEY`.
- إذا أُضيف `OPENAI_API_KEY` كـ Secret، يبقى هناك مسار احتياطي عند عدم توفر Workers AI.
- واجهة المتصفح تحوّل الصور المدخلة إلى PNG وتقلّص الأبعاد قبل الإرسال، ثم تعرض الأسئلة المستخرجة لمراجعة المعلم قبل حفظها.
- استخدام Workers AI يخضع لاستهلاك وحدود وتسعير حساب Cloudflare.

## الهوية البصرية
الشعار الرسمي مضمّن في `cloudflare/brand.js` ويُقدّم عبر المسار `/midmar-logo.webp`.
يُستخدم في شاشة الاختيار، وشريط المعلم، وصفحة الطالب ولوحة المسابقة.

## النشر
تأكد من ربط `DB` و`AI` عند نشر Worker. لا تستبدل أو تحذف أسرار Google. قاعدة D1 تبقى `midmar-dev` ولا تتصل ببيانات Render القديمة.
