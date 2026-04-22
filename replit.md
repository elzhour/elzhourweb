# مركز شباب الزهور - كرة يد 2010

## نظرة عامة

منصة إدارة فريق كرة اليد. React/Vite frontend + Firebase backend.
يتم التشغيل من `artifacts/zohour-handball`.

## المكدس التقني

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore, Auth, FCM)
- **الإشعارات**: Web Push عبر FCM — Cloud Function بتشتغل لما يتضاف rating جديد وتبعت push للاعب (شغّال حتى لو المتصفح مقفول)
- **النشر**: Netlify (frontend) + Firebase Functions (إشعارات — Blaze plan)
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
- **الإشعارات**: عند حفظ تقييم في `ratings/`، Cloud Function (`functions/index.js`) بتقرا `players/{playerId}.fcmToken` وتبعت Web Push عبر FCM. الـ Service Worker (`firebase-messaging-sw.js`) بيعرضه حتى لو التبويب أو المتصفح مقفول
- **تغيير الصورة**: اضغط على الصورة في أي وقت

## كيفية النشر على Netlify

1. اربط الـ repo بـ Netlify
2. Build command: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/zohour-handball run build`
3. Publish directory: `artifacts/zohour-handball/dist/public`
4. ضع متغيرات البيئة (اختياري): `BASE_PATH=/`, `PORT=3000`

أو استخدم `netlify.toml` الموجود في الـ root مباشرة.

## الإشعارات (Firebase Cloud Messaging)

### إزاي بتشتغل
1. أول ما اللاعب يدخل لوحته، التطبيق بيطلب إذن الإشعارات.
2. لو وافق، بيتسحب FCM token من جوجل ويتخزن في `players/{uid}.fcmToken`.
3. لما المدرب يحفظ تقييم جديد، Cloud Function (`sendRatingNotification`) بتشتغل تلقائياً، تقرا الـ token، وتبعت push notification.
4. Service Worker (`firebase-messaging-sw.js`) بيعرض الإشعار في الخلفية حتى لو التبويب/المتصفح مقفول.

### نشر الـ Cloud Function (مرة واحدة)
> ⚠️ يتطلب Firebase **Blaze plan** (pay-as-you-go). الاستخدام المتوقع للفريق ده مجاناً 100% لأن حدود Spark كافية، بس Firebase بتطلب Blaze عشان تنشر functions أصلاً.

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase deploy --only functions
```

ملفات الـ Firebase:
- `functions/index.js` — الـ Cloud Function اللي بتبعت الإشعار
- `firebase.json` — تهيئة المشروع
- `.firebaserc` — اسم المشروع

## كلمة سر المدرب

`80168016`

## تشغيل محلي

```bash
PORT=23176 BASE_PATH=/ pnpm --filter @workspace/zohour-handball run dev
```
