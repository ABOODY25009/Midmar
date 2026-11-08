# إعداد نسخة مِضمار الموسعة على Cloudflare

## الموارد
- Worker: `midmar-v2-dev`
- قاعدة D1: `midmar-dev`
- Workers AI binding: `AI`
- Google OAuth: Client ID وClient Secret محفوظان كـ Secrets.

## Wrangler
ملف `wrangler.jsonc` يعرّف Workers AI باسم `AI`، وقاعدة D1 باسم `DB`. حافظ على الربطين في كل نشر مستقبلي.

## تسجيل الدخول
- **المعلم:** تسجيل الدخول باستخدام Google.
- **الطالب:** يختار دخول الطالب ويدخل رمز المسابقة ذي 6 أرقام. لا يحتاج الطالب إلى حساب Google.

## قراءة ورقة الأسئلة بالذكاء الاصطناعي
- تتم المعالجة عبر Cloudflare Workers AI بالنموذج `@cf/moondream/moondream3.1-9B-A2B`.
- لا يحتاج هذا المسار إلى `OPENAI_API_KEY`.
- يقبل PNG وJPG وWEBP.
- يجب مراجعة الأسئلة والإجابات المستخرجة قبل حفظها، خصوصًا الأسئلة التي لا تظهر إجابتها بوضوح.
- الخدمة تخضع لحدود Workers AI وتسعير الاستخدام في حساب Cloudflare.

## Google OAuth
الأسرار التالية تبقى في Cloudflare Variables and Secrets ولا ترفع إلى GitHub:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

رابط إعادة التوجيه:
`https://midmar-v2-dev.midmar-v2-dev.workers.dev/auth/google/callback`

## الشعار
الشعار الرسمي موجود في `public/midmar-logo.webp` ويقدمه Worker من المسار `/midmar-logo.webp`.
