"use client";

import Image from "next/image";
import { getAsset } from "@/lib/data/assetManifest";

interface Props {
  /** Manifest reference like "building.guildCore" or "resource.bloomEssence". */
  assetId: string;
  /** Accessible alt text. */
  alt: string;
  /** Next.js Image sizes hint. */
  sizes?: string;
  /** Width hint for the renderer. Required for non-fill mode. */
  width?: number;
  /** Height hint for the renderer. Required for non-fill mode. */
  height?: number;
  /** When true, image fills its parent (parent must be `relative`). */
  fill?: boolean;
  /** Extra Tailwind class names. */
  className?: string;
  /** Background tint for the placeholder card (hex). */
  placeholderColor?: string;
  /** Short label drawn in the placeholder. Defaults to the asset id tail. */
  placeholderLabel?: string;
  /** When true, draggable=false on the rendered img (for card UI). */
  notDraggable?: boolean;
}

/**
 * Renders an asset from the manifest.
 *   - status === "final" or "generated"  → renders the real image
 *   - status === "placeholder" OR unknown → renders a styled placeholder
 * Components never reach for `/icons/...` directly; they pass an assetId.
 */
export function AssetImage({
  assetId,
  alt,
  sizes,
  width,
  height,
  fill = false,
  className = "",
  placeholderColor,
  placeholderLabel,
  notDraggable = false,
}: Props) {
  const entry = getAsset(assetId);
  const hasFile = !!entry && entry.status !== "placeholder";

  if (hasFile) {
    if (fill) {
      return (
        <Image
          src={entry.path}
          alt={alt}
          fill
          sizes={sizes ?? "100px"}
          className={`object-contain ${className}`}
          draggable={notDraggable ? false : undefined}
          onError={() => {
            console.error(`[AssetImage] failed to load ${assetId} (${entry.path})`);
          }}
        />
      );
    }
    return (
      <Image
        src={entry.path}
        alt={alt}
        width={width ?? 64}
        height={height ?? 64}
        sizes={sizes}
        className={className}
        draggable={notDraggable ? false : undefined}
        onError={() => {
          console.error(`[AssetImage] failed to load ${assetId} (${entry.path})`);
        }}
      />
    );
  }

  // Placeholder fallback. Doesn't crash, doesn't show a broken image.
  const label =
    placeholderLabel ??
    (assetId.split(".").at(-1) ?? assetId)
      .replace(/([A-Z])/g, " $1")
      .trim();
  const initials = label
    .split(/[\s-]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join("")
    .toUpperCase();

  const bg = placeholderColor ?? "#3a2d1f";
  const ringColor = `${bg}aa`;

  if (fill) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center rounded-md ${className}`}
        aria-label={alt}
        style={{
          background: `radial-gradient(circle at 50% 35%, ${bg}cc, ${bg}55 70%, ${bg}22)`,
          boxShadow: `inset 0 0 0 1px ${ringColor}`,
        }}
      >
        <span
          className="font-display text-lg font-bold leading-none tracking-wider text-bg-deep/90"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          {initials}
        </span>
      </div>
    );
  }
  const dimW = width ?? 64;
  const dimH = height ?? 64;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md ${className}`}
      style={{
        width: dimW,
        height: dimH,
        background: `radial-gradient(circle at 50% 35%, ${bg}cc, ${bg}55 70%, ${bg}22)`,
        boxShadow: `inset 0 0 0 1px ${ringColor}`,
      }}
      aria-label={alt}
    >
      <span
        className="font-display text-sm font-bold leading-none tracking-wider text-bg-deep/90"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        {initials}
      </span>
    </div>
  );
}
