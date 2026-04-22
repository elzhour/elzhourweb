# مركز شباب الزهور - كرة يد 2010

## نظرة عامة

منصة إدارة فريق كرة اليد. React/Vite frontend + Firebase backend.
يتم التشغيل من `artifacts/zohour-handball`.

## المكدس التقني

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore, Auth)
- **الإشعارات**: WhatsApp عبر CallMeBot API — مجاني، بدون سيرفر، بدون FCM. كل لاعب بيفعّل CallMeBot لرقمه ويحفظ الكود في الملف الشخصي
- **النشر**: Netlify (frontend فقط)
- **رفع الصور**: Cloudinary

## مجموعات Firestore

| المجموعة | الاستخدام |
|---|---|
| `users` | بيانات المستخدم الأساسية |
| `players` | ملفات اللاعبين |
| `coaches` | ملفات المدربين |
| `ratings` | تقييمات اللاعبين |
| `attendance` | الحضور والغياب (docId: `sessionDate_playerId`) |
| `settings/current` | إعدادات مشتركة (تاريخ الجلسة) |

## الميزات الرئيسية

- **لوحة المدرب**: تقييم اللاعبين مع حضور/غياب inline، تأمين التقييم بعد الحفظ مع زر تعديل، رؤية مشتركة بين المدربين
- **لوحة اللاعب**: عرض التقييمات والحضور للجلسة الحالية فقط
- **تاريخ الجلسة**: يُحدَّد من المدرب ويُحفَظ في Firestore (`settings/current`) ليراه الجميع
- **الإشعارات**: عند حفظ تقييم جديد، متصفح المدرب يستدعي CallMeBot WhatsApp API مباشرة لرقم اللاعب باستخدام الكود المحفوظ في `players/{uid}.whatsappApiKey` (`src/lib/whatsapp.ts`)
- **تغيير الصورة**: اضغط على الصورة في أي وقت

## كيفية النشر على Netlify

1. اربط الـ repo بـ Netlify
2. Build command: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/zohour-handball run build`
3. Publish directory: `artifacts/zohour-handball/dist/public`
4. ضع متغيرات البيئة (اختياري): `BASE_PATH=/`, `PORT=3000`

أو استخدم `netlify.toml` الموجود في الـ root مباشرة.

## الإشعارات (CallMeBot WhatsApp)

كل لاعب لازم يفعّل البوت لرقمه مرة واحدة:

1. يضيف الرقم **+34 644 51 95 23** في جهات الاتصال باسم *CallMeBot*.
2. يبعت له على واتساب جملة: `I allow callmebot to send me messages`.
3. البوت بيرد بكود من 6-10 أرقام (API key) → يدخله اللاعب في صفحة "بيانات اللاعب".

كل ما المدرب يحفظ تقييم، المتصفح بيبعت رسالة GET لـ `api.callmebot.com/whatsapp.php` بالـ phone + apikey + text. مفيش سيرفر، مفيش تكلفة. المجاني محدود تقريباً برسالة كل دقيقتين لكل رقم.

## كلمة سر المدرب

`80168016`

## تشغيل محلي

```bash
PORT=23176 BASE_PATH=/ pnpm --filter @workspace/zohour-handball run dev
```
