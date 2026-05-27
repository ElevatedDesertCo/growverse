import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { BottomNav } from "./BottomNav";
import { SplashScreen } from "./SplashScreen";
import { BuildMenu } from "./BuildMenu";
import { TickMount } from "./TickMount";
import { UpgradeModal } from "./UpgradeModal";
import { WelcomeBackToast } from "./WelcomeBackToast";
import { ToastStack } from "./ToastStack";
import { ComingSoonModal } from "./ComingSoonModal";
import { DailyRewardModal } from "./DailyRewardModal";
import { EditModeHint } from "./EditModeHint";
import { EditModeOverlay } from "./EditModeOverlay";
import { Fireflies } from "./Fireflies";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { MusicMount } from "./MusicMount";
import { ParallaxLayer } from "./ParallaxLayer";
import { StatsMount } from "./StatsMount";
import { StreakWatcher } from "./StreakWatcher";
import { SWRegister } from "./SWRegister";
import { WelcomeModal } from "./WelcomeModal";

export function GameShell() {
  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 30%, #2a1a10 0%, #1a0f08 50%, #0f0a06 100%)",
      }}
    >
      {/* Ambient gold haze top-center to anchor the HUD optically */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(212,160,74,0.18) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      {/* Slow-drifting nebula parallax (respects reduced-motion). */}
      <ParallaxLayer />
      {/* Subtle vignette around the playfield */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 140px 30px rgba(0,0,0,0.55)",
        }}
        aria-hidden
      />

      <Fireflies />

      <SplashScreen />
      <TickMount />
      <MusicMount />
      <StatsMount />
      <StreakWatcher />
      <KeyboardShortcuts />
      <SWRegister />

      <ResourceBar />

      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] pt-3 sm:px-5 md:pt-5">
        <BaseGrid />
      </main>

      <BottomNav />

      <BuildMenu />
      <UpgradeModal />
      <ComingSoonModal />
      <DailyRewardModal />
      <WelcomeModal />
      <EditModeOverlay />
      <EditModeHint />
      <WelcomeBackToast />
      <ToastStack />
    </div>
  );
}
