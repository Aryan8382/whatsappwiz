import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MockWhatsappService } from './mock-whatsapp.service';
import { MessengerService } from './messenger.service';
import { WalletService } from '../wallet/wallet.service';
import {
  BotButton,
  BotUiMessage,
  botUiMessageType,
  buildBotUiMessages,
  getBotButtonWarnings,
  parseBotConfig,
  isPureGreeting,
  isInventoryQuery,
} from './catalog-search';

function wordMatch(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-zA-Z])${esc}(?![a-zA-Z])`, 'i').test(text);
}

function matchesAny(text: string, words: string[]): boolean {
  return words.some((w) => wordMatch(text, w));
}

const GREETING_WORDS = [
  'hi', 'hello', 'hey', 'hiya', 'howdy', 'good morning', 'good evening',
  'good afternoon', 'morning', 'evening', 'afternoon', 'sup', 'greetings',
  'namaste', 'namaskar', 'helo', 'hii', 'heya', 'whats up', 'yo', 'hola',
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he',
  'she', 'it', 'we', 'they', 'them', 'this', 'that', 'these', 'those', 'my', 'your',
  'his', 'her', 'its', 'our', 'their', 'me', 'him', 'us', 'what', 'which', 'who', 'how',
  'why', 'when', 'where', 'please', 'show', 'me', 'want', 'need', 'looking', 'look',
  'find', 'search', 'get', 'give', 'tell', 'about', 'some', 'any', 'all', 'like',
  'just', 'from', 'there', 'here', 'also', 'too', 'very', 'really', 'actually',
  'am', 'so', 'if', 'then', 'than', 'into', 'over', 'under', 'out', 'up', 'down',
  'not', 'no', 'yes', 'ok', 'okay', 'sure', 'thanks', 'thank', 'help', 'anyone',
  'something', 'anything', 'nothing', 'everything', 'one', 'two', 'three',
]);

function extractKeywords(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s'-]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(t => t.trim().length > 1);
  const filtered = tokens.filter(t => !STOP_WORDS.has(t));
  return Array.from(new Set(filtered));
}

export function formatButtonsIntoText(text: string, buttons?: BotButton[]): string {
  if (!buttons || buttons.length === 0) return text;
  const buttonLines = buttons
    .map((b) => {
      const label = (b.text || '').trim();
      let val = (b.value || '').trim();
      if (!label) return null;

      const isLoc = /location|map|address|store|directions/i.test(label) || b.type === 'LOCATION';
      const isContact = /contact|call|phone|support|help/i.test(label) || b.type === 'PHONE_NUMBER';

      if (b.type === 'PHONE_NUMBER' || (isContact && /^\+?\d[\d\s-]{6,}$/.test(val))) {
        return val ? `📞 *${label}*: ${val}` : `📞 *${label}*`;
      } else if (b.type === 'LOCATION' || isLoc) {
        if (val && !/^https?:\/\//i.test(val)) val = `https://${val}`;
        return val ? `📍 *${label}*: ${val}` : `📍 *${label}*`;
      } else if (b.type === 'URL' || /^(https?:\/\/|www\.)/i.test(val) || val.includes('.')) {
        if (val && !/^https?:\/\//i.test(val)) {
          val = `https://${val}`;
        }
        return val ? `🌐 *${label}*: ${val}` : `🌐 *${label}*`;
      } else {
        return `👉 *${label}*`;
      }
    })
    .filter(Boolean);

  if (buttonLines.length === 0) return text;
  const clean = (text || '').trim();
  return clean ? `${clean}\n\n${buttonLines.join('\n')}` : buttonLines.join('\n');
}

const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif'];
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.includes('/uploads/')) return true;
  try {
    const u = new URL(trimmed);
    const pathname = u.pathname.toLowerCase();
    return (
      SUPPORTED_IMAGE_EXT.some(ext => pathname.endsWith(ext)) ||
      u.hostname.includes('pexels.com') ||
      u.hostname.includes('unsplash.com') ||
      u.hostname.includes('images.unsplash.com') ||
      u.hostname.includes('pixabay.com') ||
      u.hostname.includes('cdn') ||
      u.hostname.includes('cloudinary') ||
      u.hostname.includes('gstatic.com') ||
      u.hostname.includes('googleusercontent.com') ||
      u.hostname.includes('wp-content') ||
      u.hostname.includes('s3.') ||
      u.hostname.includes('amazonaws') ||
      pathname.includes('image') ||
      pathname.includes('img') ||
      pathname.includes('photo') ||
      u.searchParams.has('w') ||
      u.searchParams.has('width') ||
      u.searchParams.has('tbn') ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(pathname) ||
      SUPPORTED_IMAGE_EXT.some(ext => u.search.toLowerCase().includes(ext))
    );
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(trimmed);
  }
}

interface ContentSearchResult {
  matchedKeywords: string[];
  images: string[];
  documents: string[];
  videos: string[];
  matchedProducts: any[];
}

function searchContentLibrary(userText: string, products: any[]): ContentSearchResult {
  const keywords = extractKeywords(userText);
  const lowerText = userText.trim().toLowerCase();

  const matchedProducts: any[] = [];
  const imagesSet = new Set<string>();
  const docsSet = new Set<string>();
  const videosSet = new Set<string>();

  for (const product of products) {
    const productKws = Array.isArray(product.keywords)
      ? product.keywords.map((k: string) => String(k).toLowerCase())
      : [];
    const nameLower = product.name ? String(product.name).toLowerCase() : '';
    const descLower = product.description ? String(product.description).toLowerCase() : '';

    let matched = false;

    for (const kw of keywords) {
      if (productKws.includes(kw) || nameLower.includes(kw) || descLower.includes(kw)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      for (const pKw of productKws) {
        if (pKw && lowerText.includes(pKw)) { matched = true; break; }
      }
    }

    if (!matched && nameLower) {
      const esc = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?<![a-zA-Z])${esc}(?![a-zA-Z])`, 'i').test(lowerText)) {
        matched = true;
      }
    }

    if (matched) {
      matchedProducts.push(product);
      (Array.isArray(product.images) ? product.images : []).forEach((img: string) => {
        if (isValidImageUrl(img)) imagesSet.add(img);
      });
      (Array.isArray(product.documents) ? product.documents : []).forEach((doc: string) => docsSet.add(doc));
      (Array.isArray(product.videos) ? product.videos : []).forEach((vid: string) => videosSet.add(vid));
    }
  }

  const detectedKws: string[] = [];
  for (const kw of keywords) {
    let found = false;
    for (const prod of matchedProducts) {
      const pKws = Array.isArray(prod.keywords)
        ? prod.keywords.map((k: string) => String(k).toLowerCase())
        : [];
      const nameL = prod.name ? String(prod.name).toLowerCase() : '';
      const descL = prod.description ? String(prod.description).toLowerCase() : '';
      if (pKws.includes(kw) || nameL.includes(kw) || descL.includes(kw)) { found = true; break; }
    }
    if (found && !detectedKws.includes(kw)) detectedKws.push(kw);
  }

  return {
    matchedKeywords: detectedKws,
    images: Array.from(imagesSet),
    documents: Array.from(docsSet),
    videos: Array.from(videosSet),
    matchedProducts,
  };
}

interface BotSession {
  nodeId: number;
}

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);
  private sessions = new Map<number, BotSession>();
  // Tracks which published flows we've already warned about having an
  // unsendable button configuration, so we don't spam a note on every
  // single incoming message — just the first time it's hit per flow
  // (per process lifetime; resets on deploy/restart, which is fine since
  // it's just an admin nudge, not a persisted audit log).
  private warnedButtonFlowIds = new Set<number>();

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private mockWhatsapp: MockWhatsappService,
    private messenger: MessengerService,
    private wallet: WalletService,
    private config: ConfigService,
  ) {}

  async handleIncoming(
    organizationId: number,
    conversationId: number,
    reply: string,
    botFlowId?: number,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: BigInt(conversationId),
        organizationId: BigInt(organizationId),
      },
      include: { contact: true },
    });
    if (!conversation) {
      this.sessions.delete(conversationId);
      return [];
    }

    const flow = await this.getPublishedFlow(organizationId, botFlowId);
    if (!flow) {
      this.sessions.delete(conversationId);
      return [];
    }

    let botConfig = parseBotConfig(flow.config);
    if (!botConfig) {
      const firstMsg = flow.nodes?.find((n: any) => n.nodeType === 'message');
      botConfig = parseBotConfig(firstMsg?.config);
    }

    if (botConfig) {
      await this.warnAboutButtonConfigIfNeeded(organizationId, conversationId, flow, botConfig);
    }

    if (reply.trim() && botConfig && (botConfig.greeting || Array.isArray(botConfig.products))) {
      const recipientPhone = conversation.contact.mobile;
      const companyName = botConfig.companyName || flow.name || 'our store';
      const cleanReply = reply.trim();
      const lowerReply = cleanReply.toLowerCase().replace(/^[📞📍🌐🔗👉🛍️\s]+/, '').trim();

      // Helper to persist and emit media sent over WhatsApp
      const persistSentMedia = async (
        mediaType: 'image' | 'video' | 'document',
        mediaUrl: string,
        captionText: string | undefined,
        sendRes: { metaMessageId: string; status: string },
      ) => {
        const saved = await this.prisma.message.create({
          data: {
            organizationId: BigInt(organizationId),
            conversationId: conversation.id,
            whatsappNumberId: conversation.whatsappNumberId || null,
            senderType: 'bot',
            messageType: mediaType,
            messageText: captionText || null,
            mediaUrl,
            metaMessageId: sendRes.metaMessageId,
            status: sendRes.status === 'failed' ? 'failed' : 'sent',
            sentAt: new Date(),
          },
        });
        await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
        this.realtime.emitToOrg(organizationId, 'message:new', saved);
        return saved;
      };

      // ── CASE 1: Pure greeting ("hi", "hello", "hey", etc.) ──
      if (isPureGreeting(reply)) {
        const botMessages = buildBotUiMessages(reply, botConfig, flow.name);

        let caption: string | undefined;
        let captionButtons: BotButton[] | undefined;
        let remaining = botMessages;
        if (
          botMessages.length > 0 &&
          botMessages[0].type === 'text' &&
          botMessages[0].text
        ) {
          caption = botMessages[0].text;
          captionButtons = botMessages[0].buttons;
          remaining = botMessages.slice(1);
        }

        const headerSaved = await this.sendHeaderMedia(
          organizationId,
          conversationId,
          botConfig,
          caption,
          captionButtons,
        );

        if (headerSaved.length > 0) {
          return headerSaved;
        } else if (caption) {
          const sentText = await this.send(
            organizationId,
            conversationId,
            caption,
            new Date(),
            captionButtons,
          );
          if (sentText) return [sentText];
        }

        if (remaining.length > 0) {
          return await this.sendBotUiMessages(organizationId, conversationId, remaining);
        }
      }

      // ── CASE 2: Configured Button Clicks & Intent Triggers ──
      const configuredBtns: BotButton[] = Array.isArray(botConfig.buttons) ? botConfig.buttons : [];
      const matchedBtn = configuredBtns.find((b) => {
        const bText = String(b.text || '').toLowerCase().trim();
        const bVal = String(b.value || '').toLowerCase().trim();
        if (!bText && !bVal) return false;
        return (
          lowerReply === bText ||
          lowerReply === bVal ||
          (b.id && cleanReply === b.id) ||
          (bText.length > 2 && (lowerReply.includes(bText) || bText.includes(lowerReply)))
        );
      });

      const isCallIntent = matchedBtn?.type === 'PHONE_NUMBER' || /call|phone|contact|support/i.test(lowerReply);
      const isLocIntent = matchedBtn?.type === 'LOCATION' || /location|map|address|store|directions|where/i.test(lowerReply);
      const isWebsiteIntent = matchedBtn?.type === 'URL' || /website|link|site|url|online/i.test(lowerReply);

      if (isCallIntent || matchedBtn?.type === 'PHONE_NUMBER') {
        const phoneBtn = configuredBtns.find((b) => b.type === 'PHONE_NUMBER') || matchedBtn;
        const phone = phoneBtn?.value || '+91 76239 83591';
        const msg = `📞 *Call Us Directly*\n\nYou can connect with our customer support at:\n*${phone}*\n\nTap the phone number above to call right now! We are available to assist you with purchases, custom designs, and inquiries.`;
        const res = await this.send(organizationId, conversationId, msg, new Date(), [
          { id: 'all_prod', type: 'QUICK_REPLY', text: '🛍️ All Products' },
          { id: 'loc', type: 'QUICK_REPLY', text: '📍 Location' },
        ]);
        if (res) return [res];
      }

      if (isLocIntent || matchedBtn?.type === 'LOCATION') {
        const locBtn = configuredBtns.find((b) => b.type === 'LOCATION' || /location|map/i.test(b.text)) || matchedBtn;
        let locUrl = locBtn?.value || 'https://maps.google.com';
        if (!/^https?:\/\//i.test(locUrl)) locUrl = `https://${locUrl}`;
        const msg = `📍 *Store Location*\n\nVisit our flagship showroom:\n${locUrl}\n\nTap the map link above for directions. We look forward to seeing you!`;
        const res = await this.send(organizationId, conversationId, msg, new Date(), [
          { id: 'all_prod', type: 'QUICK_REPLY', text: '🛍️ All Products' },
          { id: 'call', type: 'QUICK_REPLY', text: '📞 Call Us' },
        ]);
        if (res) return [res];
      }

      if (isWebsiteIntent || matchedBtn?.type === 'URL') {
        const urlBtn = configuredBtns.find((b) => b.type === 'URL') || matchedBtn;
        let siteUrl = urlBtn?.value || 'https://google.com';
        if (!/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`;
        const msg = `🌐 *${urlBtn?.text || 'Official Website'}*\n\nExplore our entire collection and latest designs:\n${siteUrl}\n\nLet us know if you need assistance!`;
        const res = await this.send(organizationId, conversationId, msg, new Date(), [
          { id: 'all_prod', type: 'QUICK_REPLY', text: '🛍️ All Products' },
          { id: 'call', type: 'QUICK_REPLY', text: '📞 Call Us' },
        ]);
        if (res) return [res];
      }

      // ── CASE 3: Product Selection (by number, option, name, or keyword) ──
      const productsList: any[] = Array.isArray(botConfig.products) ? botConfig.products : [];
      let matchedProduct: any = null;

      // 3a. Numeric selection: "1", "#1", "option 1", "product 1", "item 1", etc.
      const numMatch = cleanReply.match(/^(?:option\s*|product\s*|item\s*|#\s*)?(\d{1,2})$/i);
      if (numMatch && productsList.length > 0) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < productsList.length) {
          matchedProduct = productsList[idx];
        }
      }

      // 3b. Name or Keyword match
      if (!matchedProduct && productsList.length > 0) {
        // Direct product name match
        matchedProduct = productsList.find((p) => {
          const pName = String(p.name || p.title || '').toLowerCase().trim();
          return pName && (lowerReply.includes(pName) || pName.includes(lowerReply));
        });

        // Content library search match
        if (!matchedProduct) {
          const searchResult = searchContentLibrary(cleanReply, productsList);
          if (searchResult.matchedProducts.length > 0) {
            matchedProduct = searchResult.matchedProducts[0];
          }
        }
      }

      // 3c. If product is found, SEND ATTACHED IMAGE AS WHATSAPP MEDIA MESSAGE!
      if (matchedProduct) {
        const p = matchedProduct;
        const validImages = (Array.isArray(p.images) ? p.images : [])
          .concat(p.image ? [p.image] : [])
          .filter(isValidImageUrl);

        const priceStr = p.price ? `\n💰 *Price*: ${p.currency || '₹'}${p.price}` : '';
        const descStr = p.description ? `\n\n${p.description}` : '';
        const prodCaption = `✨ *${p.name || p.title || 'Product'}*${priceStr}${descStr}\n\nInterested in this piece? Tap *Call Us* or reply here to reserve or order!`;

        const actionBtns: BotButton[] = configuredBtns.length > 0
          ? configuredBtns
          : [
              { id: 'call', type: 'QUICK_REPLY', text: '📞 Call Us' },
              { id: 'all_prod', type: 'QUICK_REPLY', text: '🛍️ All Products' },
            ];

        const savedMsgs: any[] = [];

        if (validImages.length > 0) {
          // Send the primary image with caption & action buttons attached!
          const result = await this.messenger.sendButtonsMessage(
            recipientPhone,
            prodCaption.slice(0, 1024),
            actionBtns,
            { headerMedia: { type: 'image', url: validImages[0] } },
          );
          const savedMain = await persistSentMedia('image', validImages[0], prodCaption, result);
          savedMsgs.push(savedMain);

          // If product has more images, send up to 2 additional images
          for (const extraImg of validImages.slice(1, 3)) {
            const extraRes = await this.messenger.sendImage(recipientPhone, extraImg, undefined);
            const savedExtra = await persistSentMedia('image', extraImg, undefined, extraRes);
            savedMsgs.push(savedExtra);
          }
        } else {
          // No attached image, send text card with buttons
          const savedText = await this.send(
            organizationId,
            conversationId,
            prodCaption,
            new Date(),
            actionBtns,
          );
          if (savedText) savedMsgs.push(savedText);
        }

        // Send attached videos if any
        if (Array.isArray(p.videos) && p.videos.length > 0) {
          for (const vid of p.videos.slice(0, 1)) {
            const vidRes = await this.messenger.sendVideo(recipientPhone, vid, `🎥 ${p.name}`);
            savedMsgs.push(await persistSentMedia('video', vid, `🎥 ${p.name}`, vidRes));
          }
        }

        // Send attached documents if any
        if (Array.isArray(p.documents) && p.documents.length > 0) {
          for (const doc of p.documents.slice(0, 1)) {
            const docRes = await this.messenger.sendDocument(recipientPhone, doc, `${p.name}.pdf`, `📄 ${p.name} Brochure`);
            savedMsgs.push(await persistSentMedia('document', doc, `📄 ${p.name} Brochure`, docRes));
          }
        }

        return savedMsgs;
      }

      // ── CASE 4: Catalog / Menu / Browse inquiry ──
      const isCatalogInquiry =
        isInventoryQuery(cleanReply) ||
        /^(catalog|catalogue|menu|products|items|collection|all|list|options)$/i.test(lowerReply);

      if (isCatalogInquiry) {
        const greetingCaption = botConfig.greeting || `Here is ${companyName}'s current collection:`;
        const headerSaved = await this.sendHeaderMedia(
          organizationId,
          conversationId,
          botConfig,
          greetingCaption,
          configuredBtns,
        );
        if (headerSaved.length > 0) return headerSaved;

        const sentGreeting = await this.send(
          organizationId,
          conversationId,
          greetingCaption,
          new Date(),
          configuredBtns,
        );
        if (sentGreeting) return [sentGreeting];
      }

      // ── CASE 5: Fallback — Helpful suggestions ──
      if (productsList.length > 0) {
        const suggestions = productsList
          .slice(0, 8)
          .map((p: any, i: number) => `${i + 1}. *${p.name || p.title}*`)
          .join('\n');
        const fallbackMsg =
          `I couldn't find an exact match for "${cleanReply}" in ${companyName}'s catalog 😔\n\n` +
          `Reply with any number or product name below to see photos & details:\n\n` +
          `${suggestions}\n\n` +
          `Or tap *Call Us* below to speak with our representative!`;

        const sentFallback = await this.send(
          organizationId,
          conversationId,
          fallbackMsg,
          new Date(),
          configuredBtns,
        );
        if (sentFallback) return [sentFallback];
      }
    }

    const nodes = flow.nodes;
    const adjacency = new Map<number, number[]>();
    for (const conn of flow.connections) {
      const from = Number(conn.sourceNode);
      const to = Number(conn.targetNode);
      const list = adjacency.get(from) || [];
      list.push(to);
      adjacency.set(from, list);
    }


    const waiting = this.sessions.get(conversationId);
    if (waiting) {
      const questionNode = nodes.find((n) => Number(n.id) === waiting.nodeId);
      if (questionNode) {
        const cfg = (questionNode.config || {}) as any;
        const answers: { text?: string; targetNodeId?: number }[] =
          cfg.answers || cfg.buttons || [];
        const match =
          answers.find((a) =>
            String(a.text || '')
              .toLowerCase()
              .includes(reply.trim().toLowerCase()),
          ) ||
          answers.find((a) => a.text === '*') ||
          answers[0];
        if (match?.targetNodeId) {
          const target = nodes.find((n) => Number(n.id) === match.targetNodeId);
          this.sessions.delete(conversationId);
          if (target) {
            await this.execute(
              nodes,
              adjacency,
              target,
              conversationId,
              reply,
              organizationId,
            );
            return;
          }
        }
      }
      this.sessions.delete(conversationId);
    }

    const start = nodes.find((n) => n.nodeType === 'start');
    if (!start) return;
    await this.execute(
      nodes,
      adjacency,
      start,
      conversationId,
      reply,
      organizationId,
    );
  }

  /**
   * Checks the bot's configured buttons for issues that mean some of them
   * won't actually reach the customer (e.g. two Website buttons, a Call
   * button, or mixed button types on a non-template message) and, the
   * first time this is hit for a given published flow, posts a note on
   * the conversation and emits a realtime event so it's visible in the
   * admin UI instead of buttons just silently failing to show up.
   */
  private async warnAboutButtonConfigIfNeeded(
    organizationId: number,
    conversationId: number,
    flow: any,
    botConfig: any,
  ) {
    const flowId = Number(flow?.id);
    if (!Number.isFinite(flowId) || this.warnedButtonFlowIds.has(flowId)) return;

    const warnings = getBotButtonWarnings(botConfig);
    if (warnings.length === 0) return;

    this.warnedButtonFlowIds.add(flowId);
    this.logger.warn(
      `Bot flow ${flowId} has a button configuration issue: ${warnings.join(' ')}`,
    );

    try {
      await this.prisma.conversationNote.create({
        data: {
          conversationId: BigInt(conversationId),
          userId: BigInt(1),
          note: `⚠️ Bot button configuration issue: ${warnings.join(' ')}`,
        },
      });
      const conversationRecord = await this.prisma.conversation.findUnique({
        where: { id: BigInt(conversationId) },
      });
      this.realtime.emitToOrg(organizationId, 'conversation:updated', conversationRecord);
    } catch {
      // never let the warning mechanism itself break the bot reply
    }

    this.realtime.emitToOrg(organizationId, 'bot:configWarning', {
      flowId,
      organizationId,
      warnings,
    });
  }

  /**
   * Sends the configured header media (Image / Video / Document) for the
   * "First Message on Customer Response" bot config, if one is set. This is
   * the media selected via the Header message tabs in the bot builder UI
   * (editForm.headerType / editForm.headerMediaUrl on the frontend), stored
   * inside botConfig as headerType / headerMediaUrl.
   *
   * If `caption` is provided, it's sent as the media's caption so the media
   * and the accompanying text arrive as ONE WhatsApp message/bubble instead
   * of a media message followed by a separate text message.
   */
  private async sendHeaderMedia(
    organizationId: number,
    conversationId: number,
    botConfig: any,
    caption?: string,
    buttons?: BotButton[],
  ): Promise<any[]> {
    const headerType = botConfig?.headerType;
    const headerMediaUrl = botConfig?.headerMediaUrl;
    if (!headerType || headerType === 'None' || !headerMediaUrl) return [];

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
      include: { contact: true },
    });
    if (!conversation) return [];
    const recipientPhone = conversation.contact.mobile;

    const mediaTypeMap: Record<string, 'image' | 'video' | 'document'> = {
      Image: 'image',
      Video: 'video',
      Document: 'document',
    };
    const type = mediaTypeMap[headerType];
    if (!type) return [];

    const persist = async (
      result: { metaMessageId: string; status: string },
      messageText: string | null,
    ) => {
      const saved = await this.prisma.message.create({
        data: {
          organizationId: BigInt(organizationId),
          conversationId: conversation.id,
          whatsappNumberId: conversation.whatsappNumberId || null,
          senderType: 'bot',
          messageType: type,
          messageText,
          mediaUrl: headerMediaUrl,
          metaMessageId: result.metaMessageId,
          status: result.status === 'failed' ? 'failed' : 'sent',
          sentAt: new Date(),
        },
      });
      await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
      this.realtime.emitToOrg(organizationId, 'message:new', saved);
      return saved;
    };

    // Combine caption and button links into one rich caption with all details
    const fullCaption = formatButtonsIntoText(caption || '', buttons);

    // If buttons are configured, try to send ONE WhatsApp interactive
    // message with the media as its header, the caption as the body text,
    // and the buttons attached
    if (buttons && buttons.length > 0) {
      try {
        const result = await this.messenger.sendButtonsMessage(
          recipientPhone,
          (fullCaption || caption || ' ').slice(0, 1024),
          buttons,
          { headerMedia: { type, url: headerMediaUrl } },
        );
        if (!result.requiresTemplate) {
          return [await persist(result, fullCaption || caption || null)];
        }
      } catch {
        // fall through to plain media below
      }
    }

    let result: { metaMessageId: string; status: string };
    try {
      if (type === 'image') {
        result = await this.messenger.sendImage(recipientPhone, headerMediaUrl, fullCaption);
      } else if (type === 'video') {
        result = await this.messenger.sendVideo(recipientPhone, headerMediaUrl, fullCaption);
      } else {
        result = await this.messenger.sendDocument(recipientPhone, headerMediaUrl, undefined, fullCaption);
      }
    } catch {
      // never let header media failures break the rest of the bot reply
      return [];
    }

    const mediaSaved = await persist(result, fullCaption || caption || null);
    // Return SINGLE message with all details: NEVER send duplicate buttonFollowUp message!
    return [mediaSaved];
  }

  private async sendBotUiMessages(
    organizationId: number,
    conversationId: number,
    messages: BotUiMessage[],
  ) {
    const saved: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      const sentAt = new Date(Date.now() + i);
      const message = messages[i];

      if (message.type === 'text') {
        const savedMessage = await this.send(
          organizationId,
          conversationId,
          message.text || '',
          sentAt,
          message.buttons,
        );
        if (savedMessage) saved.push(savedMessage);
        continue;
      }

      // For product cards / lists / content results: send the real media
      // out over WhatsApp first, THEN store the rich payload for the
      // /inbox UI (so the admin panel can still render the fancy card).
      const sentMedia = await this.sendBotUiMediaOverWhatsapp(organizationId, conversationId, message);
      saved.push(...sentMedia);

      const storedMessage = await this.storeBotUiMessage(organizationId, conversationId, message, sentAt);
      if (storedMessage) saved.push(storedMessage);
    }
    return saved;
  }

  /**
   * Sends the actual media (images/videos/documents) referenced by a rich
   * bot UI message out over WhatsApp using MessengerService. Previously,
   * storeBotUiMessage only saved a JSON blob to the DB for the inbox UI
   * and never called sendImage/sendVideo/sendDocument, so customers never
   * actually received product photos on WhatsApp.
   */
  private async sendBotUiMediaOverWhatsapp(
    organizationId: number,
    conversationId: number,
    message: BotUiMessage,
  ) {
    const results: any[] = [];

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
      include: { contact: true },
    });
    if (!conversation) return results;
    const recipientPhone = conversation.contact.mobile;

    const persistSent = async (
      type: 'image' | 'video' | 'document',
      url: string,
      caption: string | undefined,
      result: { metaMessageId: string; status: string },
    ) => {
      const saved = await this.prisma.message.create({
        data: {
          organizationId: BigInt(organizationId),
          conversationId: conversation.id,
          whatsappNumberId: conversation.whatsappNumberId || null,
          senderType: 'bot',
          messageType: type,
          messageText: caption || null,
          mediaUrl: url,
          metaMessageId: result.metaMessageId,
          status: result.status === 'failed' ? 'failed' : 'sent',
          sentAt: new Date(),
        },
      });
      await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
      this.realtime.emitToOrg(organizationId, 'message:new', saved);
      results.push(saved);
    };

    if (message.type === 'product-images') {
      const caption = message.productName
        ? `${message.productName}${message.productPrice ? ` - ${message.productCurrency || 'INR'} ${message.productPrice}` : ''}`
        : undefined;

      for (const img of message.productImages || []) {
        const result = await this.messenger.sendImage(recipientPhone, img, caption);
        await persistSent('image', img, caption, result);
      }
      for (const vid of message.productVideos || []) {
        const result = await this.messenger.sendVideo(recipientPhone, vid, caption);
        await persistSent('video', vid, caption, result);
      }
      for (const doc of message.productDocuments || []) {
        const result = await this.messenger.sendDocument(recipientPhone, doc, message.productName, caption);
        await persistSent('document', doc, caption, result);
      }
    }

    // NOTE: product-list messages intentionally do NOT send images over
    // WhatsApp. The single "best match" product-images card above already
    // sends the top result's photo; sending a thumbnail for every other
    // matched product as well is chatty and can duplicate images when
    // multiple catalog products share the same photo. The list itself is
    // still stored (see storeBotUiMessage) and viewable in the /inbox UI.

    if (message.type === 'content-results') {
      for (const section of message.contentSections || []) {
        if (section.kind === 'images') {
          for (const img of section.items) {
            const result = await this.messenger.sendImage(recipientPhone, img, undefined);
            await persistSent('image', img, undefined, result);
          }
        } else if (section.kind === 'videos') {
          for (const vid of section.items) {
            const result = await this.messenger.sendVideo(recipientPhone, vid, undefined);
            await persistSent('video', vid, undefined, result);
          }
        } else if (section.kind === 'documents') {
          for (const doc of section.items) {
            const result = await this.messenger.sendDocument(recipientPhone, doc, undefined, undefined);
            await persistSent('document', doc, undefined, result);
          }
        }
        // 'resources' has no direct WhatsApp media type -- intentionally skipped.
      }
    }

    return results;
  }

  private async storeBotUiMessage(
    organizationId: number,
    conversationId: number,
    payload: BotUiMessage,
    sentAt: Date,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
    });
    if (!conversation) return null;

    const message = await this.prisma.message.create({
      data: {
        organizationId: BigInt(organizationId),
        conversationId: conversation.id,
        whatsappNumberId: conversation.whatsappNumberId || null,
        senderType: 'bot',
        messageType: botUiMessageType(payload),
        messageText: JSON.stringify(payload),
        status: 'sent',
        sentAt,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});

    this.realtime.emitToOrg(organizationId, 'message:new', message);
    return message;
  }

  private async execute(
    nodes: any[],
    adjacency: Map<number, number[]>,
    node: any,
    conversationId: number,
    lastReply: string,
    organizationId: number,
  ) {
    if (!node) return;
    const config: any = node.config || {};
    const nextIds = adjacency.get(Number(node.id)) || [];

    switch (node.nodeType) {
      case 'start': {
        const next = nodes.find((n) => Number(n.id) === nextIds[0]);
        await this.execute(nodes, adjacency, next, conversationId, lastReply, organizationId);
        break;
      }
      case 'message': {
        await this.send(organizationId, conversationId, config.text || '');
        const next = nodes.find((n) => Number(n.id) === nextIds[0]);
        await this.execute(nodes, adjacency, next, conversationId, lastReply, organizationId);
        break;
      }
      case 'delay': {
        await this.sleep(config.ms || 1000);
        const next = nodes.find((n) => Number(n.id) === nextIds[0]);
        await this.execute(nodes, adjacency, next, conversationId, lastReply, organizationId);
        break;
      }
      case 'question':
      case 'button': {
        const buttons = config.buttons?.map((b: any) => b.text).join('\n') || '';
        const text = [config.text, buttons].filter(Boolean).join('\n');
        await this.send(organizationId, conversationId, text);
        this.sessions.set(conversationId, { nodeId: Number(node.id) });
        break;
      }
      case 'condition': {
        const conditions: { value?: string; targetNodeId?: number }[] =
          config.conditions || [];
        let targetId: number | undefined;
        for (const cond of conditions) {
          if (
            String(cond.value || '')
              .toLowerCase()
              .includes(lastReply.trim().toLowerCase())
          ) {
            targetId = cond.targetNodeId;
            break;
          }
        }
        if (!targetId) targetId = config.defaultTargetNodeId || nextIds[0];
        const next = nodes.find((n) => Number(n.id) === targetId);
        await this.execute(nodes, adjacency, next, conversationId, lastReply, organizationId);
        break;
      }
      case 'api': {
        const text =
          config.response ||
          `API call: ${config.url || 'https://example.com/api'} (simulated)`;
        await this.send(organizationId, conversationId, text);
        const next = nodes.find((n) => Number(n.id) === nextIds[0]);
        await this.execute(nodes, adjacency, next, conversationId, lastReply, organizationId);
        break;
      }
      case 'handover': {
        this.sessions.delete(conversationId);
        await this.prisma.conversation.update({
          where: { id: BigInt(conversationId) },
          data: { assignedAgentId: null, status: 'pending' },
        });
        await this.prisma.conversationNote.create({
          data: {
            conversationId: BigInt(conversationId),
            userId: BigInt(1),
            note: 'Bot handed this conversation over to the support team.',
          },
        });
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: BigInt(conversationId) },
        });
        this.realtime.emitToOrg(organizationId, 'conversation:updated', conversation);
        break;
      }
      case 'end': {
        if (config.text) await this.send(organizationId, conversationId, config.text);
        this.sessions.delete(conversationId);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Sends a plain text message, or — when `buttons` are provided — an
   * interactive WhatsApp message with those buttons attached (Quick Reply
   * and/or a single Website/URL button; see MessengerService.sendButtonsMessage
   * for the exact WhatsApp session-message rules this follows). If the
   * configured button combination requires an approved template (e.g. a
   * Call button, mixed button types, or more than one URL button), we fall
   * back to sending the plain text so the customer still gets a reply
   * instead of silently losing the message.
   */
  private async send(
    organizationId: number,
    conversationId: number,
    text: string,
    sentAt: Date = new Date(),
    buttons?: BotButton[],
  ) {
    if (!text) return null;
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
        include: { contact: true },
      });
      if (!conversation) return;
      const number = conversation.whatsappNumberId
        ? await this.prisma.whatsappNumber.findUnique({
            where: { id: conversation.whatsappNumberId },
          })
        : null;

      const cost = Number(this.config.get('COST_TEXT') || '0.10');
      try {
        await this.wallet.debit(
          organizationId,
          cost,
          'debit',
          `msg-${Date.now()}`,
          `Bot message to conversation ${conversationId}`,
        );
      } catch {
        // allow bot reply even if wallet is low to keep demo fluid
      }

      const recipientPhone = conversation.contact.mobile;
      const fullText = formatButtonsIntoText(text, buttons);

      let result: { metaMessageId: string; status: string; error?: string; requiresTemplate?: boolean };
      if (buttons && buttons.length > 0) {
        result = await this.messenger.sendButtonsMessage(recipientPhone, (fullText || text).slice(0, 1024), buttons);
        if (result.requiresTemplate) {
          // Button combo (e.g. mixed types, phone button, multiple URLs like Contact Us + Location)
          // isn't sendable as native interactive. Send full text with formatted clickable links!
          result = await this.messenger.sendText(recipientPhone, fullText);
        }
      } else {
        result = await this.messenger.sendText(recipientPhone, text);
      }

      const message = await this.prisma.message.create({
        data: {
          organizationId: BigInt(organizationId),
          conversationId: conversation.id,
          whatsappNumberId: number?.id || null,
          senderType: 'bot',
          messageType: 'text',
          messageText: fullText,
          metaMessageId: result.metaMessageId,
          status: result.status === 'failed' ? 'failed' : 'sent',
          sentAt,
        },
      });
      await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});

      this.realtime.emitToOrg(organizationId, 'message:new', message);

      if (result.status === 'failed') {
        this.realtime.emitToOrg(organizationId, 'message:status', {
          conversationId: Number(conversation.id),
          messageId: Number(message.id),
          status: 'failed',
        });
        return message;
      }
      this.scheduleStatus(organizationId, message.id, result.metaMessageId);
      return message;
    } catch {
      // never let bot failures break the incoming message flow
      return null;
    }
  }

  private scheduleStatus(organizationId: number, messageId: bigint, metaMessageId: string) {
    setTimeout(() => {
      this.applyStatus(organizationId, metaMessageId, 'delivered');
    }, 1500);
    if (Math.random() < 0.7) {
      setTimeout(() => {
        this.applyStatus(organizationId, metaMessageId, 'read');
      }, 4000);
    }
  }

  private async applyStatus(organizationId: number, metaMessageId: string, status: string) {
    try {
      const message = await this.prisma.message.findFirst({
        where: { organizationId: BigInt(organizationId), metaMessageId },
      });
      if (!message) return;
      await this.prisma.message.update({
        where: { id: message.id },
        data: status === 'delivered' ? { status, deliveredAt: new Date() } : { status, readAt: new Date() },
      });
      this.realtime.emitToOrg(organizationId, 'message:status', {
        conversationId: Number(message.conversationId),
        messageId: Number(message.id),
        status,
      });
    } catch {
      // ignore
    }
  }

  private getPublishedFlow(organizationId: number, flowId?: number) {
    return this.prisma.botFlow.findFirst({
      where: {
        organizationId: BigInt(organizationId),
        published: true,
        ...(flowId ? { id: BigInt(flowId) } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { nodes: true, connections: true },
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
