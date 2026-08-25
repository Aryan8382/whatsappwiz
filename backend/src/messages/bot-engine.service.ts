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

const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    return (
      SUPPORTED_IMAGE_EXT.some(ext => pathname.endsWith(ext)) ||
      u.hostname.includes('pexels.com') ||
      u.hostname.includes('unsplash.com') ||
      u.hostname.includes('pixabay.com') ||
      u.hostname.includes('cdn') ||
      u.hostname.includes('cloudinary') ||
      u.searchParams.has('w') ||
      u.searchParams.has('width')
    );
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
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
      const saved: any[] = [];

      if (isPureGreeting(reply)) {
        // Combine the header media (image/video/document) and the first
        // text message into a SINGLE WhatsApp message by sending the media
        // with the text as its caption, instead of two separate bubbles.
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
          // Header media (and buttons, if any) sent successfully.
          saved.push(...headerSaved);
        } else if (caption) {
          // No header media configured (or it failed) — fall back to
          // sending the text on its own so we don't lose the greeting.
          const sentText = await this.send(
            organizationId,
            conversationId,
            caption,
            new Date(),
            captionButtons,
          );
          if (sentText) saved.push(sentText);
        }

        if (remaining.length > 0) {
          saved.push(
            ...(await this.sendBotUiMessages(organizationId, conversationId, remaining)),
          );
        }
      } else {
        const botMessages = buildBotUiMessages(reply, botConfig, flow.name);
        if (botMessages.length > 0) {
          saved.push(...(await this.sendBotUiMessages(organizationId, conversationId, botMessages)));
        }
      }

      if (saved.length > 0) return saved;
    }

    const textLower = reply.trim().toLowerCase();
    if (textLower && botConfig && Array.isArray(botConfig.products) && botConfig.products.length > 0) {
      const companyName = botConfig.companyName || 'our store';
      const keywords = extractKeywords(reply);
      const isOnlyGreeting = matchesAny(textLower, GREETING_WORDS) && keywords.length === 0;

      if (isOnlyGreeting) {
        const defaultGreeting = `👋 Hello there! Welcome to ${companyName}!\n\nThank you for reaching out to us. We're delighted to help you find the perfect piece from our collection.\n\nHow can we assist you today? Feel free to ask about any product or describe what you're looking for!`;
        await this.send(organizationId, conversationId, botConfig.greeting || defaultGreeting);
        return;
      }

      const searchResult = searchContentLibrary(reply, botConfig.products);

      if (searchResult.matchedProducts.length === 1) {
        const single = searchResult.matchedProducts[0];
        const priceStr = single.price ? `\nPrice: ${single.currency || '₹'}${single.price}` : '';
        const descStr = single.description ? `\n${single.description}` : '';
        let respText = `✨ *${single.name}*${priceStr}${descStr}`;

        if (Array.isArray(single.images) && single.images.length > 0) {
          respText += `\n🖼️  Images: ${single.images.length}`;
          const validImgs = single.images.filter(isValidImageUrl);
          if (validImgs.length > 0) respText += `\nFirst: ${validImgs[0]}`;
        }
        if (Array.isArray(single.videos) && single.videos.length > 0) {
          respText += `\n🎥  Videos: ${single.videos.length}\n${single.videos[0]}`;
        }
        if (Array.isArray(single.documents) && single.documents.length > 0) {
          respText += `\n📄  Documents: ${single.documents.length}\n${single.documents[0]}`;
        }
        await this.send(organizationId, conversationId, respText);
        return;
      }

      const hasImages = searchResult.images.length > 0;
      const hasDocs = searchResult.documents.length > 0;
      const hasVideos = searchResult.videos.length > 0;
      const hasProducts = searchResult.matchedProducts.length > 0;

      if (!hasImages && !hasDocs && !hasVideos && !hasProducts) {
        const fallbackHint =
          `I couldn't find exact matches for your search in ${companyName}'s library 😔\n\n` +
          `Try searching with product names, categories, or keywords like:\n` +
          botConfig.products
            .slice(0, 5)
            .map((p: any) => `• *${p.name}*: ${(Array.isArray(p.keywords) ? p.keywords : []).slice(0, 2).join(', ')}`)
            .join('\n');
        await this.send(organizationId, conversationId, fallbackHint);
        return;
      }

      const totalCount =
        searchResult.images.length +
        searchResult.documents.length +
        searchResult.videos.length;
      const kwDisplay =
        searchResult.matchedKeywords.length > 0
          ? `for "${searchResult.matchedKeywords
              .slice(0, 4)
              .map(k => k[0].toUpperCase() + k.slice(1))
              .join(', ')}"`
          : 'for you';

      let respText = `🔍 Found ${totalCount} relevant items ${kwDisplay} in ${companyName}'s content library ✨\n`;

      if (hasImages) respText += `\n🖼️  Images (${searchResult.images.length}):\n${searchResult.images.slice(0, 3).join('\n')}`;
      if (searchResult.images.length > 3) respText += `\n…+${searchResult.images.length - 3} more images`;

      if (hasVideos) respText += `\n\n🎥  Videos (${searchResult.videos.length}):\n${searchResult.videos.slice(0, 2).join('\n')}`;
      if (searchResult.videos.length > 2) respText += `\n…+${searchResult.videos.length - 2} more videos`;

      if (hasDocs) respText += `\n\n📄  Documents (${searchResult.documents.length}):\n${searchResult.documents.slice(0, 2).join('\n')}`;
      if (searchResult.documents.length > 2) respText += `\n…+${searchResult.documents.length - 2} more docs`;

      if (hasProducts) {
        const names = searchResult.matchedProducts
          .slice(0, 5)
          .map((p: any) => `• *${p.name}*`)
          .join('\n');
        const more = searchResult.matchedProducts.length > 5
          ? `\n…+${searchResult.matchedProducts.length - 5} more products`
          : '';
        respText += `\n\nMatching products:\n${names}${more}`;
      }

      await this.send(organizationId, conversationId, respText);
      return;
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
      this.realtime.emitToOrg(organizationId, 'message:new', saved);
      return saved;
    };

    // If buttons are configured, try to send ONE WhatsApp interactive
    // message with the media as its header, the caption as the body text,
    // and the buttons attached — this renders as a single bubble on
    // WhatsApp, matching how the bot builder preview looks.
    if (buttons && buttons.length > 0) {
      try {
        const result = await this.messenger.sendButtonsMessage(
          recipientPhone,
          caption || ' ',
          buttons,
          { headerMedia: { type, url: headerMediaUrl } },
        );
        if (!result.requiresTemplate) {
          return [await persist(result, caption || null)];
        }
        // Button combination isn't sendable on a plain session message
        // (e.g. a Call button, mixed types, or 2+ URL buttons) — fall
        // through to sending media + a separate button message below so
        // nothing is silently dropped.
      } catch {
        // fall through to plain media below
      }
    }

    let result: { metaMessageId: string; status: string };
    try {
      if (type === 'image') {
        result = await this.messenger.sendImage(recipientPhone, headerMediaUrl, caption);
      } else if (type === 'video') {
        result = await this.messenger.sendVideo(recipientPhone, headerMediaUrl, caption);
      } else {
        result = await this.messenger.sendDocument(recipientPhone, headerMediaUrl, undefined, caption);
      }
    } catch {
      // never let header media failures break the rest of the bot reply
      return [];
    }

    const mediaSaved = await persist(result, caption || null);
    const savedMessages = [mediaSaved];

    if (buttons && buttons.length > 0) {
      const buttonFollowUp = await this.send(
        organizationId,
        conversationId,
        'Please choose an option below:',
        new Date(),
        buttons,
      );
      if (buttonFollowUp) savedMessages.push(buttonFollowUp);
    }

    return savedMessages;
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

      let result: { metaMessageId: string; status: string; error?: string; requiresTemplate?: boolean };
      if (buttons && buttons.length > 0) {
        result = await this.messenger.sendButtonsMessage(recipientPhone, text, buttons);
        if (result.requiresTemplate) {
          // Button combo (e.g. mixed types, phone button, multiple URLs)
          // isn't sendable as a plain session message. Don't drop the
          // reply entirely — fall back to plain text.
          result = await this.messenger.sendText(recipientPhone, text);
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
          messageText: text,
          metaMessageId: result.metaMessageId,
          status: result.status === 'failed' ? 'failed' : 'sent',
          sentAt,
        },
      });

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
      include: { nodes: true, connections: true },
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}