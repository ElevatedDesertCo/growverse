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
import { MusicMount } from "./MusicMount";
import { StatsMount } from "./StatsMount";
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
      {/* Background parallax — three slow-drifting nebula spots that
          slide diagonally over a minute. Pure CSS, no scroll listener,
          GPU-cheap. Sits behind the HUD + playfield. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-50"
        aria-hidden
      >
        <div
          className="absolute -inset-[10%] bg-no-repeat"
          style={{
            backgroundImage: [
              "radial-gradient(circle 22% at 30% 35%, rgba(127,176,105,0.10) 0%, transparent 60%)",
              "radial-gradient(circle 18% at 75% 60%, rgba(168,117,212,0.12) 0%, transparent 60%)",
              "radial-gradient(circle 25% at 50% 85%, rgba(232,150,76,0.10) 0%, transparent 60%)",
            ].join(","),
            backgroundSize: "100% 100%",
            animation: "growverse-parallax 90s linear infinite",
          }}
        />
        <style>{`
          @keyframes growverse-parallax {
            0%   { transform: translate3d(0%, 0%, 0); }
            50%  { transform: translate3d(-3%, 2%, 0); }
            100% { transform: translate3d(0%, 0%, 0); }
          }
        `}</style>
      </div>
      {/* Subtle vignette around the playfield */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 140px 30px rgba(0,0,0,0.55)",
        }}
        aria-hidden
      />

      <SplashScreen />
      <TickMount />
      <MusicMount />
      <StatsMount />
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
      <EditModeHint />
      <WelcomeBackToast />
      <ToastStack />
    </div>
  );
}
