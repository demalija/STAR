export interface SiteContent {
  brandName: string; tagline: string; announcement: string;
  heroEyebrow: string; heroTitle: string; heroHighlight: string; heroDescription: string; heroButton: string;
  storyEyebrow: string; storyTitle: string; storyHighlight: string; storyParagraph1: string; storyParagraph2: string;
  footerTagline: string; contactEmail: string; seoTitle: string; seoDescription: string;
  certificateTitle: string; certificateSubtitle: string;
  howHeading: string; howHighlight: string; occasionsHeading: string; occasionsHighlight: string;
  faqHeading: string; faqHighlight: string; finalHeading: string; finalHighlight: string;
  acceptingDedications: boolean; maintenanceMode: boolean; maintenanceMessage: string;
  occasions: {title: string; subtitle: string; occasion: string}[];
  steps: {title: string; text: string}[];
  faqs: {question: string; answer: string}[];
}

export const defaultContent: SiteContent = {
  brandName: 'Asteria', tagline: 'A little piece of forever',
  announcement: 'For the ones who make your universe a little brighter.',
  heroEyebrow: 'ORDINARY PEOPLE. EXTRAORDINARY LOVE.', heroTitle: 'Some gifts are\nwritten in', heroHighlight: 'the stars.',
  heroDescription: 'For the person who means your whole world.\nName a star, write your heart, and give them\na little piece of forever.', heroButton: 'Find their star',
  storyEyebrow: 'A SMALL IDEA. AN ENDLESS SKY.', storyTitle: 'Because the best gifts\naren’t really', storyHighlight: 'things.',
  storyParagraph1: 'They’re a feeling. A moment. A quiet way of saying you matter more than words can hold.',
  storyParagraph2: 'We made Asteria for those moments. To turn the things in your heart into something you can give. A symbolic star dedication, a personal story, a little corner of the universe that feels like theirs.',
  footerTagline: 'Little gestures. Cosmic feelings.', contactEmail: '',
  seoTitle: 'Asteria — A little piece of forever', seoDescription: 'Name a star for someone who lights up your world. Create a personal dedication, a beautiful keepsake, and a little magic to unwrap.',
  certificateTitle: 'A celestial dedication', certificateSubtitle: 'A symbolic dedication, written in the stars.',
  howHeading: 'A little thought.', howHighlight: 'A whole lot of magic.', occasionsHeading: 'Big feelings.', occasionsHighlight: 'Infinite possibilities.',
  faqHeading: 'A few things', faqHighlight: 'you might wonder.', finalHeading: 'Someone is your whole universe.', finalHighlight: 'Let them know.',
  acceptingDedications: true, maintenanceMode: false, maintenanceMessage: 'We’re making a little more magic. Please come back soon.',
  occasions: [
    {title:'For your person',subtitle:'A love with no earthly limits.',occasion:'Love & anniversary'},
    {title:'For a new beginning',subtitle:'Little arrivals. Infinite possibilities.',occasion:'A new beginning'},
    {title:'For a forever memory',subtitle:'Some lights never leave us.',occasion:'In loving memory'},
  ],
  steps: [
    {title:'Find their forever star',text:'Choose a name that means something. Their name, your nickname, a tiny inside joke.'},
    {title:'Put your heart into words',text:'A love letter. A thank you. The words you’ve been meaning to say. Make it theirs.'},
    {title:'Send a little wonder',text:'Share their secret gift link. Let them unwrap a star, a story, and a feeling they’ll never forget.'},
  ],
  faqs: [
    {question:'What does naming a star mean?',answer:'It is a beautiful symbolic dedication to someone special. Asteria is an independent keepsake experience; star names are not recognized by the International Astronomical Union. Your star map and celestial details are artistic illustrations, made to hold your story.'},
    {question:'What will my person receive?',answer:'A personal gift link that opens with a little unwrapping magic, their named star, your dedication, and an elegant keepsake certificate they can download as a PDF or print.'},
    {question:'Can I write my own dedication?',answer:'Of course. Add their name, choose a name for their star, and write up to 1,200 characters from the heart. You can preview everything before creating your gift.'},
    {question:'How do I send my gift?',answer:'After creating your dedication, copy your private gift link and send it however you like. There is no automatic email delivery, so you choose the perfect moment.'},
  ],
};

export class ContentValidationError extends Error {}
export function validateContent(input: unknown): SiteContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ContentValidationError('Please provide website content.');
  const source = input as Record<string, unknown>;
  const result = structuredClone(defaultContent);
  const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
  for (const [key, fallback] of Object.entries(defaultContent)) {
    if (typeof fallback === 'string') {
      const value = source[key];
      const max = ['storyParagraph1','storyParagraph2','heroDescription','maintenanceMessage'].includes(key) ? 1800 : key==='seoDescription'?320:240;
      if (typeof value !== 'string' || (key!=='contactEmail'&&!value.trim()) || value.length>max || controls.test(value)) throw new ContentValidationError(`Check ${key}: use plain text up to ${max} characters.`);
      if (key==='contactEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ContentValidationError('Enter a valid contact email address.');
      (result as unknown as Record<string,unknown>)[key]=value.trim();
    } else if (typeof fallback === 'boolean') {
      if (typeof source[key] !== 'boolean') throw new ContentValidationError(`Check the ${key} setting.`);
      (result as unknown as Record<string,unknown>)[key]=source[key];
    }
  }
  function items(key:'occasions'|'steps'|'faqs', fields:string[], maxText:number) {
    const value=source[key];
    if (!Array.isArray(value) || (key==='faqs'?(value.length<1||value.length>10):value.length!==3)) throw new ContentValidationError(key==='faqs'?'Keep between 1 and 10 FAQs.':`Provide exactly three ${key}.`);
    return value.map(item=>{
      if (!item || typeof item!=='object'||Array.isArray(item)) throw new ContentValidationError(`Check your ${key}.`);
      const result:Record<string,string>={};
      for (const field of fields) { const text=(item as Record<string,unknown>)[field];if(typeof text!=='string'||!text.trim()||text.length>maxText||controls.test(text))throw new ContentValidationError(`Check ${key} ${field}: use 1–${maxText} characters.`);result[field]=text.trim(); }
      return result;
    });
  }
  result.occasions=items('occasions',['title','subtitle','occasion'],160) as SiteContent['occasions'];
  result.steps=items('steps',['title','text'],600) as SiteContent['steps'];
  result.faqs=items('faqs',['question','answer'],1800) as SiteContent['faqs'];
  return result;
}
