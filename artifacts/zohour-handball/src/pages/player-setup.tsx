import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { PhotoUpload } from "@/components/photo-upload";

const setupSchema = z.object({
  firstName: z.string().min(2, "مطلوب"),
  fatherName: z.string().min(2, "مطلوب"),
  grandfatherName: z.string().min(2, "مطلوب"),
  phone: z.string().regex(/^\d{10,11}$/, "يجب أن يكون 10-11 رقماً"),
  whatsappApiKey: z
    .string()
    .regex(/^\d{6,10}$/, "كود مكوّن من 6-10 أرقام")
    .optional()
    .or(z.literal("")),
  day: z.string().regex(/^(0?[1-9]|[12][0-9]|3[01])$/, "1-31"),
  month: z.string().regex(/^(0?[1-9]|1[012])$/, "1-12"),
  year: z.string().refine((val) => {
    const y = parseInt(val);
    return y >= 2008 && y <= 2013;
  }, "2008 - 2013"),
});

export default function PlayerSetup() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      firstName: "",
      fatherName: "",
      grandfatherName: "",
      phone: "",
      whatsappApiKey: "",
      day: "",
      month: "",
      year: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof setupSchema>) => {
    if (!user) return;
    if (!photoURL) {
      toast.error("الرجاء إضافة صورة شخصية");
      return;
    }
    setIsLoading(true);

    try {
      const fullName = `${data.firstName} ${data.fatherName} ${data.grandfatherName}`;
      const pad = (n: string) => n.padStart(2, "0");
      const dob = `${data.year}-${pad(data.month)}-${pad(data.day)}`;

      await setDoc(doc(db, "players", user.uid), {
        firstName: data.firstName,
        fatherName: data.fatherName,
        grandfatherName: data.grandfatherName,
        fullName,
        phone: data.phone,
        whatsappApiKey: data.whatsappApiKey || "",
        dob,
        photoURL,
        createdAt: serverTimestamp(),
      });

      setLocation("/player");
    } catch (error: any) {
      toast.error("حدث خطأ", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card p-6 md:p-8 rounded-3xl shadow-xl shadow-primary/5 border border-border"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-card-foreground">
                بيانات اللاعب
              </h2>
              <p className="text-xs text-muted-foreground">
                أكمل بياناتك الشخصية للمتابعة
              </p>
            </div>
          </div>

          <div className="flex justify-center mb-6">
            <PhotoUpload value={photoURL} onChange={setPhotoURL} size={112} />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الاسم الأول</Label>
                <Input
                  {...form.register("firstName")}
                  className="h-10 bg-muted/50 rounded-lg text-sm"
                />
                {form.formState.errors.firstName && (
                  <p className="text-destructive text-[10px]">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">اسم الأب</Label>
                <Input
                  {...form.register("fatherName")}
                  className="h-10 bg-muted/50 rounded-lg text-sm"
                />
                {form.formState.errors.fatherName && (
                  <p className="text-destructive text-[10px]">
                    {form.formState.errors.fatherName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">اسم الجد</Label>
                <Input
                  {...form.register("grandfatherName")}
                  className="h-10 bg-muted/50 rounded-lg text-sm"
                />
                {form.formState.errors.grandfatherName && (
                  <p className="text-destructive text-[10px]">
                    {form.formState.errors.grandfatherName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">رقم الموبايل</Label>
              <Input
                type="tel"
                {...form.register("phone")}
                className="h-10 bg-muted/50 rounded-lg text-sm text-left"
                dir="ltr"
                placeholder="01xxxxxxxxx"
              />
              {form.formState.errors.phone && (
                <p className="text-destructive text-[10px]">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                كود واتساب (CallMeBot){" "}
                <span className="text-muted-foreground font-normal">- اختياري</span>
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                {...form.register("whatsappApiKey")}
                className="h-10 bg-muted/50 rounded-lg text-sm text-left"
                dir="ltr"
                placeholder="مثال: 1234567"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                لتلقّي إشعار واتساب عند كل تقييم: أضف{" "}
                <span dir="ltr" className="font-bold">+34 644 51 95 23</span> في
                جهات الاتصال، ثم ابعت له على واتساب جملة{" "}
                <span dir="ltr" className="font-mono">I allow callmebot to send me messages</span>.
                هيرد عليك بكود من أرقام، احفظه هنا.
              </p>
              {form.formState.errors.whatsappApiKey && (
                <p className="text-destructive text-[10px]">
                  {form.formState.errors.whatsappApiKey.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">تاريخ الميلاد</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Input
                    type="number"
                    placeholder="اليوم"
                    {...form.register("day")}
                    className="h-10 bg-muted/50 rounded-lg text-sm text-center"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="الشهر"
                    {...form.register("month")}
                    className="h-10 bg-muted/50 rounded-lg text-sm text-center"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="السنة"
                    {...form.register("year")}
                    className="h-10 bg-muted/50 rounded-lg text-sm text-center"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl mt-2"
              disabled={isLoading}
            >
              {isLoading ? "جاري الحفظ..." : "حفظ ومتابعة"}
            </Button>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
