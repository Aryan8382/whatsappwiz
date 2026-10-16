import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';

export interface MessengerSendResult {
  metaMessageId: string;
  status: 'sent' | 'failed' | 'accepted';
  rawResponse?: any;
  error?: string;
}

export type BotButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'LOCATION';

export interface BotButton {
  id?: string;
  type: BotButtonType;
  text: string;
  value?: string; // URL or phone number; unused for QUICK_REPLY
}

/**
 * A media header (image/video/document) that can be attached directly to
 * a WhatsApp interactive message (buttons or CTA URL), so the media,
 * body text, and buttons all arrive as ONE message/bubble.
 */
export interface BotHeaderMedia {
  type: 'image' | 'video' | 'document';
  url: string;
  filename?: string; // only used for document headers
}

/**
 * Meta WhatsApp Cloud API integration.
 *
 * Required env vars:
 *   MESSENGER_API_BASE_URL    e.g. https://graph.facebook.com/v25.0
 *   MESSENGER_API_KEY         permanent System User access token
 *   MESSENGER_WABA_ID         WhatsApp Business Account ID
 *   MESSENGER_PHONE_NUMBER_ID Phone Number ID (used for sending + media)
 *   META_APP_SECRET           (optional) used to verify webhook signatures
 */
@Injectable()
export class MessengerService implements OnModuleInit {
  private readonly logger = new Logger(MessengerService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.logger.log('Initializing Meta WhatsApp Cloud API integration...');

    if (!this.apiKey) {
      this.logger.warn(
        'MESSENGER_API_KEY is not configured. API calls will run in fallback mode.',
      );
      return;
    }
    if (!this.phoneNumberId) {
      this.logger.warn('MESSENGER_PHONE_NUMBER_ID is not configured. Sending will fail.');
    }
    if (!this.wabaId) {
      this.logger.warn('MESSENGER_WABA_ID is not configured. Template APIs will fail.');
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { method: 'GET', headers: this.getHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        this.logger.log(
          `✅ Meta connection OK. Number: ${data.display_phone_number} (${data.verified_name}), quality: ${data.quality_rating}`,
        );
      } else {
        this.logger.error(
          `❌ Meta token/phone-number validation FAILED (${res.status}): ${data?.error?.message || JSON.stringify(data)}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Meta connection check error: ${err.message}`);
    }
  }

  // ==========================================
  // CONFIG HELPERS
  // ==========================================

  private get baseUrl(): string {
    return (
      this.config.get<string>('MESSENGER_API_BASE_URL') ||
      'https://graph.facebook.com/v25.0'
    ).replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return this.config.get<string>('MESSENGER_API_KEY') || '';
  }

  private get wabaId(): string {
    return this.config.get<string>('MESSENGER_WABA_ID') || '';
  }

  private get phoneNumberId(): string {
    return this.config.get<string>('MESSENGER_PHONE_NUMBER_ID') || '';
  }

  private get appSecret(): string {
    return this.config.get<string>('META_APP_SECRET') || '';
  }

  private getHeaders(
    contentType: string | null = 'application/json',
  ): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (contentType) headers['Content-Type'] = contentType;
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  private sanitizePhoneNumber(to: string): string {
    let clean = (to || '').replace(/[^\d]/g, '');
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.substring(1);
    }
    // Prevent double country code like 91917283805939
    if (clean.startsWith('9191') && clean.length === 14) {
      clean = clean.substring(2);
    }
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return clean;
  }

  private extractError(responseData: any, status: number): string {
    const e = responseData?.error;
    if (e && typeof e === 'object') {
      const details = e.error_data?.details;
      return (
        e.error_user_msg ||
        [e.message, details].filter(Boolean).join(' - ') ||
        JSON.stringify(e)
      );
    }
    if (typeof e === 'string') return e;
    return (
      responseData?.message ||
      `Meta API error (HTTP ${status}): ${JSON.stringify(responseData)}`
    );
  }

  /**
   * Builds the `interactive.header` object for a media header.
   */
  private buildMediaHeader(media: BotHeaderMedia): any {
    if (media.type === 'document') {
      return {
        type: 'document',
        document: {
          link: media.url,
          ...(media.filename ? { filename: media.filename } : {}),
        },
      };
    }
    return {
      type: media.type,
      [media.type]: { link: media.url },
    };
  }

  /**
   * Verify the X-Hub-Signature-256 header on an incoming Meta webhook.
   * `rawBody` must be the exact raw request body (Buffer or string),
   * not the parsed JSON. Enable `rawBody: true` in NestFactory.create().
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      this.logger.warn('META_APP_SECRET not set; skipping webhook signature verification.');
      return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    const received = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Status & Connectivity check
   */
  async getStatus(): Promise<{ tokenValid: boolean; wabaId?: string; baseUrl: string }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}?fields=display_phone_number`,
        { method: 'GET', headers: this.getHeaders() },
      );
      return { tokenValid: res.ok, wabaId: this.wabaId, baseUrl: this.baseUrl };
    } catch {
      return { tokenValid: false, wabaId: this.wabaId, baseUrl: this.baseUrl };
    }
  }

  // ==========================================
  // 1. USER APIS
  // Meta has no equivalent of the old "users" endpoints. Kept as
  // compatibility stubs so existing callers don't crash.
  // ==========================================

  async listUsers(_userType?: 'business' | 'waba_users' | string): Promise<any> {
    return {
      data: this.wabaId ? [{ whatsapp_business_account_id: this.wabaId }] : [],
    };
  }

  async createBusinessUser(_data: any): Promise<any> {
    return {
      success: false,
      error: 'createBusinessUser is not supported on Meta Cloud API. Manage accounts in Meta Business Manager.',
    };
  }

  async createWabaUser(_data: any): Promise<any> {
    return {
      success: false,
      error: 'createWabaUser is not supported on Meta Cloud API. Manage accounts in Meta Business Manager.',
    };
  }

  // ==========================================
  // 2. CONVERSATIONS
  // Meta has no "list conversations" endpoint. Messages must be stored in
  // your own database from webhook events (inbound) and send results
  // (outbound). This returns an empty shape so existing callers still work.
  // ==========================================

  async getConversations(_phoneNumber?: string, _page?: number): Promise<any> {
    return { data: { messsages: [] } };
  }

  // ==========================================
  // 3. TEMPLATES
  // GET/POST /{WABA_ID}/message_templates
  // ==========================================

  async getTemplates(limit: number = 1000): Promise<any> {
    if (!this.wabaId) {
      this.logger.error('getTemplates: MESSENGER_WABA_ID is not set');
      return { data: [] };
    }
    const all: any[] = [];
    let after: string | undefined;
    const pageSize = 100;

    try {
      while (all.length < limit) {
        const params = new URLSearchParams({
          limit: String(Math.min(pageSize, limit - all.length)),
          fields: 'id,name,status,category,language,components,rejected_reason',
        });
        if (after) params.set('after', after);

        const res = await fetch(
          `${this.baseUrl}/${this.wabaId}/message_templates?${params.toString()}`,
          { method: 'GET', headers: this.getHeaders() },
        );
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(this.extractError(json, res.status));
        }
        all.push(...(json.data || []));
        after = json?.paging?.cursors?.after;
        if (!json?.paging?.next || !after) break;
      }
      return { data: all };
    } catch (err: any) {
      this.logger.error(`getTemplates error: ${err.message}`);
      return { data: [] };
    }
  }

  /** Meta requires sample values for every {{n}} variable. */
  private sampleValues(text: string): string[] {
    const nums = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const max = nums.length ? Math.max(...nums) : 0;
    return Array.from({ length: max }, (_, i) => `sample${i + 1}`);
  }

  /**
   * Upload sample media to Meta Resumable Upload API to obtain header_handle
   * Required by Meta for message templates with IMAGE, VIDEO, or DOCUMENT headers.
   */
  async uploadMediaHandle(mediaUrlOrPath: string, mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'): Promise<string | null> {
    try {
      if (!this.apiKey) return null;

      let fileBuffer: Buffer | null = null;
      let mimeType = mediaType === 'IMAGE' ? 'image/jpeg' : mediaType === 'VIDEO' ? 'video/mp4' : 'application/pdf';

      // 1. Check local file system
      let localPath = '';
      if (mediaUrlOrPath.includes('/uploads/')) {
        const filename = mediaUrlOrPath.split('/uploads/')[1].split('?')[0];
        localPath = join(process.cwd(), 'uploads', filename);
      } else if (existsSync(mediaUrlOrPath)) {
        localPath = mediaUrlOrPath;
      }

      if (localPath && existsSync(localPath)) {
        fileBuffer = readFileSync(localPath);
        const ext = extname(localPath).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.mp4') mimeType = 'video/mp4';
        else if (ext === '.pdf') mimeType = 'application/pdf';
      } else if (/^https?:\/\//i.test(mediaUrlOrPath)) {
        const fRes = await fetch(mediaUrlOrPath);
        if (fRes.ok) {
          const ab = await fRes.arrayBuffer();
          fileBuffer = Buffer.from(ab);
          const ct = fRes.headers.get('content-type');
          if (ct) mimeType = ct;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        this.logger.warn(`No sample file buffer resolved for ${mediaUrlOrPath}`);
        return null;
      }

      // 2. Discover Meta App ID
      let appId = this.config.get<string>('META_APP_ID');
      if (!appId) {
        const appRes = await fetch(`${this.baseUrl}/app?fields=id`, {
          headers: this.getHeaders(),
        });
        const appData = await appRes.json().catch(() => ({}));
        if (appData?.id) appId = appData.id;
      }
      if (!appId) {
        this.logger.warn('Could not determine Meta App ID for resumable upload.');
        return null;
      }

      // 3. Initiate Upload Session on POST /{app_id}/uploads
      const sessionUrl = `${this.baseUrl}/${appId}/uploads?file_length=${fileBuffer.length}&file_type=${encodeURIComponent(mimeType)}`;
      const sessionRes = await fetch(sessionUrl, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
      });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const uploadSessionId = sessionData?.id;
      if (!uploadSessionId) {
        this.logger.warn(`Failed to create Meta upload session: ${JSON.stringify(sessionData)}`);
        return null;
      }

      // 4. Upload raw file chunks to POST /{upload_session_id}
      const chunkUrl = `${this.baseUrl}/${uploadSessionId}`;
      const chunkRes = await fetch(chunkUrl, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${this.apiKey}`,
          file_offset: '0',
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(fileBuffer),
      });
      const chunkData = await chunkRes.json().catch(() => ({}));
      if (chunkData?.h) {
        this.logger.log(`✅ Uploaded sample media to Meta Resumable API! Header Handle: ${chunkData.h}`);
        return chunkData.h;
      }
      this.logger.warn(`Resumable upload did not return handle h: ${JSON.stringify(chunkData)}`);
      return null;
    } catch (err: any) {
      this.logger.error(`Error in uploadMediaHandle: ${err.message}`);
      return null;
    }
  }

  /**
   * Submit New Template for Meta Approval
   * POST /{WABA_ID}/message_templates
   */
  async createTemplate(data: {
    name: string;
    category: string;
    language: string;
    header?: string | null;
    headerMediaUrl?: string | null;
    body: string;
    footer?: string | null;
    buttons?: any[];
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.wabaId) {
      return { success: false, error: 'MESSENGER_WABA_ID is not configured' };
    }

    const cleanName = data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const components: any[] = [];

    if (data.header && data.header.trim()) {
      const headerText = data.header.trim();
      const upper = headerText.toUpperCase();
      if (upper === '[IMAGE]' || upper === 'IMAGE') {
        let handle: string | null = null;
        if (data.headerMediaUrl) {
          handle = await this.uploadMediaHandle(data.headerMediaUrl, 'IMAGE');
        }
        components.push({
          type: 'HEADER',
          format: 'IMAGE',
          ...(handle ? { example: { header_handle: [handle] } } : {}),
        });
      } else if (upper === '[VIDEO]' || upper === 'VIDEO') {
        let handle: string | null = null;
        if (data.headerMediaUrl) {
          handle = await this.uploadMediaHandle(data.headerMediaUrl, 'VIDEO');
        }
        components.push({
          type: 'HEADER',
          format: 'VIDEO',
          ...(handle ? { example: { header_handle: [handle] } } : {}),
        });
      } else if (upper === '[DOCUMENT]' || upper === 'DOCUMENT') {
        let handle: string | null = null;
        if (data.headerMediaUrl) {
          handle = await this.uploadMediaHandle(data.headerMediaUrl, 'DOCUMENT');
        }
        components.push({
          type: 'HEADER',
          format: 'DOCUMENT',
          ...(handle ? { example: { header_handle: [handle] } } : {}),
        });
      } else {
        const headerSamples = this.sampleValues(headerText);
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText,
          ...(headerSamples.length ? { example: { header_text: [headerSamples[0]] } } : {}),
        });
      }
    }

    const bodyText = data.body.trim();
    const bodySamples = this.sampleValues(bodyText);
    components.push({
      type: 'BODY',
      text: bodyText,
      ...(bodySamples.length ? { example: { body_text: [bodySamples] } } : {}),
    });

    if (data.footer && data.footer.trim()) {
      components.push({ type: 'FOOTER', text: data.footer.trim() });
    }

    if (data.buttons && data.buttons.length > 0) {
      const formattedBtns = data.buttons.map((b) => {
        if (b.type === 'URL') {
          let urlVal = String(b.value || b.url || '').trim();
          if (!/^https?:\/\//i.test(urlVal) && !urlVal.includes('{{')) {
            urlVal = `https://${urlVal}`;
          }
          const isDynamic = urlVal.includes('{{');
          return {
            type: 'URL',
            text: b.text.slice(0, 20),
            url: urlVal,
            ...(isDynamic
              ? { example: [String(urlVal).replace(/\{\{\d+\}\}/g, 'sample')] }
              : {}),
          };
        } else if (b.type === 'PHONE_NUMBER') {
          const rawPhone = String(b.value || b.phone_number || '').replace(/[^\d+]/g, '');
          const cleanPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
          return {
            type: 'PHONE_NUMBER',
            text: b.text.slice(0, 20),
            phone_number: cleanPhone,
          };
        } else if (b.type === 'COUPON') {
          return {
            type: 'COPY_CODE',
            example: String(b.value || 'PROMO'),
          };
        }
        return { type: 'QUICK_REPLY', text: b.text.slice(0, 20) };
      });
      components.push({ type: 'BUTTONS', buttons: formattedBtns });
    }

    const payload = {
      name: cleanName,
      category: (data.category || 'MARKETING').toUpperCase(),
      language: data.language || 'en',
      components,
    };

    const url = `${this.baseUrl}/${this.wabaId}/message_templates`;
    this.logger.log(`Submitting template to Meta: POST ${url} payload: ${JSON.stringify(payload)}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(payload),
      });
      const responseData: any = await res.json().catch(() => ({}));

      if (!res.ok || responseData?.error) {
        const errorMsg = this.extractError(responseData, res.status);
        this.logger.error(
          `❌ Meta Template Creation FAILED (${res.status}): ${errorMsg} | Response: ${JSON.stringify(responseData)}`,
        );
        return { success: false, error: errorMsg, data: responseData };
      }

      // Success shape: { id, status: "PENDING", category }
      this.logger.log(`✅ Meta Template Creation SUCCESS: ${JSON.stringify(responseData)}`);
      return { success: true, data: responseData };
    } catch (err: any) {
      this.logger.error(`Meta Template Creation exception: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // 4. SEND APIS
  // POST /{PHONE_NUMBER_ID}/messages
  // Note: free-form (non-template) messages only deliver inside the
  // 24-hour customer service window. Outside it, use sendTemplate.
  // ==========================================

  private async executeSend(rawPayload: any): Promise<MessengerSendResult> {
    const payload = { messaging_product: 'whatsapp', ...rawPayload };
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    this.logger.log(
      `Calling Meta API: POST ${url} for recipient ${payload.to} with payload: ${JSON.stringify(payload)}`,
    );

    try {
      if (!this.apiKey) {
        this.logger.warn('MESSENGER_API_KEY is not set. Generating fallback message ID.');
        return {
          metaMessageId: `wamid.${randomUUID().replace(/-/g, '')}`,
          status: 'sent',
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(payload),
      });
      const responseData: any = await res.json().catch(() => ({}));

      if (!res.ok || responseData?.error) {
        const errorMsg = this.extractError(responseData, res.status);
        this.logger.error(
          `❌ Meta Send FAILED (${res.status}): ${errorMsg} | Response: ${JSON.stringify(responseData)}`,
        );
        return {
          metaMessageId: `wamid.failed.${Date.now()}`,
          status: 'failed',
          error: errorMsg,
          rawResponse: responseData,
        };
      }

      const messageId =
        responseData?.messages?.[0]?.id || `wamid.${randomUUID().replace(/-/g, '')}`;

      this.logger.log(`✅ Meta Send SUCCESS: ${messageId}`);
      return { metaMessageId: messageId, status: 'sent', rawResponse: responseData };
    } catch (error: any) {
      this.logger.error(`Meta API call exception: ${error.message}`);
      return {
        metaMessageId: `wamid.err.${Date.now()}`,
        status: 'failed',
        error: error.message,
      };
    }
  }

  async sendText(
    to: string,
    text: string | { body?: string; text?: string },
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    let bodyText = '';
    if (typeof text === 'string') {
      bodyText = text;
    } else if (text && typeof text === 'object') {
      bodyText = text.body || text.text || '';
    } else if (text) {
      bodyText = String(text);
    }
    bodyText = bodyText.trim() || 'Hello';

    return this.executeSend({
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { body: bodyText },
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessengerSendResult> {
    const payload: any = {
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'image',
      image: { link: imageUrl },
    };
    if (caption && caption.trim()) payload.image.caption = caption.trim();
    return this.executeSend(payload);
  }

  async sendVideo(to: string, videoUrl: string, caption?: string): Promise<MessengerSendResult> {
    const payload: any = {
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'video',
      video: { link: videoUrl },
    };
    if (caption && caption.trim()) payload.video.caption = caption.trim();
    return this.executeSend(payload);
  }

  async sendDocument(
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string,
  ): Promise<MessengerSendResult> {
    const payload: any = {
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'document',
      document: { link: documentUrl },
    };
    if (filename && filename.trim()) payload.document.filename = filename.trim();
    if (caption && caption.trim()) payload.document.caption = caption.trim();
    return this.executeSend(payload);
  }

  async sendAudio(to: string, audioUrl: string): Promise<MessengerSendResult> {
    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'audio',
      audio: { link: audioUrl },
    });
  }

  async sendLocation(
    to: string,
    location: { longitude: number; latitude: number; name?: string; address?: string },
  ): Promise<MessengerSendResult> {
    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'location',
      location: {
        longitude: location.longitude,
        latitude: location.latitude,
        name: location.name || 'Location',
        address: location.address || '',
      },
    });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components: any[] = [],
  ): Promise<MessengerSendResult> {
    const payload: any = {
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'template',
      template: {
        name: (templateName || '').trim(),
        language: { code: (languageCode || 'en').trim() },
      },
    };
    if (components && components.length > 0) {
      payload.template.components = components;
    }
    return this.executeSend(payload);
  }

  async sendInteractiveButtons(
    to: string,
    text: string,
    buttons: Array<{ id: string; title: string }>,
    opts?: { headerText?: string; headerMedia?: BotHeaderMedia; footerText?: string },
  ): Promise<MessengerSendResult> {
    const interactive: any = {
      type: 'button',
      body: { text: (text || ' ').slice(0, 1024) },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) }, // Meta limit: 20 chars
        })),
      },
    };
    if (opts?.headerMedia) {
      interactive.header = this.buildMediaHeader(opts.headerMedia);
    } else if (opts?.headerText) {
      interactive.header = { type: 'text', text: opts.headerText.slice(0, 60) };
    }
    if (opts?.footerText) interactive.footer = { text: opts.footerText.slice(0, 60) };

    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  async sendInteractiveCtaUrl(
    to: string,
    bodyText: string,
    displayText: string,
    url: string,
    headerText?: string,
    footerText?: string,
    headerMedia?: BotHeaderMedia,
  ): Promise<MessengerSendResult> {
    const interactive: any = {
      type: 'cta_url',
      body: { text: (bodyText || ' ').slice(0, 1024) },
      action: {
        name: 'cta_url',
        parameters: { display_text: displayText.slice(0, 20), url },
      },
    };
    if (headerMedia) {
      interactive.header = this.buildMediaHeader(headerMedia);
    } else if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) interactive.footer = { text: footerText };

    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string,
  ): Promise<MessengerSendResult> {
    const interactive: any = {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    };
    if (headerText) interactive.header = { type: 'text', text: headerText };
    if (footerText) interactive.footer = { text: footerText };

    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  async sendInteractiveAddress(
    to: string,
    bodyText: string,
    country: 'IN' | 'SG',
    customerName: string,
    phoneNumber: string,
  ): Promise<MessengerSendResult> {
    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'interactive',
      interactive: {
        type: 'address_message',
        body: { text: bodyText },
        action: {
          name: 'address_message',
          parameters: {
            country,
            values: {
              name: customerName,
              phone_number: this.sanitizePhoneNumber(phoneNumber),
            },
          },
        },
      },
    });
  }

  async sendInteractiveFlow(
    to: string,
    flowData: {
      flowId: string;
      flowCta: string;
      flowToken?: string;
      flowAction?: string;
      screen?: string;
      header?: string;
      body: string;
      footer?: string;
    },
  ): Promise<MessengerSendResult> {
    const interactive: any = {
      type: 'flow',
      body: { text: flowData.body },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowData.flowToken || `flow_${Date.now()}`,
          flow_id: flowData.flowId,
          flow_cta: flowData.flowCta,
          flow_action: flowData.flowAction || 'navigate',
          flow_action_payload: { screen: flowData.screen || 'welcome' },
        },
      },
    };
    if (flowData.header) interactive.header = { type: 'text', text: flowData.header };
    if (flowData.footer) interactive.footer = { text: flowData.footer };

    return this.executeSend({
      recipient_type: 'individual',
      to: this.sanitizePhoneNumber(to),
      type: 'interactive',
      interactive,
    });
  }

  // ==========================================
  // 4b. BOT-CONFIGURED BUTTONS ROUTING
  // ==========================================

  /**
   * Routes bot-configured buttons to the correct WhatsApp message type:
   *  - QUICK_REPLY only, up to 3          -> sendInteractiveButtons
   *  - Exactly one URL button, no others  -> sendInteractiveCtaUrl
   *  - Phone button / mixed / >1 URL      -> needs an approved template
   */
  async sendButtonsMessage(
    to: string,
    bodyText: string,
    buttons: BotButton[],
    opts?: { headerText?: string; footerText?: string; headerMedia?: BotHeaderMedia },
  ): Promise<MessengerSendResult & { requiresTemplate?: boolean }> {
    const cleaned = (buttons || [])
      .map((b) => ({
        id: b.id || randomUUID(),
        type: b.type,
        text: (b.text || '').trim(),
        value: (b.value || '').trim(),
      }))
      .filter((b) => b.text)
      .slice(0, 3);

    if (cleaned.length === 0) {
      return this.sendText(to, bodyText);
    }

    // Case 1: Exactly one URL button and no other buttons -> send native CTA URL button
    if (cleaned.length === 1 && cleaned[0].type === 'URL') {
      const btn = cleaned[0];
      let urlVal = btn.value;
      if (urlVal && !/^https?:\/\//i.test(urlVal)) {
        urlVal = `https://${urlVal}`;
      }
      return this.sendInteractiveCtaUrl(
        to,
        bodyText,
        btn.text.slice(0, 20),
        urlVal,
        opts?.headerText,
        opts?.footerText,
        opts?.headerMedia,
      );
    }

    // Case 2: Interactive reply buttons (supports up to 3 buttons: Quick Reply, Call, URL, Location)
    const replyButtons = cleaned.map((b) => {
      let title = b.text.trim();
      const isCall = b.type === 'PHONE_NUMBER' || /call|phone/i.test(title);
      const isLoc = b.type === 'LOCATION' || /location|map|address|store/i.test(title);
      if (isCall && !title.includes('📞')) {
        title = `📞 ${title}`;
      } else if (isLoc && !title.includes('📍')) {
        title = `📍 ${title}`;
      } else if (b.type === 'URL' && !title.includes('🌐') && !title.includes('🔗')) {
        title = `🌐 ${title}`;
      }
      return {
        id: b.id,
        title: title.slice(0, 20),
      };
    });

    try {
      const interactiveRes = await this.sendInteractiveButtons(
        to,
        bodyText,
        replyButtons,
        {
          headerText: opts?.headerText,
          headerMedia: opts?.headerMedia,
          footerText: opts?.footerText,
        },
      );
      if (interactiveRes.status !== 'failed') {
        return interactiveRes;
      }
    } catch (err: any) {
      this.logger.warn(`sendInteractiveButtons fallback for ${to}: ${err.message}`);
    }

    // Fallback: send text message with bodyText
    return this.sendText(to, bodyText);
  }

  // ==========================================
  // 5. MEDIA APIS
  // ==========================================

  /**
   * Upload Media
   * POST /{PHONE_NUMBER_ID}/media
   * Pass FormData containing a `file` field (a Blob/File with a proper
   * mime type). `messaging_product` is added automatically.
   * Returns { id } which can be used as `{ id }` instead of `{ link }`.
   */
  async uploadMedia(formData: FormData): Promise<any> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/media`;
    try {
      if (!formData.has('messaging_product')) {
        formData.append('messaging_product', 'whatsapp');
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(null),
        body: formData as any,
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`uploadMedia error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get Media metadata (includes a temporary `url`, valid ~5 minutes).
   * GET /{MEDIA_ID}
   */
  async getMedia(mediaId: string): Promise<any> {
    const url = `${this.baseUrl}/${encodeURIComponent(mediaId)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`getMedia error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Download the actual media bytes (the media URL requires the bearer token).
   */
  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const meta = await this.getMedia(mediaId);
    if (!meta?.url) {
      throw new Error(`Media URL not found: ${JSON.stringify(meta)}`);
    }
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    if (!res.ok) throw new Error(`Media download failed (${res.status})`);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: meta.mime_type || res.headers.get('content-type') || 'application/octet-stream',
    };
  }

  // ==========================================
  // 6. WEBHOOK
  // The main callback URL + verify token are set in the Meta dashboard
  // (WhatsApp > Configuration). These methods manage the app's
  // subscription to your WABA and an optional per-WABA callback override.
  // ==========================================

  async getWebhookInfo(): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/${this.wabaId}/subscribed_apps`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`Get webhook info error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Subscribe the app to the WABA, optionally overriding the callback URL.
   */
  async registerWebhook(webhookUrl?: string): Promise<any> {
    const body: any = {};
    if (webhookUrl) {
      body.override_callback_uri = webhookUrl;
      body.verify_token =
        this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN') ||
        this.config.get<string>('MESSENGER_WEBHOOK_VERIFY_TOKEN') ||
        '';
    }
    try {
      const res = await fetch(`${this.baseUrl}/${this.wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        this.logger.log(`Subscribed app to WABA ${this.wabaId}${webhookUrl ? ` (callback: ${webhookUrl})` : ''}`);
      } else {
        this.logger.error(`Webhook subscribe failed: ${this.extractError(data, res.status)}`);
      }
      return { success: res.ok, data };
    } catch (err: any) {
      this.logger.error(`Webhook registration error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async deleteWebhook(): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/${this.wabaId}/subscribed_apps`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`Delete webhook error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}