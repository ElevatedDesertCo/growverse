"use client";

import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { hasRealAsset } from "@/lib/data/assetManifest";
import { AssetImage } from "./AssetImage";

interface Props {
  /** Manifest ref, e.g. "ui.actionBuild". */
  assetId: string;
  /** Accessible alt / aria-label for the painted version. */
  alt: string;
  /**
   * Lucide fallback rendered until the painted PNG lands and the manifest
   * status is flipped to "final" / "generated". If omitted, nothing renders
   * until the real asset is present — useful for decorative slots.
   */
  fallback?: LucideIcon;
  /** Pixel size of the rendered icon (square). */
  size?: number;
  className?: string;
  /** Lucide stroke weight when the fallback is rendered. */
  strokeWidth?: number;
  /** Inline style on the fallback icon (rarely needed). */
  style?: CSSProperties;
}

/**
 * Renders the painted PNG when the manifest entry is real
 * (status === "final" or "generated"); otherwise renders the Lucide
 * fallback (if provided), or nothing.
 *
 * Components don't need to know whether the art has shipped — they wire
 * to this and the right thing renders.
 */
export function ActionIcon({
  assetId,
  alt,
  fallback: Fallback,
  size = 20,
  className = "",
  strokeWidth = 2.25,
  style,
}: Props) {
  if (hasRealAsset(assetId)) {
    return (
      <AssetImage
        assetId={assetId}
        alt={alt}
        width={size}
        height={size}
        className={className}
        notDraggable
      />
    );
  }
  if (!Fallback) return null;
  return (
    <Fallback
      className={className}
      strokeWidth={strokeWidth}
      style={{ width: size, height: size, ...style }}
      aria-label={alt}
    />
  );
}
