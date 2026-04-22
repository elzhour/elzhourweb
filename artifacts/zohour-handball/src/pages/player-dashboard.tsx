import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Activity,
  Dumbbell,
  Brain,
  Sparkles,
  Users,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { Chat, type ChatMessage } from "@/components/chat";
import {
  setActiveChatPath,
  useNotifications,
  registerFcmForUser,
  broadcastPush,
} from "@/lib/notifications";
import { BottomTabs } from "@/components/bottom-tabs";
import { UserAvatar } from "@/components/user-avatar";

export default function PlayerDashboard() {
  const { user, playerData } = useAuth();
  const { notify } = useNotifications();
  const [ratings, setRatings] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"ratings" | "chat">("ratings");
  const [chatType, setChatType] = useState<"team" | string>("team");

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Register for push when the player logs in
  useEffect(() => {
    if (user) registerFcmForUser(user.uid, "player");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qRatings = query(
      collection(db, "ratings"),
      where("playerId", "==", user.uid),
    );
    const unsubRatings = onSnapshot(
      qRatings,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as any)
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        setRatings(data);
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const r = change.doc.data();
            if (r.createdAt && Date.now() - r.createdAt.toMillis() < 10000) {
              notify(`تم إضافة تقييم جديد من ${r.coachName || "المدرب"}`);
            }
          }
        });
      },
      (err: FirestoreError) => {
        console.warn("Ratings listener error:", err.code);
      },
    );
    return () => unsubRatings();
  }, [user, notify]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "coaches"),
      (snap) => {
        setCoaches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err: FirestoreError) => {
        console.warn("Coaches listener error:", err.code);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    let path = "chats/team/messages";
    if (chatType !== "team") {
      path = `chats/coach_${chatType}_player_${user.uid}/messages`;
    }

    setActiveChatPath(path);

    const q = query(collection(db, path), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ChatMessage,
        );
        setMessages(data);

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
      unsub();
      setActiveChatPath(null);
    };
  }, [user, chatType, notify]);

  const latestRating = ratings.length > 0 ? ratings[ratings.length - 1] : null;

  const sendMessage = async (text: string, replyTo?: ChatMessage["replyTo"]) => {
    if (!user || !playerData) return;
    const path =
      chatType === "team"
        ? "chats/team/messages"
        : `chats/coach_${chatType}_player_${user.uid}/messages`;

    await addDoc(collection(db, path), {
      senderId: user.uid,
      senderName: playerData.firstName,
      senderRole: "player",
      senderPhotoURL: playerData.photoURL || null,
      text,
      replyTo: replyTo || null,
      createdAt: serverTimestamp(),
    });

    // Trigger server-side push
    broadcastPush({
      title: `${playerData.firstName} في ${chatType === "team" ? "شات الفريق" : "محادثة خاصة"}`,
      body: text,
      excludeUid: user.uid,
      scope: chatType === "team" ? "team" : "user",
      recipients: chatType === "team" ? undefined : [{ uid: chatType, role: "coach" }],
    });
  };

  return (
    <Layout withBottomTabs>
      {/* Profile Header */}
      <div className="bg-card border border-border rounded-3xl p-4 mb-4 flex items-center gap-3 shadow-sm">
        <UserAvatar
          photoURL={playerData?.photoURL}
          name={playerData?.firstName}
          size={56}
          ring
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base text-foreground truncate">
            {playerData?.fullName || "لاعب"}
          </h2>
          <p className="text-xs text-muted-foreground">
            مرحباً بك في لوحة التقييم
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "ratings" && (
          <motion.div
            key="ratings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard label="بدني" value={latestRating?.physical} icon={Activity} />
              <ScoreCard label="مهاري" value={latestRating?.skill} icon={Dumbbell} />
              <ScoreCard label="عقلي" value={latestRating?.mental} icon={Brain} />
              <ScoreCard label="عام" value={latestRating?.general} icon={Sparkles} />
            </div>

            <Card className="border border-border shadow-none bg-card">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-extrabold">
                  التطور عبر الزمن
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ratings}
                    margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
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
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      dy={10}
                    />
                    <YAxis
                      domain={[0, 10]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-foreground px-1">
                سجل التقييمات
              </h3>
              {ratings
                .slice()
                .reverse()
                .map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card p-4 rounded-2xl border border-border flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="text-[11px] font-bold bg-muted text-muted-foreground inline-flex px-2 py-1 rounded-md mb-1">
                          {format(new Date(r.date), "yyyy/MM/dd")}
                        </div>
                        {r.coachName && (
                          <div className="text-[11px] text-muted-foreground mt-1">
                            قيّمك المدرب: {r.coachName}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center bg-muted/50 p-2 rounded-xl">
                        <ScorePill label="بدني" value={r.physical} />
                        <ScorePill label="مهاري" value={r.skill} />
                        <ScorePill label="عقلي" value={r.mental} />
                        <ScorePill label="عام" value={r.general} />
                      </div>
                    </div>
                    {r.notes && (
                      <div className="text-xs text-foreground bg-muted/40 p-3 rounded-xl leading-relaxed">
                        {r.notes}
                      </div>
                    )}
                  </motion.div>
                ))}
              {ratings.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-10 bg-card rounded-2xl border border-border">
                  لا توجد تقييمات بعد
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col"
            style={{ height: "calc(100dvh - 240px)" }}
          >
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setChatType("team")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-colors ${chatType === "team" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}
              >
                <Users className="w-4 h-4" />
                شات الفريق
              </button>

              {coaches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChatType(c.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${chatType === c.id ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}
                >
                  <UserAvatar photoURL={c.photoURL} name={c.name} size={22} />
                  {c.name || "المدرب"}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0">
              <Chat
                messages={messages}
                currentUserId={user?.uid || ""}
                currentUserRole="player"
                onSendMessage={sendMessage}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomTabs
        active={activeTab}
        onChange={(id) => setActiveTab(id as any)}
        tabs={[
          { id: "ratings", label: "التقييمات", icon: BarChart3 },
          { id: "chat", label: "التواصل", icon: MessageCircle },
        ]}
      />
    </Layout>
  );
}

function ScoreCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border border-border shadow-none bg-card">
      <CardHeader className="pb-2 pt-3 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] text-muted-foreground font-bold">
          {label}
        </CardTitle>
        <Icon className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="text-2xl font-extrabold">
          {value || 0}
          <span className="text-xs text-muted-foreground/60">/10</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="px-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-extrabold text-primary text-sm">{value || 0}</div>
    </div>
  );
}
