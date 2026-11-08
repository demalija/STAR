import { readDocument, writeDocument } from './storage';
import { defaultContent, validateContent, type SiteContent } from './content-schema';

export async function getSiteContent():Promise<SiteContent> {
  const saved = await readDocument<Partial<SiteContent>>('site-content', {});
  return validateContent({...defaultContent,...saved});
}
export async function saveSiteContent(value:unknown):Promise<SiteContent> {
  const content=validateContent(value);
  await writeDocument('site-content',content);
  return content;
}
