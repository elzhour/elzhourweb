import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";

import SplashLogin from "@/pages/splash-login";
import SelectPortal from "@/pages/select-portal";
import PlayerSetup from "@/pages/player-setup";
import CoachAuth from "@/pages/coach-auth";
import PlayerDashboard from "@/pages/player-dashboard";
import CoachDashboard from "@/pages/coach-dashboard";
import { ensureOneSignal } from "@/lib/onesignal";
import { useEffect } from "react";

const queryClient = new QueryClient();

function AppInit() {
  useEffect(() => {
    // Initialize OneSignal early; permission is requested when the
    // player reaches their dashboard.
    ensureOneSignal();
  }, []);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={SplashLogin} />
      <Route path="/select-portal" component={SelectPortal} />
      <Route path="/player-setup" component={PlayerSetup} />
      <Route path="/coach-auth" component={CoachAuth} />
      <Route path="/player" component={PlayerDashboard} />
      <Route path="/coach" component={CoachDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <AppInit />
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster dir="rtl" position="top-center" theme="system" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
