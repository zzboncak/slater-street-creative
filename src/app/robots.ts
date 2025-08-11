import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL || "https://slaterstreetcreative.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/cart",
          "/api/",
          "/login",
          "/signup",
          "/thank-you",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
