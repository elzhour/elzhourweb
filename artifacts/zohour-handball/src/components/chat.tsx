import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Send, Reply, X, ChevronDown, Trash2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { UserAvatar } from "./user-avatar";

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: "coach" | "player";
  senderPhotoURL?: string | null;
  createdAt: any;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
}

interface ChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserRole?: "coach" | "player";
  onSendMessage: (text: string, replyTo?: ChatMessage["replyTo"]) => Promise<void>;
  onDeleteMessage?: (id: string) => Promise<void>;
  title?: string;
}

export function Chat({ messages, currentUserId, currentUserRole, onSendMessage, onDeleteMessage, title }: ChatProps) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wasAtBottomRef = useRef(true);
  const lastCountRef = useRef(messages.length);
  const initialScrollDoneRef = useRef(false);

  // Track scroll position to determine if user is at bottom
  const checkAtBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom < 80;
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Initial scroll to bottom on first paint
  useLayoutEffect(() => {
    if (!initialScrollDoneRef.current && messages.length > 0) {
      scrollToBottom(false);
      initialScrollDoneRef.current = true;
      wasAtBottomRef.current = true;
    }
  }, [messages.length]);

  // Smart auto-scroll: only when user was already at bottom OR sender is current user
  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      const newest = messages[messages.length - 1];
      const isOwn = newest && newest.senderId === currentUserId;
      if (wasAtBottomRef.current || isOwn) {
        scrollToBottom(true);
      } else {
        setShowJumpButton(true);
      }
    }
    lastCountRef.current = messages.length;
  }, [messages, currentUserId]);

  const handleScroll = () => {
    const atBottom = checkAtBottom();
    wasAtBottomRef.current = atBottom;
    if (atBottom) setShowJumpButton(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const toSend = text;
    const replyData = replyTo
      ? {
          id: replyTo.id,
          text: replyTo.text,
          senderName: replyTo.senderName,
        }
      : null;
    setText("");
    setReplyTo(null);
    wasAtBottomRef.current = true;
    await onSendMessage(toSend, replyData);
  };

  const jumpToReply = (id: string) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary");
      }, 1400);
    }
  };

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden border border-border relative"
      style={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
    >
      {/* Fixed watermark logo (does NOT scroll with messages) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-no-repeat bg-center"
        style={{
          backgroundImage: "url(/logo.jpg)",
          backgroundSize: "min(280px, 60%)",
          opacity: 0.06,
          filter: "grayscale(100%)",
        }}
      />

      {/* Messages scroll area (transparent so the fixed watermark shows through) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10"
        style={{ scrollBehavior: "auto" }}
      >
        <div className="space-y-2">
          {messages.length === 0 && (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
              ابدأ المحادثة الآن
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.senderId === currentUserId;
            const isCoach = msg.senderRole === "coach";
            const prev = messages[i - 1];
            const showAvatar = !isMe && (!prev || prev.senderId !== msg.senderId);
            const showHeader = !isMe && (!prev || prev.senderId !== msg.senderId);

            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                key={msg.id}
                className={`group flex gap-2 max-w-[85%] ${
                  isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar gutter */}
                {!isMe && (
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      <UserAvatar
                        photoURL={msg.senderPhotoURL}
                        name={msg.senderName}
                        size={32}
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col min-w-0 max-w-full">
                  {showHeader && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-foreground">
                        {msg.senderName}
                      </span>
                      {isCoach && (
                        <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                          مدرب
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {/* Action buttons: Reply (everyone) + Delete (coach only) */}
                    <div
                      className={`flex items-center gap-1 shrink-0 ${
                        isMe ? "" : "order-2"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setReplyTo(msg)}
                        className="w-7 h-7 rounded-full bg-background/95 border border-border flex items-center justify-center text-muted-foreground hover:text-primary active:scale-90 transition-all shadow-sm"
                        aria-label="رد"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      {currentUserRole === "coach" && onDeleteMessage && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              window.confirm(
                                "هل تريد حذف هذه الرسالة نهائياً؟",
                              )
                            ) {
                              await onDeleteMessage(msg.id);
                            }
                          }}
                          className="w-7 h-7 rounded-full bg-background/95 border border-border flex items-center justify-center text-muted-foreground hover:text-red-600 active:scale-90 transition-all shadow-sm"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div
                      ref={(el) => {
                        messageRefs.current[msg.id] = el;
                      }}
                      className={`relative px-3.5 py-2 text-sm shadow-sm transition-all rounded-2xl ${
                        isMe
                          ? "bg-white text-[#0a192f] rounded-tr-md border border-primary/20 dark:bg-zinc-100 dark:text-[#0a192f]"
                          : "bg-white text-[#0a192f] rounded-tl-md border border-border dark:bg-zinc-100 dark:text-[#0a192f]"
                      }`}
                    >
                      {/* Reply quote inside the bubble */}
                      {msg.replyTo && (
                        <button
                          type="button"
                          onClick={() => jumpToReply(msg.replyTo!.id)}
                          className="block w-full text-right mb-1.5 pr-2 border-r-2 border-primary bg-primary/5 rounded-md py-1 px-2 hover:bg-primary/10 transition-colors"
                        >
                          <div className="text-[10px] font-extrabold text-primary truncate">
                            {msg.replyTo.senderName}
                          </div>
                          <div className="text-[11px] text-[#0a192f]/70 truncate">
                            {msg.replyTo.text}
                          </div>
                        </button>
                      )}

                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {msg.text}
                      </p>
                      <div className="text-[10px] mt-0.5 text-end opacity-50">
                        {msg.createdAt
                          ? format(msg.createdAt.toDate(), "HH:mm")
                          : format(new Date(), "HH:mm")}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Jump-to-bottom button */}
      <AnimatePresence>
        {showJumpButton && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => {
              scrollToBottom(true);
              setShowJumpButton(false);
            }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            aria-label="النزول لأسفل"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reply preview above input */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-muted/60 border-t border-border"
          >
            <div className="p-2.5 flex items-center gap-2">
              <div className="w-1 self-stretch bg-primary rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-extrabold text-primary">
                  رد على {replyTo.senderName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {replyTo.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="w-7 h-7 rounded-full hover:bg-background flex items-center justify-center text-muted-foreground"
                aria-label="إلغاء الرد"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 bg-card border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `الرد على ${replyTo.senderName}...` : "اكتب رسالة..."}
            className="flex-1 rounded-full bg-muted border-transparent focus-visible:ring-1 focus-visible:bg-background h-11 px-4 text-sm"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim()}
            className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-40"
          >
            <Send className="w-4 h-4 rtl:-scale-x-100" />
          </Button>
        </form>
      </div>
    </div>
  );
}
