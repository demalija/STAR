import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap {
 return process.env.APP_URL?[{url:new URL('/',process.env.APP_URL).href,changeFrequency:'weekly',priority:1}]:[];
}
