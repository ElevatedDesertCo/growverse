"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { getAsset } from "@/lib/data/assetManifest";
import { chromaKeyCached, chromaKeyImage } from "@/lib/systems/chromaKey";

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

  // Chroma-key path resolution. If the entry opted in, render with the
  // processed data URL (transparent corners) instead of the raw path.
  // For focus-cropped entries we also pre-crop on the canvas + chroma-
  // key the inner panel's beige background, returning a tight data URL
  // that no longer needs the CSS focus-crop path.
  const rawPath = entry?.path ?? "";
  const focus = entry?.focus;
  const wantsChroma = !!entry?.chromaKey && hasFile;
  const [chromaUrl, setChromaUrl] = useState<string | null>(
    wantsChroma
      ? chromaKeyCached(rawPath, focus, entry?.chromaTolerance)
      : null,
  );
  useEffect(() => {
    if (!wantsChroma) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (chromaUrl !== null) setChromaUrl(null);
      return;
    }
    const cached = chromaKeyCached(rawPath, focus, entry?.chromaTolerance);
    if (cached) {
      if (cached !== chromaUrl) setChromaUrl(cached);
      return;
    }
    let cancelled = false;
    chromaKeyImage(rawPath, {
      focus,
      tolerance: entry?.chromaTolerance,
    }).then((url) => {
      if (!cancelled) setChromaUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // chromaUrl intentionally omitted from deps so we don't loop on set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsChroma, rawPath, focus?.x, focus?.y, focus?.w, focus?.h]);
  const resolvedPath = wantsChroma && chromaUrl ? chromaUrl : rawPath;
  // When chroma succeeded with a focus crop, the resulting data URL is
  // already the cropped region — skip the CSS focus path entirely.
  const useFocusCss = !!focus && !(wantsChroma && chromaUrl);

  if (hasFile) {
    // Sprite-sheet crop: show only the focal sub-region. We scale the
    // image so focus.w/h map to 100% of the slot, then position so the
    // focal point aligns with the slot's top-left.
    //
    // CSS background-position % is computed as `% of (container - image)`
    // when the image is larger than the container — so for an oversized
    // bg-image, the percentage flips sign relative to the naive
    // `(-focus.x * 100) / focus.w` formula. Correct form below.
    if (useFocusCss && entry.focus) {
      const f = entry.focus;
      const scaleW = 100 / f.w;
      const scaleH = 100 / f.h;
      const posX = (f.x / (1 - f.w)) * 100;
      const posY = (f.y / (1 - f.h)) * 100;
      const cropStyle: CSSProperties = {
        backgroundImage: `url(${resolvedPath})`,
        backgroundSize: `${scaleW}% ${scaleH}%`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: "no-repeat",
      };
      if (fill) {
        return (
          <div
            aria-label={alt}
            className={`h-full w-full ${className}`}
            style={cropStyle}
          />
        );
      }
      return (
        <div
          aria-label={alt}
          className={className}
          style={{
            width: width ?? 64,
            height: height ?? 64,
            ...cropStyle,
          }}
        />
      );
    }

    // Use unoptimized for chroma-keyed data URLs (Next/Image doesn't
    // optimize data: URLs); otherwise let Next.js do its thing.
    const isDataUrl = resolvedPath.startsWith("data:");
    if (fill) {
      return (
        <Image
          src={resolvedPath}
          alt={alt}
          fill
          sizes={sizes ?? "100px"}
          className={`object-contain ${className}`}
          draggable={notDraggable ? false : undefined}
          unoptimized={isDataUrl}
          onError={() => {
            console.error(`[AssetImage] failed to load ${assetId} (${rawPath})`);
          }}
        />
      );
    }
    return (
      <Image
        src={resolvedPath}
        alt={alt}
        width={width ?? 64}
        height={height ?? 64}
        sizes={sizes}
        className={className}
        draggable={notDraggable ? false : undefined}
        unoptimized={isDataUrl}
        onError={() => {
          console.error(`[AssetImage] failed to load ${assetId} (${rawPath})`);
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
  // Two-stop gradient with a soft highlight at the top for depth, plus a
  // thin inner ring and a subtle outer halo so placeholders read as proper
  // crests rather than flat swatches.
  const placeholderStyle: CSSProperties = {
    background: `radial-gradient(circle at 50% 28%, ${bg}f2 0%, ${bg}88 55%, ${bg}33 90%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px ${bg}cc, 0 0 12px -4px ${bg}66`,
  };
  const labelClass =
    "font-display font-bold leading-none tracking-wider text-bg-deep/95";
  const labelShadow = {
    textShadow: "0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.35)",
  } as CSSProperties;

  if (fill) {
    return (
      <div
        className={`relative flex h-full w-full flex-col items-center justify-center rounded-md ${className}`}
        aria-label={alt}
        style={placeholderStyle}
      >
        <span
          className={`${labelClass} text-lg`}
          style={{ fontFamily: "var(--font-cinzel)", ...labelShadow }}
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
      className={`relative flex flex-col items-center justify-center rounded-md ${className}`}
      style={{ width: dimW, height: dimH, ...placeholderStyle }}
      aria-label={alt}
    >
      <span
        className={`${labelClass} text-sm`}
        style={{ fontFamily: "var(--font-cinzel)", ...labelShadow }}
      >
        {initials}
      </span>
    </div>
  );
}
