import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growverse",
    short_name: "Growverse",
    description: "A mystical base-building grow simulator",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0a06",
    theme_color: "#0f0a06",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
