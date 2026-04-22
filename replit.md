# مركز شباب الزهور - كرة يد 2010

## نظرة عامة

منصة إدارة فريق كرة اليد. React/Vite frontend + Firebase backend.
يتم التشغيل من `artifacts/zohour-handball`.

## المكدس التقني

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore, Auth, FCM)
- **الإشعارات**: Firebase Cloud Functions (`functions/index.js`) — بدون سيرفر خاص
- **النشر**: Netlify (frontend) + Firebase (functions)
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
- **الإشعارات**: عبر Firebase Cloud Functions — المدرب يكتب في `notificationQueue` والـ Function تبعت FCM
- **تغيير الصورة**: اضغط على الصورة في أي وقت

## كيفية النشر على Netlify

1. اربط الـ repo بـ Netlify
2. Build command: `pnpm install && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/zohour-handball run build`
3. Publish directory: `artifacts/zohour-handball/dist/public`
4. ضع متغيرات البيئة (اختياري): `BASE_PATH=/`, `PORT=3000`

أو استخدم `netlify.toml` الموجود في الـ root مباشرة.

## كيفية نشر Firebase Cloud Functions (الإشعارات)

```bash
# ثبّت Firebase CLI
npm install -g firebase-tools

# سجّل دخولك
firebase login

# ثبّت dependencies الـ functions
cd functions && npm install && cd ..

# ادفع الـ functions
firebase deploy --only functions
```

**ملاحظة**: يتطلب Firebase Blaze plan (pay-as-you-go).

## كلمة سر المدرب

`80168016`

## تشغيل محلي

```bash
PORT=23176 BASE_PATH=/ pnpm --filter @workspace/zohour-handball run dev
```
