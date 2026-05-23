import Image from "next/image";
import { ResourceBar } from "./ResourceBar";
import { BaseGrid } from "./BaseGrid";
import { ActionButtons } from "./ActionButtons";
import { BottomNav } from "./BottomNav";

export function GameShell() {
  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="fixed inset-0 -z-10">
        <Image
          src="/brand/growverse-splash.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-mid/85 via-bg-deep/82 to-bg-deep/95" />
      </div>

      <ResourceBar />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-28 pt-6">
        <BaseGrid />
        <ActionButtons />
      </main>

      <BottomNav />
    </div>
  );
}
