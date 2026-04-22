import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, query, where, onSnapshot, FirestoreError,
  doc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, Dumbbell, Brain, Sparkles, BarChart3, CalendarCheck, List } from "lucide-react";
import { format } from "date-fns";
import { registerPlayerForPush, setupForegroundListener } from "@/lib/notifications";
import { BottomTabs } from "@/components/bottom-tabs";
import { AvatarUpload } from "@/components/avatar-upload";
import { UserAvatar } from "@/components/user-avatar";

const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SETTINGS_DOC = "settings/current";

function getArabicDay(dateStr: string) {
  try { return ARABIC_DAYS[new Date(dateStr + "T00:00:00").getDay()]; } catch { return ""; }
}
function formatDisplayDate(dateStr: string) {
  try { const d = new Date(dateStr + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; } catch { return dateStr; }
}
function todayStr() { return format(new Date(), "yyyy-MM-dd"); }

type ActiveTab = "ratings" | "attendance" | "list";

export default function PlayerDashboard() {
  const { user, playerData, profile } = useAuth();
  const [ratings, setRatings] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  // Current session attendance (from coach-set date)
  const [sessionDate, setSessionDate] = useState<string>(
    () => localStorage.getItem("zohour_session_date") || todayStr(),
  );
  const [sessionAttendance, setSessionAttendance] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>("ratings");

  // Register for FCM push as soon as we have a logged-in player.
  useEffect(() => {
    if (!user) return;
    registerPlayerForPush(user.uid).catch(() => {});
    setupForegroundListener();
  }, [user]);

  // Listen to the shared session date set by the coach
  useEffect(() => {
    const unsub = onSnapshot(doc(db, SETTINGS_DOC), (snap) => {
      if (snap.exists()) {
        const d = snap.data()?.sessionDate;
        if (d) {
          setSessionDate(d);
          localStorage.setItem("zohour_session_date", d);
        }
      }
    });
    return () => unsub();
  }, []);

  // Listen to attendance for current session date
  useEffect(() => {
    if (!sessionDate) return;
    const q = query(collection(db, "attendance"), where("sessionDate", "==", sessionDate));
    return onSnapshot(q, (snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => { const r = d.data(); map[r.playerId] = r.status; });
      setSessionAttendance(map);
    }, (e: FirestoreError) => console.warn(e.code));
  }, [sessionDate]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "ratings"), where("playerId", "==", user.uid)),
      (s) => setRatings(s.docs.map((d) => ({ id: d.id, ...d.data() }) as any).sort((a, b) => (a.date || "").localeCompare(b.date || ""))),
      (e: FirestoreError) => console.warn(e.code),
    );
  }, [user]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "coaches"),
      (s) => setCoaches(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e: FirestoreError) => console.warn(e.code));
    const u2 = onSnapshot(collection(db, "players"),
      (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e: FirestoreError) => console.warn(e.code));
    return () => { u1(); u2(); };
  }, []);

  const latestRating = ratings.length > 0 ? ratings[ratings.length - 1] : null;

  const handlePhotoChange = async (url: string) => {
    if (!user) return;
    await updateDoc(doc(db, "players", user.uid), { photoURL: url });
    await updateDoc(doc(db, "users", user.uid), { photoURL: url });
  };

  const presentCount = Object.values(sessionAttendance).filter((s) => s === "present").length;
  const absentCount = Object.values(sessionAttendance).filter((s) => s === "absent").length;

  return (
    <Layout withBottomTabs>
      {/* Profile Header */}
      <div className="bg-card border border-border rounded-3xl p-4 mb-4 flex items-center gap-3 shadow-sm">
        <AvatarUpload
          photoURL={profile?.photoURL || playerData?.photoURL}
          name={playerData?.firstName}
          size={56} ring editable onUpload={handlePhotoChange}
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base truncate">{playerData?.fullName || "لاعب"}</h2>
          <p className="text-xs text-muted-foreground">اضغط على الصورة لتغييرها</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── RATINGS TAB ── */}
        {activeTab === "ratings" && (
          <motion.div key="ratings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard label="بدني" value={latestRating?.physical} icon={Activity} />
              <ScoreCard label="مهاري" value={latestRating?.skill} icon={Dumbbell} />
              <ScoreCard label="عقلي" value={latestRating?.mental} icon={Brain} />
              <ScoreCard label="عام" value={latestRating?.general} icon={Sparkles} />
            </div>

            <Card className="border border-border shadow-none bg-card">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-extrabold">التطور عبر الزمن</CardTitle>
              </CardHeader>
              <CardContent className="p-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ratings} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MM/dd")} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                    <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dx={-10} width={20} />
                    <RechartsTooltip contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
                    <Line type="monotone" dataKey="physical" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="بدني" />
                    <Line type="monotone" dataKey="skill" stroke="#1e88e5" strokeWidth={2.5} dot={{ r: 3 }} name="مهاري" />
                    <Line type="monotone" dataKey="mental" stroke="#7b1fa2" strokeWidth={3} dot={{ r: 4, fill: "#7b1fa2" }} activeDot={{ r: 6 }} name="عقلي" />
                    <Line type="monotone" dataKey="general" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} name="عام" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h3 className="text-sm font-extrabold px-1">سجل التقييمات</h3>
              {ratings.slice().reverse().map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card p-4 rounded-2xl border border-border flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="text-[11px] font-bold bg-muted text-muted-foreground inline-flex px-2 py-0.5 rounded-md">{format(new Date(r.date), "yyyy/MM/dd")}</div>
                      {r.coachName && <div className="text-[11px] text-muted-foreground mt-1">المدرب: {r.coachName}</div>}
                    </div>
                    <div className="grid grid-cols-4 gap-2 bg-muted/50 p-2 rounded-xl text-center shrink-0">
                      <ScorePill label="بدني" value={r.physical} />
                      <ScorePill label="مهاري" value={r.skill} />
                      <ScorePill label="عقلي" value={r.mental} />
                      <ScorePill label="عام" value={r.general} />
                    </div>
                  </div>
                  {r.notes && <div className="text-xs text-foreground bg-muted/40 p-3 rounded-xl leading-relaxed">{r.notes}</div>}
                </motion.div>
              ))}
              {ratings.length === 0 && <div className="text-center text-muted-foreground text-xs py-10 bg-card rounded-2xl border border-border">لا توجد تقييمات بعد</div>}
            </div>
          </motion.div>
        )}

        {/* ── ATTENDANCE TAB — current session only ── */}
        {activeTab === "attendance" && (
          <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {/* Session header — read-only, same style as coach */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
              <div className="font-extrabold text-sm text-foreground">
                حضور وغياب يوم {getArabicDay(sessionDate)} الموافق {formatDisplayDate(sessionDate)}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "إجمالي", count: players.length, cls: "text-foreground bg-muted" },
                { label: "حاضر", count: presentCount, cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20" },
                { label: "غائب", count: absentCount, cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20" },
              ].map(({ label, count, cls }) => (
                <div key={label} className={`rounded-xl p-2.5 text-center ${cls}`}>
                  <div className="font-extrabold text-lg">{count}</div>
                  <div className="text-[10px] font-bold">{label}</div>
                </div>
              ))}
            </div>

            {/* Players list — same format as coach */}
            {players.length === 0 && <div className="text-center text-muted-foreground text-sm py-10 bg-card rounded-2xl border border-border">لا يوجد لاعبون</div>}
            {players.map((player) => {
              const status = sessionAttendance[player.id];
              return (
                <div key={player.id} className={`bg-card border rounded-2xl p-3.5 flex items-center gap-3 ${status === "present" ? "border-green-400/40 bg-green-50/30 dark:bg-green-900/5" : status === "absent" ? "border-red-400/40 bg-red-50/30 dark:bg-red-900/5" : "border-border"}`}>
                  <UserAvatar photoURL={player.photoURL} name={player.firstName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm truncate">{player.firstName} {player.fatherName}</div>
                    {status === "present" && <div className="text-[11px] font-bold text-green-600 dark:text-green-400 mt-0.5">✓ حاضر</div>}
                    {status === "absent" && <div className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-0.5">✗ غائب</div>}
                    {!status && <div className="text-[11px] text-muted-foreground mt-0.5">لم يُسجَّل</div>}
                  </div>
                  <div className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${status === "present" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : status === "absent" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                    {status === "present" ? "حاضر" : status === "absent" ? "غائب" : "—"}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── LIST TAB ── */}
        {activeTab === "list" && (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            <div>
              <h3 className="text-sm font-extrabold mb-2.5 px-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">{coaches.length}</span>المدربون
              </h3>
              {coaches.length === 0 && <div className="text-center text-muted-foreground text-xs py-8 bg-card rounded-2xl border border-border">لا يوجد مدربون</div>}
              <div className="space-y-2">
                {coaches.map((coach) => (
                  <div key={coach.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <UserAvatar photoURL={coach.photoURL} name={coach.name} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm truncate">{coach.name || "مدرب"}</div>
                      <div className="text-[11px] text-muted-foreground">مدرب</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-extrabold mb-2.5 px-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">{players.length}</span>اللاعبون
              </h3>
              {players.length === 0 && <div className="text-center text-muted-foreground text-xs py-8 bg-card rounded-2xl border border-border">لا يوجد لاعبون</div>}
              <div className="space-y-2">
                {players.map((player, idx) => (
                  <div key={player.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-extrabold text-muted-foreground shrink-0">{idx + 1}</div>
                    <UserAvatar photoURL={player.photoURL} name={player.firstName} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm truncate">{player.firstName} {player.fatherName}</div>
                      <div className="text-[11px] text-muted-foreground" dir="ltr">{player.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomTabs
        active={activeTab}
        onChange={(id) => setActiveTab(id as ActiveTab)}
        tabs={[
          { id: "ratings", label: "التقييمات", icon: BarChart3 },
          { id: "attendance", label: "الحضور", icon: CalendarCheck },
          { id: "list", label: "القائمة", icon: List },
        ]}
      />
    </Layout>
  );
}

function ScoreCard({ label, value, icon: Icon }: { label: string; value?: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="border border-border shadow-none bg-card">
      <CardHeader className="pb-2 pt-3 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] text-muted-foreground font-bold">{label}</CardTitle>
        <Icon className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="text-2xl font-extrabold">{value || 0}<span className="text-xs text-muted-foreground/60">/10</span></div>
      </CardContent>
    </Card>
  );
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="px-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-extrabold text-primary text-sm">{value || 0}</div>
    </div>
  );
}
