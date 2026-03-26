import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/create",
          "/editor",
          "/settings",
          "/sign-in",
          "/sign-up",
          "/api/",
        ],
      },
    ],
    sitemap: "https://bookclad.com/sitemap.xml",
  };
}
