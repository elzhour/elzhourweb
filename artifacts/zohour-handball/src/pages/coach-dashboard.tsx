import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  FirestoreError,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import {
  Users,
  ChevronDown,
  ChevronUp,
  Activity,
  Dumbbell,
  Brain,
  Sparkles,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Chat, type ChatMessage } from "@/components/chat";
import {
  setActiveChatPath,
  useNotifications,
  registerFcmForUser,
  broadcastPush,
} from "@/lib/notifications";
import { BottomTabs } from "@/components/bottom-tabs";
import { UserAvatar } from "@/components/user-avatar";

export default function CoachDashboard() {
  const { user, profile } = useAuth();
  const { notify } = useNotifications();

  const [players, setPlayers] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "players" | "evaluations" | "chat"
  >("players");
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  const [expandedEval, setExpandedEval] = useState<string | null>(null);
  const [evalForms, setEvalForms] = useState<Record<string, any>>({});
  const [evalSaving, setEvalSaving] = useState<string | null>(null);

  const [chatType, setChatType] = useState<"team" | string>("team");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (user) registerFcmForUser(user.uid, "coach");
  }, [user]);

  useEffect(() => {
    const unsubPlayers = onSnapshot(
      collection(db, "players"),
      (snap) => {
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err: FirestoreError) => {
        console.warn("Players listener error:", err.code);
      },
    );

    const unsubRatings = onSnapshot(
      collection(db, "ratings"),
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as any)
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        setRatings(data);
      },
      (err: FirestoreError) => {
        console.warn("Ratings listener error:", err.code);
      },
    );

    return () => {
      unsubPlayers();
      unsubRatings();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let path = "chats/team/messages";
    if (chatType !== "team") {
      path = `chats/coach_${user.uid}_player_${chatType}/messages`;
    }

    setActiveChatPath(path);

    const unsubChat = onSnapshot(
      query(collection(db, path), orderBy("createdAt", "asc")),
      (snap) => {
        setChatMessages(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage),
        );

        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const m = change.doc.data();
            if (
              m.senderId !== user.uid &&
              m.createdAt &&
              Date.now() - m.createdAt.toMillis() < 10000
            ) {
              notify(`رسالة جديدة من ${m.senderName}`, {
                body: m.text,
                chatPath: path,
              });
            }
          }
        });
      },
      (err: FirestoreError) => {
        console.warn("Chat listener error:", err.code);
      },
    );
    return () => {
      unsubChat();
      setActiveChatPath(null);
    };
  }, [chatType, user, notify]);

  const getPlayerRatings = (playerId: string) =>
    ratings.filter((r) => r.playerId === playerId);
  const getPlayerAverages = (playerId: string) => {
    const pr = getPlayerRatings(playerId);
    if (pr.length === 0) return { p: 0, s: 0, m: 0, g: 0, t: 0 };
    const p = Math.round(pr.reduce((a, b) => a + (b.physical || 0), 0) / pr.length);
    const s = Math.round(pr.reduce((a, b) => a + (b.skill || 0), 0) / pr.length);
    const m = Math.round(pr.reduce((a, b) => a + (b.mental || 0), 0) / pr.length);
    const g = Math.round(pr.reduce((a, b) => a + (b.general || 0), 0) / pr.length);
    return { p, s, m, g, t: Math.round((p + s + m + g) / 4) };
  };

  const handleEvalChange = (playerId: string, field: string, value: any) => {
    setEvalForms((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }));
  };

  const initEvalForm = (playerId: string) => {
    if (!evalForms[playerId]) {
      setEvalForms((prev) => ({
        ...prev,
        [playerId]: {
          physical: 0,
          skill: 0,
          mental: 0,
          general: 0,
          notes: "",
          d: format(new Date(), "dd"),
          m: format(new Date(), "MM"),
          y: format(new Date(), "yyyy"),
        },
      }));
    }
  };

  const toggleEval = (playerId: string) => {
    if (expandedEval === playerId) {
      setExpandedEval(null);
    } else {
      initEvalForm(playerId);
      setExpandedEval(playerId);
    }
  };

  const submitEval = async (playerId: string, playerName: string) => {
    if (!user) return;
    const data = evalForms[playerId];
    if (!data) return;

    if (!data.physical || !data.skill || !data.mental || !data.general) {
      toast.error("الرجاء استكمال جميع التقييمات");
      return;
    }

    setEvalSaving(playerId);
    try {
      const pad = (n: string) => n.padStart(2, "0");
      const date = `${data.y}-${pad(data.m)}-${pad(data.d)}`;

      await addDoc(collection(db, "ratings"), {
        playerId,
        playerName,
        coachId: user.uid,
        coachName: profile?.name || "المدرب",
        date,
        physical: data.physical,
        skill: data.skill,
        mental: data.mental,
        general: data.general,
        notes: data.notes || "",
        createdAt: serverTimestamp(),
      });

      // Push to that player only
      broadcastPush({
        title: `تقييم جديد من ${profile?.name || "المدرب"}`,
        body: `حصلت على بدني ${data.physical}، مهاري ${data.skill}، عقلي ${data.mental}، عام ${data.general}`,
        recipients: [{ uid: playerId, role: "player" }],
        scope: "user",
      });

      toast.success("تم حفظ التقييم بنجاح");
      setExpandedEval(null);
    } catch (error: any) {
      toast.error("خطأ", { description: error.message });
    } finally {
      setEvalSaving(null);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    const path =
      chatType === "team"
        ? "chats/team/messages"
        : `chats/coach_${user.uid}_player_${chatType}/messages`;
    try {
      await deleteDoc(doc(db, path, messageId));
      toast.success("تم حذف الرسالة");
    } catch (e: any) {
      toast.error("تعذّر حذف الرسالة", { description: e.message });
    }
  };

  const sendMessage = async (
    text: string,
    replyTo?: ChatMessage["replyTo"],
  ) => {
    if (!user) return;
    const path =
      chatType === "team"
        ? "chats/team/messages"
        : `chats/coach_${user.uid}_player_${chatType}/messages`;

    await addDoc(collection(db, path), {
      senderId: user.uid,
      senderName: profile?.name || "المدرب",
      senderRole: "coach",
      senderPhotoURL: profile?.photoURL || null,
      text,
      replyTo: replyTo || null,
      createdAt: serverTimestamp(),
    });

    // Trigger server-side push
    broadcastPush({
      title: `${profile?.name || "المدرب"} في ${chatType === "team" ? "شات الفريق" : "محادثة خاصة"}`,
      body: text,
      excludeUid: user.uid,
      scope: chatType === "team" ? "team" : "user",
      recipients:
        chatType === "team" ? undefined : [{ uid: chatType, role: "player" }],
    });
  };

  const ScoreGrid = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex gap-1 flex-wrap" dir="ltr">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onChange(num)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${value === num ? "bg-primary text-primary-foreground scale-110 shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          {num}
        </button>
      ))}
    </div>
  );

  return (
    <Layout withBottomTabs>
      {/* Coach Header */}
      <div className="bg-card border border-border rounded-3xl p-4 mb-5 flex items-center gap-3 shadow-sm">
        <UserAvatar
          photoURL={profile?.photoURL}
          name={profile?.name}
          size={56}
          ring
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base text-foreground truncate">
            {profile?.name || "المدرب"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {players.length} لاعب · {ratings.length} تقييم
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* PLAYERS TAB */}
        {activeTab === "players" && (
          <motion.div
            key="players"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {players.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground text-sm py-12 bg-card rounded-2xl border border-border">
                لا يوجد لاعبون مسجلون بعد
              </div>
            )}
            {players.map((player) => {
              const avg = getPlayerAverages(player.id);
              return (
                <Card
                  key={player.id}
                  className="border border-border shadow-none hover:border-primary/50 transition-colors cursor-pointer bg-card"
                  onClick={() => setSelectedPlayer(player)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <UserAvatar
                        photoURL={player.photoURL}
                        name={player.firstName}
                        size={48}
                      />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-foreground truncate">
                          {player.firstName} {player.fatherName}
                        </h3>
                        <div
                          className="text-[10px] text-muted-foreground"
                          dir="ltr"
                        >
                          {player.phone}
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-2.5 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">
                        المتوسط العام
                      </span>
                      <div className="font-extrabold text-primary text-sm bg-background px-2.5 py-0.5 rounded-md border border-border">
                        {avg.t}
                        <span className="text-[10px] text-muted-foreground/60 ml-0.5">
                          /10
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

        {/* EVALUATIONS TAB */}
        {activeTab === "evaluations" && (
          <motion.div
            key="evaluations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2.5"
          >
            {players.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-12 bg-card rounded-2xl border border-border">
                لا يوجد لاعبون لتقييمهم
              </div>
            )}
            {players.map((player) => {
              const isExpanded = expandedEval === player.id;
              const avg = getPlayerAverages(player.id);
              const formData = evalForms[player.id] || {};

              return (
                <div
                  key={player.id}
                  className={`bg-card border rounded-2xl overflow-hidden transition-colors ${isExpanded ? "border-primary" : "border-border"}`}
                >
                  <div
                    className="p-3 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleEval(player.id)}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        photoURL={player.photoURL}
                        name={player.firstName}
                        size={40}
                      />
                      <div>
                        <div className="font-extrabold text-sm text-foreground">
                          {player.firstName} {player.fatherName}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          متوسط: {avg.t}/10
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 border-t border-border bg-muted/20">
                          <div className="mt-4 space-y-5">
                            <div className="space-y-2">
                              <Label className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                                <Activity className="w-3.5 h-3.5" /> التقييم
                                البدني
                              </Label>
                              <ScoreGrid
                                value={formData.physical}
                                onChange={(v) =>
                                  handleEvalChange(player.id, "physical", v)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                                <Dumbbell className="w-3.5 h-3.5" /> التقييم
                                المهاري
                              </Label>
                              <ScoreGrid
                                value={formData.skill}
                                onChange={(v) =>
                                  handleEvalChange(player.id, "skill", v)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                                <Brain className="w-3.5 h-3.5" /> التقييم العقلي
                              </Label>
                              <ScoreGrid
                                value={formData.mental}
                                onChange={(v) =>
                                  handleEvalChange(player.id, "mental", v)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                                <Sparkles className="w-3.5 h-3.5" /> التقييم
                                العام
                              </Label>
                              <ScoreGrid
                                value={formData.general}
                                onChange={(v) =>
                                  handleEvalChange(player.id, "general", v)
                                }
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-extrabold">
                                  تاريخ التقييم
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                  <Input
                                    type="number"
                                    placeholder="اليوم"
                                    value={formData.d}
                                    onChange={(e) =>
                                      handleEvalChange(
                                        player.id,
                                        "d",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 text-xs text-center bg-card"
                                  />
                                  <Input
                                    type="number"
                                    placeholder="الشهر"
                                    value={formData.m}
                                    onChange={(e) =>
                                      handleEvalChange(
                                        player.id,
                                        "m",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 text-xs text-center bg-card"
                                  />
                                  <Input
                                    type="number"
                                    placeholder="السنة"
                                    value={formData.y}
                                    onChange={(e) =>
                                      handleEvalChange(
                                        player.id,
                                        "y",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 text-xs text-center bg-card"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-extrabold">
                                  ملاحظات المدرب
                                </Label>
                                <Textarea
                                  placeholder="ملاحظات..."
                                  value={formData.notes}
                                  onChange={(e) =>
                                    handleEvalChange(
                                      player.id,
                                      "notes",
                                      e.target.value,
                                    )
                                  }
                                  className="h-20 resize-none text-xs bg-card"
                                />
                              </div>
                            </div>

                            <Button
                              onClick={() =>
                                submitEval(player.id, player.fullName)
                              }
                              className="w-full bg-primary hover:bg-primary/90 h-10 rounded-xl text-sm font-bold"
                              disabled={evalSaving === player.id}
                            >
                              {evalSaving === player.id
                                ? "جاري الحفظ..."
                                : "حفظ التقييم"}
                            </Button>
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

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col md:flex-row gap-3"
            style={{ height: "calc(100dvh - 240px)" }}
          >
            <div className="w-full md:w-64 flex md:flex-col gap-2 shrink-0 md:h-full overflow-y-auto pb-2 md:pb-0 scrollbar-none snap-x md:snap-none">
              <button
                onClick={() => setChatType("team")}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-right shrink-0 snap-start w-60 md:w-full border ${chatType === "team" ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted text-foreground"}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${chatType === "team" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}
                >
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm">شات الفريق</div>
                  <div className="text-[10px] opacity-70">جميع اللاعبين</div>
                </div>
              </button>

              <div className="hidden md:block text-[10px] font-extrabold text-muted-foreground px-2 pt-2">
                محادثات اللاعبين
              </div>

              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setChatType(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-right shrink-0 snap-start w-60 md:w-full border ${chatType === p.id ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted text-foreground"}`}
                >
                  <UserAvatar
                    photoURL={p.photoURL}
                    name={p.firstName}
                    size={40}
                  />
                  <div className="truncate">
                    <div className="font-extrabold text-sm truncate">
                      {p.firstName} {p.fatherName}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border bg-muted/30">
                <h3 className="font-extrabold text-sm text-foreground">
                  {chatType === "team"
                    ? "شات الفريق العام"
                    : players.find((p) => p.id === chatType)?.fullName}
                </h3>
              </div>
              <div className="flex-1 min-h-0">
                <Chat
                  messages={chatMessages}
                  currentUserId={user?.uid || ""}
                  currentUserRole="coach"
                  onSendMessage={sendMessage}
                  onDeleteMessage={deleteMessage}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PLAYER MODAL */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedPlayer(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center gap-4 bg-muted/30">
              <UserAvatar
                photoURL={selectedPlayer.photoURL}
                name={selectedPlayer.firstName}
                size={64}
                ring
              />
              <div>
                <h2 className="text-lg font-extrabold text-foreground">
                  {selectedPlayer.fullName}
                </h2>
                <div className="text-xs text-muted-foreground mt-1">
                  تاريخ الميلاد: {selectedPlayer.dob} · هاتف:{" "}
                  <span dir="ltr">{selectedPlayer.phone}</span>
                </div>
              </div>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-6">
              {getPlayerRatings(selectedPlayer.id).length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={getPlayerRatings(selectedPlayer.id)}
                        margin={{ top: 5, right: 0, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(val) => format(new Date(val), "MM/dd")}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          dy={10}
                        />
                        <YAxis
                          domain={[0, 10]}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          dx={-10}
                          width={20}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                          iconType="circle"
                        />
                        <Line type="monotone" dataKey="physical" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="بدني" />
                        <Line type="monotone" dataKey="skill" stroke="#1e88e5" strokeWidth={2.5} dot={{ r: 3 }} name="مهاري" />
                        <Line type="monotone" dataKey="mental" stroke="#7b1fa2" strokeWidth={3} dot={{ r: 4, fill: "#7b1fa2" }} activeDot={{ r: 6 }} name="عقلي" />
                        <Line type="monotone" dataKey="general" stroke="hsl(var(--muted-foreground))" strokeWidth={2.5} dot={{ r: 3 }} name="عام" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-extrabold text-foreground">
                      سجل التقييمات
                    </h3>
                    {getPlayerRatings(selectedPlayer.id)
                      .slice()
                      .reverse()
                      .map((r) => (
                        <div
                          key={r.id}
                          className="bg-muted/30 p-3 rounded-xl border border-border text-sm flex justify-between items-start gap-4"
                        >
                          <div>
                            <div className="font-extrabold text-xs text-muted-foreground">
                              {format(new Date(r.date), "yyyy/MM/dd")}
                            </div>
                            {r.notes && (
                              <div className="mt-1 text-xs">{r.notes}</div>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center bg-background p-1.5 rounded-lg shrink-0 border border-border">
                            <div className="px-1">
                              <div className="text-[9px] text-muted-foreground">بدني</div>
                              <div className="font-extrabold text-primary">{r.physical || 0}</div>
                            </div>
                            <div className="px-1">
                              <div className="text-[9px] text-muted-foreground">مهاري</div>
                              <div className="font-extrabold text-primary">{r.skill || 0}</div>
                            </div>
                            <div className="px-1">
                              <div className="text-[9px] text-muted-foreground">عقلي</div>
                              <div className="font-extrabold text-primary">{r.mental || 0}</div>
                            </div>
                            <div className="px-1">
                              <div className="text-[9px] text-muted-foreground">عام</div>
                              <div className="font-extrabold text-primary">{r.general || 0}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-10">
                  لا توجد تقييمات مسجلة لهذا اللاعب
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border bg-muted/30 text-left">
              <Button
                onClick={() => setSelectedPlayer(null)}
                variant="outline"
                className="text-xs h-9 rounded-lg font-bold"
              >
                إغلاق
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <BottomTabs
        active={activeTab}
        onChange={(id) => setActiveTab(id as any)}
        tabs={[
          { id: "players", label: "اللاعبون", icon: Users },
          { id: "evaluations", label: "التقييم", icon: ClipboardList },
          { id: "chat", label: "التواصل", icon: MessageCircle },
        ]}
      />
    </Layout>
  );
}
