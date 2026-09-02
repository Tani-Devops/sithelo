import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sithelo.co.za";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/entrepreneur",
        "/entrepreneur/",
        "/institution",
        "/institution/",
        "/passport",
        "/passport/",
        "/api",
        "/api/",
        "/auth",
        "/auth/",
        "/register/check-email",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
