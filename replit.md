# مركز شباب الزهور - كرة يد 2010

## نظرة عامة

منصة إدارة فريق كرة اليد. React/Vite frontend + Firebase backend.
يتم التشغيل من `artifacts/zohour-handball`.

## المكدس التقني

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore, Auth, FCM)
- **الإشعارات**: تُرسَل مباشرة من المتصفح (Client-side) عبر FCM HTTP v1 API — يعمل على الخطة المجانية (Spark) بدون Cloud Functions
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
| `fcmTokens` | توكنات الإشعارات |
| `notificationQueue` | طابور الإشعارات (Cloud Function يمسحها بعد الإرسال) |
| `settings/current` | إعدادات مشتركة (تاريخ الجلسة) |

## الميزات الرئيسية

- **لوحة المدرب**: تقييم اللاعبين مع حضور/غياب inline، تأمين التقييم بعد الحفظ مع زر تعديل، رؤية مشتركة بين المدربين
- **لوحة اللاعب**: عرض التقييمات والحضور للجلسة الحالية فقط
- **تاريخ الجلسة**: يُحدَّد من المدرب ويُحفَظ في Firestore (`settings/current`) ليراه الجميع
- **الإشعارات**: متصفح المدرب يوقّع JWT بـ Service Account المضمّن داخل الـ bundle ويستدعي FCM v1 API مباشرة (`src/lib/client-push.ts`). الـ Service Worker (`firebase-messaging-sw.js`) بيعرض الإشعار وبيفتح صفحة اللاعب عند الضغط
- **تغيير الصورة**: اضغط على الصورة في أي وقت

## كيفية النشر على Netlify

1. اربط الـ repo بـ Netlify
2. Build command: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/zohour-handball run build`
3. Publish directory: `artifacts/zohour-handball/dist/public`
4. ضع متغيرات البيئة (اختياري): `BASE_PATH=/`, `PORT=3000`

أو استخدم `netlify.toml` الموجود في الـ root مباشرة.

## الإشعارات (الخطة المجانية)

- لا تحتاج Firebase Functions ولا أي سيرفر.
- الـ Service Account JSON موجود في `artifacts/zohour-handball/src/lib/firebase-service-account.json` ويُحمَّل ضمن الـ bundle.
- متصفح المدرب يولّد OAuth token من الـ SA ويرسل الـ FCM مباشرة عبر HTTP v1 API.
- ⚠️ تحذير أمني: تضمين Service Account في الـ frontend يعطي أي زائر صلاحيات كاملة على Firebase. مقبول لتطبيق فريق صغير خاص فقط.

## كلمة سر المدرب

`80168016`

## تشغيل محلي

```bash
PORT=23176 BASE_PATH=/ pnpm --filter @workspace/zohour-handball run dev
```
