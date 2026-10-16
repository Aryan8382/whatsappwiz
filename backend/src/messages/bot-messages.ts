export type BotViewMode = 'grid' | 'list' | 'carousel';

export interface CatalogResource {
  name?: string;
  title?: string;
  label?: string;
  url?: string;
  href?: string;
}

export interface CatalogProduct {
  id?: string | number;
  name?: string;
  title?: string;
  keywords?: unknown;
  tags?: unknown;
  description?: string;
  category?: string;
  brand?: string;
  images?: unknown;
  videos?: unknown;
  documents?: unknown;
  resources?: unknown;
  price?: number | string;
  currency?: string;
  image?: string;
  [key: string]: unknown;
}

export type BotButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'LOCATION';

export interface BotButton {
  id?: string;
  type: BotButtonType;
  text: string;
  value?: string; // URL or phone number; unused for QUICK_REPLY
}

export interface BotConfig {
  companyName?: string;
  greeting?: string;
  footer?: string;
  headerType?: 'None' | 'Image' | 'Video' | 'Document';
  headerMediaUrl?: string;
  products?: CatalogProduct[];
  buttons?: BotButton[];
}

export interface ContentSection {
  kind: 'images' | 'documents' | 'videos' | 'resources';
  title: string;
  icon: string;
  items: string[];
}

export interface BotUiMessage {
  type: 'text' | 'product-list' | 'product-images' | 'content-results';
  text?: string;
  buttons?: BotButton[];
  footer?: string;
  headerType?: BotConfig['headerType'];
  headerMediaUrl?: string;
  products?: CatalogProduct[];
  viewMode?: BotViewMode;
  productName?: string;
  productImages?: string[];
  productVideos?: string[];
  productDocuments?: string[];
  productResources?: string[];
  productPrice?: number;
  productCurrency?: string;
  productDescription?: string;
  matchedKeywords?: string[];
  contentSections?: ContentSection[];
}

export interface CatalogSearchResult {
  matchedKeywords: string[];
  matchedProducts: CatalogProduct[];
  images: string[];
  documents: string[];
  videos: string[];
  resources: string[];
}

interface ScoredProduct {
  product: CatalogProduct;
  score: number;
  matchedKeywords: Set<string>;
}

const GREETING_PHRASES = new Set([
  'hi',
  'hello',
  'hey',
  'hiya',
  'howdy',
  'good morning',
  'good afternoon',
  'good evening',
  'morning',
  'afternoon',
  'evening',
  'sup',
  'greetings',
  'namaste',
  'namaskar',
  'helo',
  'hii',
  'heya',
  'whats up',
  'what is up',
  'yo',
  'hola',
  'hi there',
  'hello there',
  'hey there',
]);

const GREETING_TOKENS = new Set([
  'hi',
  'hello',
  'hey',
  'hiya',
  'howdy',
  'good',
  'morning',
  'afternoon',
  'evening',
  'sup',
  'greetings',
  'namaste',
  'namaskar',
  'helo',
  'hii',
  'heya',
  'whats',
  'what',
  'is',
  'up',
  'yo',
  'hola',
]);

const GREETING_FILLERS = new Set([
  'there',
  'dear',
  'sir',
  'madam',
  'team',
  'everyone',
  'all',
  'please',
]);

const INVENTORY_QUERIES = [
  'what do you have',
  'what do you sell',
  'what you have',
  'what you selling',
  'what are you selling',
  'show me products',
  'show products',
  'show all products',
  'your collection',
  'your products',
  'what you got',
  'what you offer',
  'what do you offer',
  'list of products',
  'product list',
  'what items',
  'all products',
  'everything you have',
  'browse products',
  'browse your collection',
  "what's available",
  'whats available',
  'available products',
  'show me everything',
  'what can i buy',
  'show me your collection',
  'tell me about your products',
  'catalog',
  'catalogue',
];

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'i',
  'you',
  'u',
  'we',
  'they',
  'them',
  'this',
  'that',
  'these',
  'those',
  'my',
  'your',
  'our',
  'their',
  'me',
  'us',
  'what',
  'which',
  'who',
  'how',
  'why',
  'when',
  'where',
  'please',
  'show',
  'want',
  'need',
  'looking',
  'look',
  'find',
  'search',
  'get',
  'give',
  'tell',
  'about',
  'some',
  'any',
  'all',
  'like',
  'just',
  'from',
  'there',
  'here',
  'also',
  'too',
  'very',
  'really',
  'actually',
  'am',
  'so',
  'if',
  'then',
  'than',
  'into',
  'over',
  'under',
  'out',
  'up',
  'down',
  'not',
  'no',
  'yes',
  'ok',
  'okay',
  'sure',
  'thanks',
  'thank',
  'help',
  'anyone',
  'something',
  'anything',
  'nothing',
  'everything',
  'one',
  'two',
  'three',
  'hi',
  'hello',
  'hey',
  'good',
  'morning',
  'evening',
  'afternoon',
  'greetings',
  'namaste',
  'sir',
  'madam',
  'dear',
]);

const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export function parseBotConfig(raw: unknown): BotConfig | null {
  if (!raw) return null;
  try {
    const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!config || typeof config !== 'object') return null;
    const candidate = config as BotConfig;
    if (candidate.greeting || Array.isArray(candidate.products)) return candidate;
  } catch {
    return null;
  }
  return null;
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ves') && word.length > 4) return `${word.slice(0, -3)}f`;
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function variantsFor(word: string): Set<string> {
  const normalized = normalizeText(word);
  const variants = new Set<string>();
  if (!normalized) return variants;
  variants.add(normalized);
  variants.add(singularize(normalized));
  if (!normalized.endsWith('s')) variants.add(`${normalized}s`);
  if (normalized.endsWith('y')) variants.add(`${normalized.slice(0, -1)}ies`);
  return variants;
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const expanded = tokens.flatMap((token) => Array.from(variantsFor(token)));
  return Array.from(new Set(expanded)).filter((token) => token.length > 1);
}

export function isPureGreeting(raw: string): boolean {
  const normalized = normalizeText(raw);
  if (!normalized) return false;
  if (GREETING_PHRASES.has(normalized)) return true;
  const tokens = normalized.split(' ').filter(Boolean);
  const hasGreeting = tokens.some((token) => GREETING_TOKENS.has(token));
  if (!hasGreeting) return false;
  return tokens.every(
    (token) => GREETING_TOKENS.has(token) || GREETING_FILLERS.has(token),
  );
}

export function isInventoryQuery(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (INVENTORY_QUERIES.some((query) => normalized.includes(normalizeText(query)))) {
    return true;
  }
  return /^(show|list|see|browse|view)\s+(me\s+)?(all\s+)?(your\s+)?(products?|items?|catalog|catalogue|collection)$/.test(
    normalized,
  );
}

export function toTextArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => toTextArray(item));
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return [
      obj.name,
      obj.title,
      obj.label,
      obj.text,
      obj.url,
      obj.href,
    ].flatMap((item) => toTextArray(item));
  }
  return [];
}

function cleanList(value: unknown): string[] {
  return Array.from(
    new Set(
      toTextArray(value)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getProductImages(product: CatalogProduct, userText = ''): string[] {
  const images = cleanList(product.images).filter(isValidImageUrl);
  if (images.length > 0) return images;
  if (product.image && isValidImageUrl(String(product.image))) return [String(product.image)];
  const query = encodeURIComponent(
    normalizeText([product.name, product.title, product.category, product.brand, userText].filter(Boolean).join(' ')) ||
      'product',
  );
  return [`https://source.unsplash.com/600x600/?${query}`];
}

export function getProductVideos(product: CatalogProduct): string[] {
  return cleanList(product.videos);
}

export function getProductDocuments(product: CatalogProduct): string[] {
  return cleanList(product.documents);
}

export function getProductResources(product: CatalogProduct): string[] {
  return cleanList(product.resources);
}

export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.includes('/uploads/')) return true;
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.toLowerCase();
    return (
      SUPPORTED_IMAGE_EXT.some((ext) => pathname.endsWith(ext)) ||
      parsed.hostname.includes('pexels.com') ||
      parsed.hostname.includes('unsplash.com') ||
      parsed.hostname.includes('images.unsplash.com') ||
      parsed.hostname.includes('pixabay.com') ||
      parsed.hostname.includes('cdn') ||
      parsed.hostname.includes('cloudinary') ||
      parsed.hostname.includes('gstatic.com') ||
      parsed.hostname.includes('googleusercontent.com') ||
      parsed.hostname.includes('wp-content') ||
      parsed.hostname.includes('s3.') ||
      parsed.hostname.includes('amazonaws') ||
      pathname.includes('image') ||
      pathname.includes('img') ||
      pathname.includes('photo') ||
      parsed.searchParams.has('w') ||
      parsed.searchParams.has('width') ||
      parsed.searchParams.has('tbn') ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(pathname) ||
      SUPPORTED_IMAGE_EXT.some((ext) => parsed.search.toLowerCase().includes(ext))
    );
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(trimmed);
  }
}

function fieldScore(
  values: unknown[],
  queryKeywords: string[],
  userText: string,
  weight: number,
): { score: number; matched: string[] } {
  const normalizedValues = values.flatMap((value) => toTextArray(value)).map(normalizeText);
  const fieldText = ` ${normalizedValues.join(' ')} `;
  if (!fieldText.trim()) return { score: 0, matched: [] };

  const fieldTokens = new Set(
    fieldText
      .trim()
      .split(/\s+/)
      .flatMap((token) => Array.from(variantsFor(token))),
  );
  const matched: string[] = [];
  let score = 0;

  for (const keyword of queryKeywords) {
    const variants = Array.from(variantsFor(keyword));
    const hasToken = variants.some((variant) => fieldTokens.has(variant));
    const hasPartial = variants.some((variant) => fieldText.includes(` ${variant} `));
    if (hasToken || hasPartial) {
      score += hasToken ? weight : weight * 0.6;
      matched.push(keyword);
    }
  }

  const normalizedUserText = normalizeText(userText);
  for (const value of normalizedValues) {
    if (value.length > 2 && normalizedUserText.includes(value)) {
      score += weight * 1.4;
    }
  }

  return { score, matched };
}

export function searchCatalog(
  userText: string,
  products: CatalogProduct[] = [],
): CatalogSearchResult {
  const queryKeywords = extractKeywords(userText);
  if (queryKeywords.length === 0) {
    return {
      matchedKeywords: [],
      matchedProducts: [],
      images: [],
      documents: [],
      videos: [],
      resources: [],
    };
  }

  const scored: ScoredProduct[] = [];
  for (const rawProduct of products) {
    if (!rawProduct || typeof rawProduct !== 'object') continue;
    const product = rawProduct as CatalogProduct;
    const candidate: ScoredProduct = {
      product,
      score: 0,
      matchedKeywords: new Set(),
    };

    const fields: Array<{ values: unknown[]; weight: number }> = [
      { values: [product.name, product.title], weight: 9 },
      { values: [product.keywords, product.tags, product.category, product.brand], weight: 7 },
      { values: [product.description], weight: 4 },
      { values: [product.images, product.videos, product.documents, product.resources], weight: 2 },
    ];

    for (const field of fields) {
      const result = fieldScore(field.values, queryKeywords, userText, field.weight);
      candidate.score += result.score;
      result.matched.forEach((keyword) => candidate.matchedKeywords.add(singularize(keyword)));
    }

    const exactName = normalizeText(product.name || product.title);
    const normalizedUserText = normalizeText(userText);
    if (exactName && normalizedUserText.includes(exactName)) candidate.score += 18;

    for (const keyword of cleanList(product.keywords)) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword && normalizedUserText.includes(normalizedKeyword)) {
        candidate.score += normalizedKeyword.includes(' ') ? 12 : 7;
        normalizedKeyword.split(' ').forEach((part) => candidate.matchedKeywords.add(part));
      }
    }

    if (candidate.score > 0) scored.push(candidate);
  }

  scored.sort((a, b) => b.score - a.score);

  const matchedProducts = scored.map((item) => item.product);
  const matchedKeywords = Array.from(
    new Set(scored.flatMap((item) => Array.from(item.matchedKeywords))),
  );
  const images = Array.from(
    new Set(matchedProducts.flatMap((product) => getProductImages(product, userText))),
  );
  const documents = Array.from(
    new Set(matchedProducts.flatMap((product) => getProductDocuments(product))),
  );
  const videos = Array.from(
    new Set(matchedProducts.flatMap((product) => getProductVideos(product))),
  );
  const resources = Array.from(
    new Set(matchedProducts.flatMap((product) => getProductResources(product))),
  );

  return { matchedKeywords, matchedProducts, images, documents, videos, resources };
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Validate a set of bot-configured buttons against WhatsApp's rules and
 * sanitize them for use. Returns the cleaned buttons plus a note on
 * whether they can be sent on a plain session message or require an
 * approved template (phone-number buttons, or more than 3 buttons).
 */
export function sanitizeBotButtons(raw: unknown): {
  buttons: BotButton[];
  requiresTemplate: boolean;
} {
  const list = Array.isArray(raw) ? (raw as any[]) : [];
  const cleaned: BotButton[] = list
    .map((b) => ({
      id: b?.id ? String(b.id) : undefined,
      type: (['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(b?.type) ? b.type : 'QUICK_REPLY') as BotButtonType,
      text: String(b?.text || '').trim(),
      value: String(b?.value || b?.url || b?.phone_number || '').trim(),
    }))
    .filter((b) => b.text)
    .slice(0, 3);

  return {
    buttons: cleaned,
    requiresTemplate: false,
  };
}

export function makeTextMessage(text: string, extra?: Partial<BotUiMessage>): BotUiMessage {
  return { type: 'text', text, ...extra };
}

export function makeProductCard(product: CatalogProduct, userText = ''): BotUiMessage {
  return {
    type: 'product-images',
    productName: String(product.name || product.title || 'Product'),
    productImages: getProductImages(product, userText),
    productVideos: getProductVideos(product),
    productDocuments: getProductDocuments(product),
    productResources: getProductResources(product),
    productPrice: numberOrUndefined(product.price),
    productCurrency: product.currency || 'INR',
    productDescription: product.description,
  };
}

export function makeProductList(products: CatalogProduct[]): BotUiMessage {
  return {
    type: 'product-list',
    products: products.map((product) => ({
      ...product,
      image: getProductImages(product)[0],
    })),
    viewMode: 'grid',
  };
}

export function makeContentResults(result: CatalogSearchResult): BotUiMessage | null {
  const sections: ContentSection[] = [];
  if (result.images.length > 0) {
    sections.push({
      kind: 'images',
      title: `Images (${result.images.length})`,
      icon: 'images',
      items: result.images,
    });
  }
  if (result.videos.length > 0) {
    sections.push({
      kind: 'videos',
      title: `Videos (${result.videos.length})`,
      icon: 'videos',
      items: result.videos,
    });
  }
  if (result.documents.length > 0) {
    sections.push({
      kind: 'documents',
      title: `Documents (${result.documents.length})`,
      icon: 'documents',
      items: result.documents,
    });
  }
  if (result.resources.length > 0) {
    sections.push({
      kind: 'resources',
      title: `Resources (${result.resources.length})`,
      icon: 'resources',
      items: result.resources,
    });
  }
  if (sections.length === 0) return null;
  return {
    type: 'content-results',
    matchedKeywords: result.matchedKeywords,
    contentSections: sections,
  };
}

export function buildBotUiMessages(
  userText: string,
  config: BotConfig,
  flowName = 'our store',
): BotUiMessage[] {
  const products = Array.isArray(config.products) ? config.products : [];
  const companyName = config.companyName || flowName || 'our store';
  const { buttons } = sanitizeBotButtons(config.buttons);

  if (isPureGreeting(userText)) {
    return [
      makeTextMessage(
        config.greeting ||
          `Hello! Welcome to ${companyName}. How can I help you today?`,
        {
          buttons: buttons.length > 0 ? buttons : undefined,
          footer: config.footer || undefined,
          headerType: config.headerType && config.headerType !== 'None' ? config.headerType : undefined,
          headerMediaUrl: config.headerMediaUrl || undefined,
        },
      ),
    ];
  }

  if (isInventoryQuery(userText) && products.length > 0) {
    return [
      makeTextMessage(`Here is ${companyName}'s current catalog.`),
      makeProductList(products),
    ];
  }

  const result = searchCatalog(userText, products);
  if (result.matchedProducts.length === 0) {
    const suggestions = products
      .slice(0, 5)
      .map((product) => String(product.name || product.title || '').trim())
      .filter(Boolean)
      .join(', ');
    return [
      makeTextMessage(
        suggestions
          ? `I could not find an exact match in ${companyName}'s catalog. Try a product name or keyword such as ${suggestions}.`
          : `I could not find an exact match in ${companyName}'s catalog.`,
      ),
    ];
  }

  const [best, ...rest] = result.matchedProducts;
  const messages: BotUiMessage[] = [
    makeTextMessage(
      rest.length > 0
        ? `Best match first from ${companyName}'s catalog.`
        : `Best match from ${companyName}'s catalog.`,
    ),
    makeProductCard(best, userText),
  ];

  if (rest.length > 0) messages.push(makeProductList(result.matchedProducts));

  const content = makeContentResults(result);
  if (content) messages.push(content);

  return messages;
}

export function botUiMessageType(message: BotUiMessage): string {
  if (message.type === 'product-images') return 'bot_product';
  if (message.type === 'product-list') return 'bot_list';
  if (message.type === 'content-results') return 'bot_content';
  return 'text';
}