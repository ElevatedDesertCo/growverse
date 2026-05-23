import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { ActionButtons } from "./ActionButtons";
import { BottomNav } from "./BottomNav";

export function GameShell() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-bg-mid to-bg-deep">
      <ResourceBar />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-28 pt-6">
        <BaseGrid />
        <ActionButtons />
      </main>

      <BottomNav />
    </div>
  );
}
