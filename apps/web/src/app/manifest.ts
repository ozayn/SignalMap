import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SignalMap",
    short_name: "SignalMap",
    description: "Longitudinal studies of emotion, language, and interaction",
    start_url: "/",
    display: "standalone",
    background_color: "#5b6cf2",
    theme_color: "#5b6cf2",
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
