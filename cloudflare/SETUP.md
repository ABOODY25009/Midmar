# إعداد تسجيل الدخول في مِضمار Cloudflare

افتح Cloudflare Dashboard ثم Workers & Pages ثم Worker `midmar-v2-dev` ثم Settings > Variables and Secrets.

أضف:
- `GOOGLE_CLIENT_ID` كـ Secret.
- `GOOGLE_CLIENT_SECRET` كـ Secret.
- `GOOGLE_REDIRECT_URI` كـ Plain text بالقيمة التالية:
  `https://midmar-v2-dev.midmar-v2-dev.workers.dev/auth/google/callback`

بعد ذلك افتح Google Cloud Console > APIs & Services > Credentials، ثم OAuth 2.0 Client ID، وأضف نفس رابط callback في قائمة Authorized redirect URIs.

يمكن إضافة `GOOGLE_OWNER_EMAIL` اختياريًا لربط بريد مالك قديم بسجله السابق إن كانت قاعدة D1 تحتوي ذلك السجل. قاعدة D1 الحالية فارغة، لذلك أول تسجيل دخول سيُنشئ حسابًا جديدًا.

مفتاح `OPENAI_API_KEY` اختياري ولا يلزم لتشغيل بقية وظائف المسابقات؛ بدونه تبقى قراءة أوراق الأسئلة بالذكاء الاصطناعي غير مفعلة.

لا تضع القيم السرية في GitHub أو في ملف الواجهة الأمامية.
