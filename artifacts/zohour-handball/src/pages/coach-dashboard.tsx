import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, onSnapshot, addDoc, updateDoc, serverTimestamp,
  FirestoreError, doc, setDoc, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import {
  Users, ChevronDown, ChevronUp, Activity, Dumbbell, Brain, Sparkles,
  ClipboardList, CalendarCheck, List, Save, Pencil, Check, X,
  CheckCircle2, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { sendRatingEmail } from "@/lib/email";
import { BottomTabs } from "@/components/bottom-tabs";
import { AvatarUpload } from "@/components/avatar-upload";
import { UserAvatar } from "@/components/user-avatar";

const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SETTINGS_DOC = "settings/current";

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }
function getArabicDay(d: string) {
  try { return ARABIC_DAYS[new Date(d + "T00:00:00").getDay()]; } catch { return ""; }
}
function formatDisplayDate(d: string) {
  try { const dt = new Date(d + "T00:00:00"); return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`; } catch { return d; }
}

type AttendanceStatus = "present" | "absent" | null;
type ActiveTab = "players" | "evaluations" | "attendance" | "list";

export default function CoachDashboard() {
  const { user, profile } = useAuth();

  const [players, setPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  const [activeTab, setActiveTab] = useState<ActiveTab>("evaluations");
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  // Evaluation state
  const [expandedEval, setExpandedEval] = useState<string | null>(null);
  const [evalForms, setEvalForms] = useState<Record<string, any>>({});
  const [evalSaving, setEvalSaving] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Set<string>>(new Set());

  // Shared session date (Firestore + localStorage cache)
  const [sessionDate, setSessionDate] = useState<string>(
    () => localStorage.getItem("zohour_session_date") || todayStr(),
  );
  const [editingDate, setEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState(sessionDate);
  const [attendanceSaving, setAttendanceSaving] = useState<string | null>(null);

  // Sync session date from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, SETTINGS_DOC), (snap) => {
      if (snap.exists()) {
        const d = snap.data()?.sessionDate;
        if (d && d !== sessionDate) {
          setSessionDate(d);
          localStorage.setItem("zohour_session_date", d);
        }
      }
    });
    return () => unsub();
  }, []); // eslint-disable-line

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "players"),
      (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e: FirestoreError) => console.warn(e.code));
    const u2 = onSnapshot(collection(db, "ratings"),
      (s) => setRatings(s.docs.map((d) => ({ id: d.id, ...d.data() }) as any).sort((a, b) => (a.date || "").localeCompare(b.date || ""))),
      (e: FirestoreError) => console.warn(e.code));
    const u3 = onSnapshot(collection(db, "coaches"),
      (s) => setCoaches(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e: FirestoreError) => console.warn(e.code));
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    if (!sessionDate) return;
    const q = query(collection(db, "attendance"), where("sessionDate", "==", sessionDate));
    return onSnapshot(q, (s) => {
      const map: Record<string, AttendanceStatus> = {};
      s.docs.forEach((d) => { const r = d.data(); map[r.playerId] = r.status; });
      setAttendance(map);
    }, (e: FirestoreError) => console.warn(e.code));
  }, [sessionDate]);

  const saveSessionDate = async () => {
    if (!tempDate) return;
    setSessionDate(tempDate);
    localStorage.setItem("zohour_session_date", tempDate);
    setEditingDate(false);
    try {
      // Write to Firestore so player dashboard picks it up
      await setDoc(doc(db, SETTINGS_DOC), { sessionDate: tempDate }, { merge: true });
      toast.success("تم حفظ تاريخ الجلسة");
    } catch (e: any) {
      toast.error("خطأ في حفظ التاريخ", { description: e.message });
    }
  };

  const markAttendance = async (player: any, status: AttendanceStatus) => {
    if (!user) return;
    setAttendanceSaving(player.id);
    try {
      await setDoc(doc(db, "attendance", `${sessionDate}_${player.id}`), {
        playerId: player.id,
        playerName: `${player.firstName} ${player.fatherName}`,
        sessionDate,
        status,
        coachId: user.uid,
        markedAt: serverTimestamp(),
      });
    } catch (e: any) {
      toast.error("خطأ في حفظ الحضور", { description: e.message });
    } finally {
      setAttendanceSaving(null);
    }
  };

  const getPlayerRatings = (id: string) => ratings.filter((r) => r.playerId === id);
  const getSessionRating = (id: string) => ratings.find((r) => r.playerId === id && r.date === sessionDate) || null;

  const getPlayerAverages = (id: string) => {
    const pr = getPlayerRatings(id);
    if (!pr.length) return { t: 0 };
    const avg = (k: string) => Math.round(pr.reduce((a, b) => a + (b[k] || 0), 0) / pr.length);
    const p = avg("physical"), s = avg("skill"), m = avg("mental"), g = avg("general");
    return { p, s, m, g, t: Math.round((p + s + m + g) / 4) };
  };

  const handleEvalChange = (playerId: string, field: string, value: any) =>
    setEvalForms((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));

  const openEvalForm = (player: any) => {
    const existing = getSessionRating(player.id);
    setEvalForms((prev) => ({
      ...prev,
      [player.id]: existing
        ? { physical: existing.physical, skill: existing.skill, mental: existing.mental, general: existing.general, notes: existing.notes || "" }
        : { physical: 0, skill: 0, mental: 0, general: 0, notes: "" },
    }));
    setExpandedEval(player.id);
  };

  const toggleEval = (player: any) => {
    const isPresent = attendance[player.id] === "present";
    if (!isPresent) {
      if (attendance[player.id] === "absent") toast.error("اللاعب غائب");
      else toast.warning("حدد الحضور أولاً");
      return;
    }
    if (expandedEval === player.id) { setExpandedEval(null); return; }
    openEvalForm(player);
  };

  const enterEditMode = (player: any) => {
    setEditMode((prev) => new Set([...prev, player.id]));
    openEvalForm(player);
  };

  const submitEval = async (playerId: string, playerName: string) => {
    if (!user) return;
    const data = evalForms[playerId];
    if (!data) return;
    if (!data.physical || !data.skill || !data.mental || !data.general) {
      toast.error("الرجاء تعيين جميع التقييمات"); return;
    }
    setEvalSaving(playerId);
    try {
      const existing = getSessionRating(playerId);
      const payload = {
        playerId, playerName,
        coachId: user.uid, coachName: profile?.name || "المدرب",
        date: sessionDate,
        physical: data.physical, skill: data.skill,
        mental: data.mental, general: data.general,
        notes: data.notes || "",
      };
      if (existing) {
        await updateDoc(doc(db, "ratings", existing.id), { ...payload, updatedAt: serverTimestamp() });
        toast.success("تم تحديث التقييم");
      } else {
        await addDoc(collection(db, "ratings"), { ...payload, createdAt: serverTimestamp() });
        toast.success("تم حفظ التقييم");
        // Fire email to the player (EmailJS, no backend).
        const player = players.find((p) => p.id === playerId);
        const toEmail = player?.email;
        if (toEmail) {
          sendRatingEmail({
            toEmail,
            playerName: player?.firstName || playerName,
            coachName: profile?.name || "المدرب",
          })
            .then((r) => {
              if (r.ok) toast.success("تم إرسال إيميل للاعب");
              else if (r.reason !== "not-configured")
                toast.warning("تعذّر إرسال الإيميل", { description: r.reason });
            })
            .catch((e) => console.warn("Email send error:", e));
        }
      }
      setExpandedEval(null);
      setEditMode((p) => { const s = new Set(p); s.delete(playerId); return s; });
    } catch (err: any) {
      toast.error("خطأ", { description: err.message });
    } finally {
      setEvalSaving(null);
    }
  };

  const handlePhotoChange = async (url: string) => {
    if (!user) return;
    await updateDoc(doc(db, "coaches", user.uid), { photoURL: url });
    await updateDoc(doc(db, "users", user.uid), { photoURL: url });
  };

  const ScoreGrid = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1 flex-wrap" dir="ltr">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${value === n ? "bg-primary text-primary-foreground scale-110 shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{n}</button>
      ))}
    </div>
  );

  // Read-only session header shown in tabs
  const SessionHeader = () => (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4">
      <div className="font-extrabold text-sm text-foreground">
        حضور وغياب يوم {getArabicDay(sessionDate)} الموافق {formatDisplayDate(sessionDate)}
      </div>
    </div>
  );

  return (
    <Layout withBottomTabs>
      {/* Coach Header + date editor */}
      <div className="bg-card border border-border rounded-3xl p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <AvatarUpload photoURL={profile?.photoURL} name={profile?.name} size={56} ring editable onUpload={handlePhotoChange} />
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-base truncate">{profile?.name || "المدرب"}</h2>
            <p className="text-xs text-muted-foreground">{players.length} لاعب · {ratings.length} تقييم</p>
          </div>
        </div>
        {/* Session date editor in header */}
        <div className="bg-muted/40 rounded-xl px-3 py-2">
          {editingDate ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-bold shrink-0">يوم الجلسة:</span>
              <input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)}
                className="flex-1 bg-background rounded-lg px-2 py-1 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 min-w-0" />
              <button onClick={saveSessionDate} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Save className="w-3 h-3" /></button>
              <button onClick={() => { setEditingDate(false); setTempDate(sessionDate); }} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-extrabold text-foreground">
                يوم الجلسة: {getArabicDay(sessionDate)} {formatDisplayDate(sessionDate)}
              </div>
              <button onClick={() => { setEditingDate(true); setTempDate(sessionDate); }}
                className="flex items-center gap-1 text-[11px] text-primary font-bold hover:opacity-70 transition-opacity">
                <Pencil className="w-3 h-3" />تغيير
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── PLAYERS TAB ── */}
        {activeTab === "players" && (
          <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.length === 0 && <div className="col-span-full text-center text-muted-foreground text-sm py-12 bg-card rounded-2xl border border-border">لا يوجد لاعبون</div>}
            {players.map((player) => {
              const avg = getPlayerAverages(player.id);
              return (
                <Card key={player.id} className="border border-border shadow-none hover:border-primary/40 transition-colors cursor-pointer bg-card" onClick={() => setSelectedPlayer(player)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <UserAvatar photoURL={player.photoURL} name={player.firstName} size={48} />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm truncate">{player.firstName} {player.fatherName}</h3>
                        <div className="text-[10px] text-muted-foreground" dir="ltr">{player.phone}</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-2.5 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">المتوسط العام</span>
                      <div className="font-extrabold text-primary text-sm bg-background px-2.5 py-0.5 rounded-md border border-border">{avg.t}<span className="text-[10px] text-muted-foreground/60">/10</span></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

        {/* ── EVALUATIONS TAB ── */}
        {activeTab === "evaluations" && (
          <motion.div key="evaluations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
            <SessionHeader />
            {players.length === 0 && <div className="text-center text-muted-foreground text-sm py-12 bg-card rounded-2xl border border-border">لا يوجد لاعبون</div>}

            {players.map((player) => {
              const isExpanded = expandedEval === player.id;
              const avg = getPlayerAverages(player.id);
              const formData = evalForms[player.id] || {};
              const attStatus = attendance[player.id];
              const isPresent = attStatus === "present";
              const isAbsent = attStatus === "absent";
              const isLoading = attendanceSaving === player.id;
              const sessionRating = getSessionRating(player.id);
              const isRated = !!sessionRating;
              const isInEditMode = editMode.has(player.id);

              return (
                <div key={player.id} className={`bg-card border rounded-2xl overflow-hidden transition-all ${isExpanded ? "border-primary shadow-sm" : isAbsent ? "border-border opacity-55" : "border-border"}`}>
                  <div className="p-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar photoURL={player.photoURL} name={player.firstName} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-sm truncate">{player.firstName} {player.fatherName}</div>
                        <div className="text-[10px] text-muted-foreground">متوسط: {avg.t}/10</div>
                      </div>
                      {/* Attendance buttons */}
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => markAttendance(player, "present")} disabled={isLoading}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all ${attStatus === "present" ? "bg-green-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-700"}`}>
                          <Check className="w-3 h-3" />حاضر
                        </button>
                        <button onClick={() => markAttendance(player, "absent")} disabled={isLoading}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all ${attStatus === "absent" ? "bg-red-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-700"}`}>
                          <X className="w-3 h-3" />غائب
                        </button>
                      </div>
                    </div>

                    {/* Rating controls — only when present */}
                    {isPresent && (
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2.5 border-t border-border">
                        {isRated && !isInEditMode ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">تم التقييم ({sessionRating.coachName || "مدرب"})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => enterEditMode(player)}
                                className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors">
                                <Edit3 className="w-3 h-3" />تعديل
                              </button>
                              <button onClick={() => toggleEval(player)} className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] text-muted-foreground">{isInEditMode ? "وضع التعديل" : "لم يُقيَّم بعد"}</span>
                            <button onClick={() => toggleEval(player)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors">
                              {isExpanded ? "إغلاق" : "تقييم"}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && isPresent && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 border-t border-border bg-muted/10 space-y-5">
                          {[
                            { key: "physical", label: "التقييم البدني", Icon: Activity },
                            { key: "skill", label: "التقييم المهاري", Icon: Dumbbell },
                            { key: "mental", label: "التقييم العقلي", Icon: Brain },
                            { key: "general", label: "التقييم العام", Icon: Sparkles },
                          ].map(({ key, label, Icon }) => (
                            <div key={key} className="space-y-2">
                              <Label className="text-xs font-extrabold flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</Label>
                              <ScoreGrid value={formData[key] || 0} onChange={(v) => handleEvalChange(player.id, key, v)} />
                            </div>
                          ))}
                          <div className="space-y-2">
                            <Label className="text-xs font-extrabold">ملاحظات</Label>
                            <Textarea placeholder="اكتب ملاحظاتك هنا..." value={formData.notes || ""}
                              onChange={(e) => handleEvalChange(player.id, "notes", e.target.value)}
                              className="resize-none text-sm min-h-[72px] bg-background" rows={3} />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => submitEval(player.id, `${player.firstName} ${player.fatherName}`)}
                              disabled={evalSaving === player.id} className="flex-1 h-10 font-bold text-sm rounded-xl">
                              {evalSaving === player.id ? "جاري الحفظ..." : isRated ? "حفظ التعديل" : "حفظ التقييم"}
                            </Button>
                            <Button variant="outline" onClick={() => { setExpandedEval(null); setEditMode((p) => { const s = new Set(p); s.delete(player.id); return s; }); }} className="h-10 px-4 rounded-xl">إلغاء</Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── ATTENDANCE TAB (read-only) ── */}
        {activeTab === "attendance" && (
          <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
            <SessionHeader />
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: "إجمالي", count: players.length, cls: "text-foreground bg-muted" },
                { label: "حاضر", count: Object.values(attendance).filter((s) => s === "present").length, cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20" },
                { label: "غائب", count: Object.values(attendance).filter((s) => s === "absent").length, cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20" },
              ].map(({ label, count, cls }) => (
                <div key={label} className={`rounded-xl p-2.5 text-center ${cls}`}>
                  <div className="font-extrabold text-lg">{count}</div>
                  <div className="text-[10px] font-bold">{label}</div>
                </div>
              ))}
            </div>
            {players.length === 0 && <div className="text-center text-muted-foreground text-sm py-12 bg-card rounded-2xl border border-border">لا يوجد لاعبون</div>}
            {players.map((player) => {
              const status = attendance[player.id];
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

      {/* ── PLAYER MODAL ── */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center gap-4 bg-muted/20">
              <UserAvatar photoURL={selectedPlayer.photoURL} name={selectedPlayer.firstName} size={64} ring />
              <div>
                <h2 className="text-lg font-extrabold">{selectedPlayer.fullName || `${selectedPlayer.firstName} ${selectedPlayer.fatherName}`}</h2>
                <div className="text-xs text-muted-foreground mt-1">هاتف: <span dir="ltr">{selectedPlayer.phone}</span></div>
              </div>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
              {getPlayerRatings(selectedPlayer.id).length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getPlayerRatings(selectedPlayer.id)} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MM/dd")} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                        <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dx={-10} width={20} />
                        <RechartsTooltip contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
                        <Line type="monotone" dataKey="physical" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="بدني" />
                        <Line type="monotone" dataKey="skill" stroke="#1e88e5" strokeWidth={2.5} dot={{ r: 3 }} name="مهاري" />
                        <Line type="monotone" dataKey="mental" stroke="#7b1fa2" strokeWidth={3} dot={{ r: 4, fill: "#7b1fa2" }} name="عقلي" />
                        <Line type="monotone" dataKey="general" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} name="عام" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-extrabold">سجل التقييمات</h3>
                    {getPlayerRatings(selectedPlayer.id).slice().reverse().map((r) => (
                      <div key={r.id} className="bg-muted/30 p-3 rounded-xl border border-border flex justify-between items-start gap-3">
                        <div>
                          <div className="text-xs font-bold text-muted-foreground">{format(new Date(r.date), "yyyy/MM/dd")}</div>
                          {r.notes && <div className="mt-1 text-xs">{r.notes}</div>}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 bg-background px-2 py-1.5 rounded-lg border border-border shrink-0 text-center">
                          {[["بدني", r.physical], ["مهاري", r.skill], ["عقلي", r.mental], ["عام", r.general]].map(([l, v]) => (
                            <div key={l as string}><div className="text-[9px] text-muted-foreground">{l}</div><div className="font-extrabold text-primary text-sm">{v || 0}</div></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-10">لا توجد تقييمات لهذا اللاعب</div>
              )}
            </div>
            <div className="p-4 border-t border-border bg-muted/20 text-left">
              <Button onClick={() => setSelectedPlayer(null)} variant="outline" className="text-xs h-9 rounded-lg font-bold">إغلاق</Button>
            </div>
          </motion.div>
        </div>
      )}

      <BottomTabs
        active={activeTab}
        onChange={(id) => setActiveTab(id as ActiveTab)}
        tabs={[
          { id: "players", label: "اللاعبون", icon: Users },
          { id: "evaluations", label: "التقييم", icon: ClipboardList },
          { id: "attendance", label: "الحضور", icon: CalendarCheck },
          { id: "list", label: "القائمة", icon: List },
        ]}
      />
    </Layout>
  );
}
