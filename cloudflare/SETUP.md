# إعداد نسخة مِضمار على Cloudflare

## إعداد Wrangler
ملف `wrangler.jsonc` موجود في جذر المشروع ويحتوي مسبقًا على:
- اسم Worker: `midmar-v2-dev`
- نقطة الدخول: `cloudflare/worker.js`
- ربط قاعدة D1: `midmar-dev`
- متغير `GOOGLE_REDIRECT_URI` كقيمة نصية عادية ضمن `vars`.

لا حاجة لإضافة `GOOGLE_REDIRECT_URI` مرة أخرى من لوحة Cloudflare إذا كنت تنشر باستخدام هذا الملف؛ يجب الحفاظ على نفس القيمة في الإعدادين.

## إعداد تسجيل الدخول Google
في Cloudflare Dashboard افتح Worker `midmar-v2-dev` ثم Settings > Variables and Secrets، وأضف الأسرار التالية:
- `GOOGLE_CLIENT_ID` — Secret
- `GOOGLE_CLIENT_SECRET` — Secret

لا تضع هذه القيم في `wrangler.jsonc` أو GitHub.

## إعداد Google Cloud Console
في OAuth 2.0 Client من نوع Web application، أضف هذا الرابط ضمن Authorized redirect URIs:

`https://midmar-v2-dev.midmar-v2-dev.workers.dev/auth/google/callback`

## إعدادات اختيارية
- `GOOGLE_OWNER_EMAIL` — اختياري، لربط هوية مالك مع سجل موجود في D1.
- `OPENAI_API_KEY` — اختياري لتفعيل قراءة أوراق الأسئلة بالذكاء الاصطناعي.

## قاعدة البيانات
- قاعدة D1: `midmar-dev`.
- معرفها مضبوط في `wrangler.jsonc`.
- مجلد الترحيلات: `cloudflare/migrations`.
- لا تشغّل ترحيلات على قاعدة أخرى؛ هذه النسخة مستقلة عن Render.
