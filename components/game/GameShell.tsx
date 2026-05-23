import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { ActionButtons } from "./ActionButtons";
import { BottomNav } from "./BottomNav";
import { SplashScreen } from "./SplashScreen";
import { BuildMenu } from "./BuildMenu";

export function GameShell() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-bg-mid to-bg-deep">
      <SplashScreen />

      <ResourceBar />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-28 pt-6 md:max-w-3xl md:gap-8 md:pt-10">
        <BaseGrid />
        <ActionButtons />
      </main>

      <BottomNav />

      <BuildMenu />
    </div>
  );
}
