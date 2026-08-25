/**
 * jewellery-bot.ts  —  Generic configurable chatbot engine
 * ─────────────────────────────────────────────────────────
 * • Any published bot activates the engine
 * • Bot products + keywords stored in first node's config (via existing API)
 * • Keyword match → show 50 images of that product (cycled)
 * • Greeting → welcome + product menu
 * • Unknown → fallback with hint
 * • Draft bot → completely silent
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type JewelleryCategory =
  | "Necklaces" | "Chains" | "Rings" | "Bracelets" | "Earrings";

export interface JewelleryProduct {
  id: string; name: string; material: string;
  price: number; currency: string; image: string; category: JewelleryCategory;
}

export interface BotProduct {
  id:           string;
  name:         string;
  keywords:     string[];
  images:       string[];
  videos?:      string[];
  documents?:   string[];
  price?:       number;
  currency?:    string;
  description?: string;
}

export interface BotConfig {
  companyName?: string;
  greeting:    string;
  products:    BotProduct[];
}

export type BotViewMode = "grid" | "list" | "carousel";

export interface BotMessage {
  id:                  string;
  type:                "text" | "category-menu" | "product-list" | "product-images" | "content-results";
  sentAt:              number;
  text?:               string;
  products?:           JewelleryProduct[];
  viewMode?:           BotViewMode;
  productName?:        string;
  productImages?:      string[];
  productVideos?:      string[];
  productDocuments?:   string[];
  productPrice?:       number;
  productCurrency?:    string;
  productDescription?: string;
  matchedKeywords?:    string[];
  contentSections?:    Array<{
    kind:   "images" | "documents" | "videos" | "resources";
    title:  string;
    icon:   string;
    items:  string[];
  }>;
}

export interface BotResponse {
  messages:          BotMessage[];
  detectedCategory?: JewelleryCategory;
}

// ══════════════════════════════════════════════════════════
// KEYWORD CONFIG  (single source of truth)
// ══════════════════════════════════════════════════════════

const GREETING_WORDS = [
  "hi","hello","hey","hiya","howdy","good morning","good evening",
  "good afternoon","morning","evening","afternoon","sup","greetings",
  "namaste","namaskar","helo","hii","heya","whats up","yo","hola",
  "hi there","hello there","hey there",
];

const INVENTORY_QUERIES = [
  "what do you have","what do you sell","what you have","what you selling",
  "what are you selling","show me products","show products","show all products",
  "your collection","your products","what you got","what you offer",
  "what do you offer","list of products","product list","what items",
  "all products","everything you have","browse products","browse your collection",
  "what's available","whats available","available products","show me everything",
  "what can i buy","show me your collection","tell me about your products",
  "what do u have","what do u sell","what u have","what u selling",
];

export function isInventoryQuery(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[^a-z0-9\s?]/g, " ");
  for (const q of INVENTORY_QUERIES) if (t.includes(q)) return true;
  if (/^\s*(show|list|tell|see)\s+(me\s+)?(all\s+)?(your\s+)?products?\s*[:?.!]?$/.test(t)) return true;
  if (/what\s+(do|r|are)\s+(u|you)\s+(have|sell|got|offer|selling)/.test(t)) return true;
  return false;
}

const JEWELLERY_WORDS = [
  "jewellery","jewelry","jewel","jewels","collection","catalogue",
  "catalog","browse","show me jewellery","show me jewelry",
];

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","can","i","you","he",
  "she","it","we","they","them","this","that","these","those","my","your",
  "his","her","its","our","their","me","him","us","what","which","who","how",
  "why","when","where","please","show","me","want","need","looking","look",
  "find","search","get","give","tell","about","some","any","all","like",
  "just","from","there","here","also","too","very","really","actually",
  "am","so","if","then","than","into","over","under","out","up","down",
  "not","no","yes","ok","okay","sure","thanks","thank","help","anyone",
  "something","anything","nothing","everything","one","two","three",
  "hi","hello","hey","hiya","howdy","morning","evening","afternoon","sup",
  "greetings","namaste","namaskar","helo","hii","heya","yo","hola",
  "there","hiya","ya","yep","yeah","nah","nope","bro","dude","buddy",
  "mate","sir","madam","dear","everyone","everybody","guys","friend",
]);

export const CATEGORY_KEYWORDS: Record<JewelleryCategory, string[]> = {
  Necklaces:  ["neck","necklace","necklaces","pendant","pendants"],
  Chains:     ["chain","chains"],
  Rings:      ["ring","rings"],
  Bracelets:  ["brace","bracelet","bracelets","bangle","bangles"],
  Earrings:   ["earring","earrings","stud","studs","hoop","hoops"],
};

export const ALL_CATEGORIES: JewelleryCategory[] = [
  "Necklaces","Chains","Rings","Bracelets","Earrings",
];

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

/** Whole-word match — "chainsaw" must NOT match "chain" */
export function wordMatch(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-zA-Z])${esc}(?![a-zA-Z])`, "i").test(text);
}

export function matchesAny(text: string, words: string[]): boolean {
  return words.some(w => wordMatch(text, w));
}

let _counter = Date.now();
function uid(): string { return `bot-${(++_counter).toString(36)}`; }

const SUPPORTED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];

export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    return SUPPORTED_IMAGE_EXT.some(ext => pathname.endsWith(ext)) ||
      u.hostname.includes("pexels.com") ||
      u.hostname.includes("unsplash.com") ||
      u.hostname.includes("images.unsplash.com") ||
      u.hostname.includes("pixabay.com") ||
      u.hostname.includes("cdn") ||
      u.hostname.includes("cloudinary") ||
      u.hostname.includes("s3.") ||
      u.hostname.includes("amazonaws") ||
      u.searchParams.has("w") ||
      u.searchParams.has("width") ||
      u.pathname.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) !== null;
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
  }
}

export function expand50(images: string[]): string[] {
  const PLACEHOLDER = "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop";
  const valid = (images || []).filter(img => img && typeof img === "string" && img.trim() !== "");
  const base = valid.length > 0 ? valid : [PLACEHOLDER];
  const result: string[] = [];
  for (let i = 0; i < 50; i++) result.push(base[i % base.length]);
  return result;
}

// ══════════════════════════════════════════════════════════
// MESSAGE FACTORIES
// ══════════════════════════════════════════════════════════

export function makeCategoryMenu(): BotMessage {
  return { id: uid(), type: "category-menu", sentAt: Date.now() };
}

export function makeTextMessage(text: string): BotMessage {
  return { id: uid(), type: "text", text, sentAt: Date.now() };
}

export function makeProductList(products: any[], mode: BotViewMode = "grid"): BotMessage {
  return { id: uid(), type: "product-list", products, viewMode: mode, sentAt: Date.now() };
}

export function makeProductImages(product: BotProduct): BotMessage {
  return {
    id:                  uid(),
    type:                "product-images",
    sentAt:              Date.now(),
    productName:         product.name,
    productImages:       expand50(product.images || []),
    productVideos:       product.videos   || [],
    productDocuments:    product.documents || [],
    productPrice:        product.price,
    productCurrency:     product.currency || "₹",
    productDescription:  product.description,
  };
}

export function extractKeywords(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s'-]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(t => t.trim().length > 1);
  const filtered = tokens.filter(t => !STOP_WORDS.has(t));
  const deduped = Array.from(new Set(filtered));
  return deduped;
}

export function isPureGreeting(raw: string): boolean {
  const clean = raw.trim().toLowerCase();
  if (!clean) return false;
  if (matchesAny(clean, GREETING_WORDS)) {
    const stripped = clean
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 0);
    if (stripped.length === 0) return true;
    const allGreetingsOrFiller = stripped.every(w =>
      STOP_WORDS.has(w) ||
      GREETING_WORDS.includes(w) ||
      ["good","there"].includes(w)
    );
    return allGreetingsOrFiller;
  }
  return false;
}

export interface ContentSearchResult {
  matchedKeywords: string[];
  images:     string[];
  documents:  string[];
  videos:     string[];
  resources:  Array<{ name: string; url: string }>;
  matchedProducts: BotProduct[];
}

export function searchContentLibrary(
  userText: string,
  products: BotProduct[],
): ContentSearchResult {
  const keywords = extractKeywords(userText);
  const lowerText = userText.toLowerCase();

  const matchedProducts: BotProduct[] = [];
  const imagesSet = new Set<string>();
  const docsSet   = new Set<string>();
  const videosSet = new Set<string>();
  const resourcesMap = new Map<string, string>();

  for (const product of products) {
    const productKws = (Array.isArray(product.keywords) ? product.keywords : []).map(k => k.toLowerCase());
    const nameLower = product.name?.toLowerCase() ?? "";
    const descLower = product.description?.toLowerCase() ?? "";

    let matched = false;
    const matchedKwsInProduct: string[] = [];

    for (const kw of keywords) {
      if (productKws.includes(kw) || nameLower.includes(kw) || descLower.includes(kw)) {
        matched = true;
        if (!matchedKwsInProduct.includes(kw)) matchedKwsInProduct.push(kw);
      }
    }

    for (const pKw of productKws) {
      if (pKw && lowerText.includes(pKw)) {
        matched = true;
        const parts = pKw.split(/\s+/).filter(Boolean);
        for (const p of parts) {
          if (p.length > 1 && !matchedKwsInProduct.includes(p)) matchedKwsInProduct.push(p);
        }
      }
    }

    if (nameLower && matchesAny(lowerText, [nameLower])) {
      matched = true;
    }

    if (matched) {
      matchedProducts.push(product);
      (product.images || []).forEach(img => { if (isValidImageUrl(img)) imagesSet.add(img); });
      (product.documents || []).forEach(doc => docsSet.add(doc));
      (product.videos || []).forEach(vid => videosSet.add(vid));
    }
  }

  const detectedKws: string[] = [];
  for (const kw of keywords) {
    let found = false;
    for (const prod of matchedProducts) {
      const pKws = (Array.isArray(prod.keywords) ? prod.keywords : []).map(k => k.toLowerCase());
      const nameL = prod.name?.toLowerCase() ?? "";
      const descL = prod.description?.toLowerCase() ?? "";
      if (pKws.includes(kw) || nameL.includes(kw) || descL.includes(kw)) { found = true; break; }
    }
    if (found && !detectedKws.includes(kw)) detectedKws.push(kw);
  }

  return {
    matchedKeywords: detectedKws,
    images:          expand50(Array.from(imagesSet)),
    documents:       Array.from(docsSet),
    videos:          Array.from(videosSet),
    resources:       Array.from(resourcesMap.entries()).map(([name, url]) => ({ name, url })),
    matchedProducts,
  };
}

export function makeContentResults(
  result: ContentSearchResult,
  companyName: string = "our store",
): BotMessage[] {
  const hasImages    = result.images.length > 0;
  const hasDocs      = result.documents.length > 0;
  const hasVideos    = result.videos.length > 0;
  const hasResources = result.resources.length > 0;
  const hasAny       = hasImages || hasDocs || hasVideos || hasResources;

  const messages: BotMessage[] = [];

  if (!hasAny) {
    messages.push(makeTextMessage(
      `I couldn't find exact matches for your search in ${companyName}'s library 😔\n\n` +
      `Try searching with product names, categories, or keywords like:\n` +
      `• Necklaces, Rings, Bracelets, Earrings, Chains\n` +
      `• Gold, Silver, Diamond, Platinum\n` +
      `Or describe what you're looking for in a few words!`,
    ));
    return messages;
  }

  const kwDisplay = result.matchedKeywords.length > 0
    ? `for "${result.matchedKeywords.slice(0, 4).map(k => k[0].toUpperCase() + k.slice(1)).join(", ")}"`
    : "for you";

  const totalCount = result.images.length + result.documents.length + result.videos.length + result.resources.length;
  messages.push(makeTextMessage(
    `🔍 Found ${totalCount} relevant items ${kwDisplay} in ${companyName}'s content library ✨`,
  ));

  const contentSections: NonNullable<BotMessage["contentSections"]> = [];
  if (hasImages) {
    contentSections.push({
      kind:  "images",
      title: `🖼️  Images (${result.images.length})`,
      icon:  "images",
      items: result.images,
    });
  }
  if (hasVideos) {
    contentSections.push({
      kind:  "videos",
      title: `🎥  Videos (${result.videos.length})`,
      icon:  "videos",
      items: result.videos,
    });
  }
  if (hasDocs) {
    contentSections.push({
      kind:  "documents",
      title: `📄  Documents (${result.documents.length})`,
      icon:  "documents",
      items: result.documents,
    });
  }
  if (hasResources) {
    contentSections.push({
      kind:  "resources",
      title: `📚  Resources (${result.resources.length})`,
      icon:  "resources",
      items: result.resources.map(r => r.url),
    });
  }

  messages.push({
    id:              uid(),
    type:            "content-results",
    sentAt:          Date.now(),
    matchedKeywords: result.matchedKeywords,
    contentSections,
  });

  if (result.matchedProducts.length > 0) {
    const names = result.matchedProducts.slice(0, 5).map(p => `• *${p.name}*`).join("\n");
    const more  = result.matchedProducts.length > 5 ? `\n…+${result.matchedProducts.length - 5} more products` : "";
    messages.push(makeTextMessage(
      `Matching products in library:\n${names}${more}`,
    ));
  }

  return messages;
}

// ══════════════════════════════════════════════════════════
// INTENT CLASSIFIER  (jewellery fallback)
// ══════════════════════════════════════════════════════════

export function classifyMessage(raw: string): {
  intent: "greeting" | "category" | "jewellery" | "unknown";
  category?: JewelleryCategory;
} {
  const text = raw.trim().toLowerCase();
  if (!text) return { intent: "unknown" };
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [JewelleryCategory, string[]][]) {
    if (matchesAny(text, words)) return { intent: "category", category: cat };
  }
  if (matchesAny(text, JEWELLERY_WORDS)) return { intent: "jewellery" };
  if (matchesAny(text, GREETING_WORDS))  return { intent: "greeting" };
  return { intent: "unknown" };
}

// ══════════════════════════════════════════════════════════
// CUSTOM CONFIG BOT  (DB-driven — primary path)
// ══════════════════════════════════════════════════════════

export function getCustomBotResponse(userMessage: string, config: BotConfig): BotResponse {
  const text = userMessage.trim().toLowerCase();
  if (!text) return { messages: [] };

  const products = config.products || [];
  const companyName = config.companyName || "our store";

  if (isPureGreeting(userMessage)) {
    const defaultGreeting = `👋 Hello there! Welcome to ${companyName}!\n\nThank you for reaching out to us. We're delighted to help you find the perfect piece from our collection.\n\nHow can we assist you today? Feel free to ask about any product or describe what you're looking for!`;
    return {
      messages: [makeTextMessage(config.greeting || defaultGreeting)],
    };
  }

  if (isInventoryQuery(userMessage) && products.length > 0) {
    const jpCompatible = products.map((p: any) => ({
      id: p.id, name: p.name, material: "Premium",
      price: p.price, currency: p.currency || "₹",
      image: p.image || (p.images && p.images[0]) || "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop",
      category: "Rings",
      _botProduct: p,
    }));
    return {
      messages: [
        makeTextMessage(
          `✨ Welcome to ${companyName} — here is our complete collection!\n\n` +
          `We have ${products.length} stunning pieces available. 👇\n\n` +
          `**Tap any product card below to see full details, high-res images, price & specifications.**`,
        ),
        makeProductList(jpCompatible, "grid"),
      ],
    };
  }

  const searchResult = searchContentLibrary(userMessage, products);
  const hasDirectProductMatch = searchResult.matchedProducts.length === 1;

  if (hasDirectProductMatch) {
    const single = searchResult.matchedProducts[0];
    return {
      messages: [
        makeTextMessage(`✨ *${single.name}* details & gallery:`),
        makeProductImages(single),
      ],
    };
  }

  const contentMsgs = makeContentResults(searchResult, companyName);
  return { messages: contentMsgs };
}

// ══════════════════════════════════════════════════════════
// JEWELLERY FALLBACK BOT  (when no custom config)
// ══════════════════════════════════════════════════════════

export function jewelleryCatalogAsBotProducts(): BotProduct[] {
  const result: BotProduct[] = [];
  for (const cat of ALL_CATEGORIES) {
    const catProducts = getCatalog(cat);
    const catKws = CATEGORY_KEYWORDS[cat];
    for (const jp of catProducts) {
      const nameWords = jp.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      result.push({
        id:          jp.id,
        name:        jp.name,
        keywords:    [...catKws, ...nameWords, jp.material.toLowerCase()],
        images:      [jp.image],
        price:       jp.price,
        currency:    jp.currency,
        description: `${jp.material} ${cat.toLowerCase()} piece`,
      });
    }
  }
  return result;
}

export function getBotResponse(userMessage: string): BotResponse {
  const text = userMessage.trim().toLowerCase();
  if (!text) return { messages: [] };

  const companyName = "Luxe & Co. Jewellery";
  const allProducts = jewelleryCatalogAsBotProducts();

  if (matchesAny(text, GREETING_WORDS) && extractKeywords(text).length === 0) {
    return {
      messages: [
        makeTextMessage(
          `👋 Hi there! Welcome to ${companyName} ✨\n\n` +
          `Thank you for reaching out! We're your personal jewellery shopping assistant and we're so glad you're here.\n\n` +
          `Tell us what you're looking for today — we can help you find:\n` +
          `• Beautiful Necklaces, Chains, Rings, Bracelets, Earrings\n` +
          `• Gold, Silver, Diamond & Platinum pieces\n` +
          `Or just describe your style and we'll match you with perfect pieces!`,
        ),
      ],
    };
  }

  if (isInventoryQuery(userMessage)) {
    const combined: any[] = [];
    for (const cat of ALL_CATEGORIES) {
      const catProducts = getCatalog(cat);
      for (const jp of catProducts) {
        const origBot = allProducts.find(b => b.id === jp.id);
        combined.push({
          ...jp,
          _botProduct: origBot,
        });
      }
    }
    return {
      messages: [
        makeTextMessage(
          `✨ Welcome to ${companyName} — our complete jewellery collection!\n\n` +
          `We have ${combined.length} stunning pieces across all categories. 👇\n\n` +
          `**Tap any product card below to see full details, high-res gallery, price & specs.**`,
        ),
        makeProductList(combined, "grid"),
      ],
    };
  }

  const { intent, category } = classifyMessage(userMessage);

  if (intent === "category") {
    const prods = getCatalog(category!);
    return {
      detectedCategory: category,
      messages: [
        makeTextMessage(`Here's our *${category}* collection ✨ — ${prods.length} pieces:`),
        makeProductList(prods, "grid"),
      ],
    };
  }

  if (intent === "jewellery") {
    return { messages: [
      makeTextMessage("💎 Here are all our jewellery categories — tap one to browse:"),
      makeCategoryMenu(),
    ]};
  }

  const searchResult = searchContentLibrary(userMessage, allProducts);

  if (searchResult.matchedKeywords.length === 0 && searchResult.matchedProducts.length === 0) {
    return {
      messages: [
        makeTextMessage(
          `I'm here to help you find beautiful jewellery at ${companyName} 💎\n\n` +
          `Here's what I can show you today — tap a category or describe what you need!`,
        ),
        makeCategoryMenu(),
      ],
    };
  }

  const contentMsgs = makeContentResults(searchResult, companyName);
  return { messages: contentMsgs };
}

// ══════════════════════════════════════════════════════════
// PUBLISH-GATE HOOK
// ══════════════════════════════════════════════════════════

export interface BotInstance {
  id:             number;
  name:           string;
  published:      boolean;
  config:         BotConfig | null;
}

export interface BotEngineState {
  bots:           Record<number, BotInstance>;
  publishedIds:   number[];
  getBotById:     (id: number) => BotInstance | null;
  getPublished:   () => BotInstance[];
  processMessageForBot: (botId: number, text: string) => BotResponse | null;
  processMessage: (text: string) => BotResponse | null;
  refresh:        () => void;
  loading:        boolean;
}

function parseConfig(raw: any): BotConfig | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object") {
      if (obj.products || obj.greeting) return obj as BotConfig;
    }
  } catch {}
  return null;
}

export function useBotEngine(): BotEngineState {
  const [bots,         setBots]         = useState<Record<number, BotInstance>>({});
  const [publishedIds, setPublishedIds] = useState<number[]>([]);
  const [loading,      setLoading]      = useState(true);
  const botsRef     = useRef<Record<number, BotInstance>>({});

  const extractConfig = async (botLite: any): Promise<BotConfig | null> => {
    let fullBot = botLite;
    try { fullBot = await api.get<any>(`/bots/${botLite.id}`); } catch { /* use list data */ }
    let cfg: BotConfig | null = null;
    if (fullBot.config) cfg = parseConfig(fullBot.config);
    if (!cfg && Array.isArray(fullBot.nodes)) {
      const firstMsg = fullBot.nodes.find((n: any) => n.nodeType === "message");
      if (firstMsg?.config) cfg = parseConfig(firstMsg.config);
    }
    return cfg;
  };

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const botList: any[] = (await api.get<any[]>("/bots")) || [];
      const newBots: Record<number, BotInstance> = {};
      const published: number[] = [];

      for (const b of botList) {
        const id = Number(b.id);
        const cfg = await extractConfig(b);
        newBots[id] = {
          id,
          name: b.name ?? `Bot ${id}`,
          published: b.published === true,
          config: cfg,
        };
        if (b.published === true) published.push(id);
      }

      botsRef.current = newBots;
      setBots(newBots);
      setPublishedIds(published);
    } catch {
      botsRef.current = {};
      setBots({});
      setPublishedIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const getBotById = useCallback((id: number): BotInstance | null => {
    return botsRef.current[id] ?? null;
  }, []);

  const getPublished = useCallback((): BotInstance[] => {
    return Object.values(botsRef.current).filter(b => b.published);
  }, []);

  const processMessageForBot = useCallback((botId: number, text: string): BotResponse | null => {
    const bot = botsRef.current[botId];
    if (!bot || !bot.published) return null;
    if (bot.config && (bot.config.products?.length > 0 || bot.config.greeting)) {
      return getCustomBotResponse(text, bot.config);
    }
    return getBotResponse(text);
  }, []);

  const processMessage = useCallback((text: string): BotResponse | null => {
    const firstPublished = Object.values(botsRef.current).find(b => b.published);
    if (!firstPublished) return null;
    return processMessageForBot(firstPublished.id, text);
  }, [processMessageForBot]);

  return { bots, publishedIds, getBotById, getPublished, processMessageForBot, processMessage, refresh: fetchBots, loading };
}

// ══════════════════════════════════════════════════════════
// PRODUCT CATALOG — jewellery fallback (50 per category)
// ══════════════════════════════════════════════════════════

const PEXELS: Record<JewelleryCategory, string[]> = {
  Necklaces: [
    "https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/248077/pexels-photo-248077.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/691046/pexels-photo-691046.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/2649403/pexels-photo-2649403.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/3266700/pexels-photo-3266700.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/5442443/pexels-photo-5442443.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/10018713/pexels-photo-10018713.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/9428801/pexels-photo-9428801.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/6624862/pexels-photo-6624862.jpeg?w=400&h=400&fit=crop",
  ],
  Chains: [
    "https://images.pexels.com/photos/1413420/pexels-photo-1413420.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/8112171/pexels-photo-8112171.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/5442441/pexels-photo-5442441.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/3266701/pexels-photo-3266701.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1191532/pexels-photo-1191532.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/8108063/pexels-photo-8108063.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/10018709/pexels-photo-10018709.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/9428802/pexels-photo-9428802.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1454172/pexels-photo-1454172.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/248078/pexels-photo-248078.jpeg?w=400&h=400&fit=crop",
  ],
  Rings: [
    "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1616403/pexels-photo-1616403.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/3266704/pexels-photo-3266704.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/9428803/pexels-photo-9428803.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/10018712/pexels-photo-10018712.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/5442444/pexels-photo-5442444.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/6624865/pexels-photo-6624865.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/8108062/pexels-photo-8108062.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1413421/pexels-photo-1413421.jpeg?w=400&h=400&fit=crop",
  ],
  Bracelets: [
    "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1573928/pexels-photo-1573928.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/3266702/pexels-photo-3266702.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/9428804/pexels-photo-9428804.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/6624863/pexels-photo-6624863.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/5442442/pexels-photo-5442442.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/10018710/pexels-photo-10018710.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/8112172/pexels-photo-8112172.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1454173/pexels-photo-1454173.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/248079/pexels-photo-248079.jpeg?w=400&h=400&fit=crop",
  ],
  Earrings: [
    "https://images.pexels.com/photos/1191533/pexels-photo-1191533.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/6624864/pexels-photo-6624864.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/3266703/pexels-photo-3266703.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/9428805/pexels-photo-9428805.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/5442445/pexels-photo-5442445.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/10018711/pexels-photo-10018711.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/8108064/pexels-photo-8108064.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/1413422/pexels-photo-1413422.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/265907/pexels-photo-265907.jpeg?w=400&h=400&fit=crop",
    "https://images.pexels.com/photos/931178/pexels-photo-931178.jpeg?w=400&h=400&fit=crop",
  ],
};

const MATERIALS: Record<JewelleryCategory, string[]> = {
  Necklaces:  ["18K Gold","Sterling Silver","Rose Gold","White Gold","Gold-Plated","Diamond-Set"],
  Chains:     ["18K Gold","Sterling Silver","Cuban Link Gold","Rope Chain Silver","Box Chain Gold","Figaro Chain"],
  Rings:      ["18K Gold","Sterling Silver","Platinum","Rose Gold","Diamond-Set","Sapphire-Set"],
  Bracelets:  ["18K Gold","Sterling Silver","Rose Gold","Tennis Diamond","Charm Gold","Bangles Silver"],
  Earrings:   ["18K Gold","Sterling Silver","Diamond Studs","Pearl Drop","Hoop Gold","Rose Gold"],
};

const ADJECTIVES = [
  "Elegant","Classic","Luxe","Heritage","Artisan","Royal",
  "Infinity","Celestial","Bloom","Opulent","Grace","Radiant",
  "Eternal","Prestige","Icon","Signature","Premier","Blossom",
  "Aurora","Maison","Lumière","Soleil","Luna","Éclat","Bijou",
];

const SUFFIXES: Record<JewelleryCategory, string[]> = {
  Necklaces:  ["Necklace","Pendant","Lariat","Choker","Station Necklace"],
  Chains:     ["Chain","Link Chain","Curb Chain","Rope Chain","Box Chain"],
  Rings:      ["Ring","Band","Solitaire","Cocktail Ring","Stacking Ring"],
  Bracelets:  ["Bracelet","Bangle","Cuff","Tennis Bracelet","Charm Bracelet"],
  Earrings:   ["Earrings","Studs","Drops","Hoops","Dangle Earrings"],
};

export function getCatalog(category: JewelleryCategory): JewelleryProduct[] {
  const images    = PEXELS[category];
  const materials = MATERIALS[category];
  const suffixes  = SUFFIXES[category];
  const products: JewelleryProduct[] = [];
  for (let i = 0; i < 50; i++) {
    products.push({
      id:       `${category.toLowerCase()}-${i + 1}`,
      name:     `${ADJECTIVES[i % ADJECTIVES.length]} ${suffixes[i % suffixes.length]}`,
      material: materials[i % materials.length],
      price:    Math.round((1499 + (i * 953) % 47500) / 100) * 100,
      currency: "₹",
      image:    images[i % images.length],
      category,
    });
  }
  return products;
}
