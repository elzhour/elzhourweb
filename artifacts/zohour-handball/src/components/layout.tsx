import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./user-avatar";

export function Layout({
  children,
  withBottomTabs = false,
}: {
  children: React.ReactNode;
  withBottomTabs?: boolean;
}) {
  const { profile, playerData } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    signOut(auth);
  };

  const photoURL =
    (profile as any)?.photoURL || (playerData as any)?.photoURL || null;
  const displayName = profile?.name || playerData?.firstName || "حسابي";

  return (
    <div className={`min-h-[100dvh] flex flex-col bg-background relative ${withBottomTabs ? "has-bottom-tabs" : ""}`}>
      <header className="sticky top-0 z-40 w-full glass">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.jpg"
              alt="Logo"
              className="w-9 h-9 rounded-full ring-2 ring-primary/20"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-extrabold leading-tight text-foreground">
                مركز شباب الزهور
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight font-semibold">
                كرة يد · مواليد 2010
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none rounded-full focus:ring-2 focus:ring-primary/30">
                  <UserAvatar photoURL={photoURL} name={displayName} size={36} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="text-xs font-bold truncate">{displayName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {profile.email}
                    </div>
                  </div>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive gap-2 rounded-lg cursor-pointer font-semibold text-xs mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل خروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-5xl mx-auto px-4 py-6 flex flex-col">
        {children}
      </main>

      <footer className="w-full py-3 text-center pointer-events-none select-none">
        <span
          className="text-xs sm:text-sm text-foreground/80 tracking-wide"
          style={{ fontFamily: '"Dancing Script", "Pacifico", "Segoe Script", cursive' }}
        >
          made by seif kamel
        </span>
      </footer>
    </div>
  );
}
