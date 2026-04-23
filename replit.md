# مركز شباب الزهور - كرة يد 2010

## نظرة عامة

منصة إدارة فريق كرة اليد. React/Vite frontend + Firebase backend.
يتم التشغيل من `artifacts/zohour-handball`.

## المكدس التقني

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore, Auth)
- **الإشعارات**: إيميل عبر EmailJS — لما المدرب يحفظ تقييم، الفرونت بيبعت إيميل من جيميل المدرب مباشرة عبر EmailJS REST API (خطة مجانية: 200 إيميل/شهر، بدون فيزا، بدون باك إند). المفاتيح في `src/lib/email.ts`. ايميل اللاعب بيتسجل تلقائيًا في `players/{uid}.email` لما يدخل البورتل.
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

**ملاحظة:** الـ `fcmToken` بيتخزن مباشرة على `players/{uid}.fcmToken` (مش في collection منفصلة).

## الميزات الرئيسية

- **لوحة المدرب**: تقييم اللاعبين مع حضور/غياب inline، تأمين التقييم بعد الحفظ مع زر تعديل، رؤية مشتركة بين المدربين
- **لوحة اللاعب**: عرض التقييمات والحضور للجلسة الحالية فقط
- **تاريخ الجلسة**: يُحدَّد من المدرب ويُحفَظ في Firestore (`settings/current`) ليراه الجميع
- **الإشعارات**: عند حفظ تقييم، متصفح المدرب يستدعي `sendRatingPushToPlayer` (`src/lib/client-push.ts`) اللي بتقرا `players/{playerId}.fcmToken` وتبعت Web Push عبر FCM v1 API. الـ Service Worker (`firebase-messaging-sw.js`) بيعرضه حتى لو التبويب أو المتصفح مقفول
- **تغيير الصورة**: اضغط على الصورة في أي وقت

## كيفية النشر على Netlify

1. اربط الـ repo بـ Netlify
2. Build command: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/zohour-handball run build`
3. Publish directory: `artifacts/zohour-handball/dist/public`
4. ضع متغيرات البيئة (اختياري): `BASE_PATH=/`, `PORT=3000`

أو استخدم `netlify.toml` الموجود في الـ root مباشرة.

## الإشعارات (FCM Client-Side — خطة مجانية)

### إزاي بتشتغل
1. أول ما اللاعب يدخل لوحته، التطبيق بيطلب إذن الإشعارات ويسجّل Service Worker.
2. لو وافق، بيتسحب FCM token من جوجل بالـ VAPID key، ويتخزن في `players/{uid}.fcmToken`.
3. لما المدرب يحفظ تقييم جديد، متصفحه بيوقّع JWT بـ Service Account المضمّن، يأخذ OAuth token، ويبعت رسالة POST لـ FCM v1 API مباشرة.
4. Service Worker (`firebase-messaging-sw.js`) بيعرض الإشعار حتى لو التبويب/المتصفح مقفول.

### بدون Cloud Functions
مفيش `firebase deploy` ولا `functions/`. كل المنطق في الـ frontend.

### ⚠️ تحذير أمني
ملف `src/lib/firebase-service-account.json` متضمّن في الـ bundle العام. أي حد يفتح الموقع يقدر يستخرجه ويحصل على صلاحيات Firebase Admin كاملة. مقبول لتطبيق فريق صغير خاص فقط — ما تنشرش الرابط في أماكن عامة.

## كلمة سر المدرب

`80168016`

## تشغيل محلي

```bash
PORT=23176 BASE_PATH=/ pnpm --filter @workspace/zohour-handball run dev
```
