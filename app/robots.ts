import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots {
 return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/gift/']},...(process.env.APP_URL?{sitemap:new URL('/sitemap.xml',process.env.APP_URL).href}:{})};
}
