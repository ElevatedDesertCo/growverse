import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { BottomNav } from "./BottomNav";
import { SplashScreen } from "./SplashScreen";
import { BuildMenu } from "./BuildMenu";
import { TickMount } from "./TickMount";

export function GameShell() {
  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-bg-mid to-bg-deep">
      <SplashScreen />
      <TickMount />

      <ResourceBar />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-2 sm:px-4">
        <BaseGrid />
      </main>

      <BottomNav />

      <BuildMenu />
    </div>
  );
}
