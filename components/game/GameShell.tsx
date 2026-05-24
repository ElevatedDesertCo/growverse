import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { ActionButtons } from "./ActionButtons";
import { BottomNav } from "./BottomNav";
import { SplashScreen } from "./SplashScreen";
import { BuildMenu } from "./BuildMenu";

export function GameShell() {
  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-bg-mid to-bg-deep">
      <SplashScreen />

      <ResourceBar />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 pb-[calc(env(safe-area-inset-bottom)+4rem)] pt-2 sm:gap-4 sm:px-4">
        <BaseGrid />
        <ActionButtons />
      </main>

      <BottomNav />

      <BuildMenu />
    </div>
  );
}
