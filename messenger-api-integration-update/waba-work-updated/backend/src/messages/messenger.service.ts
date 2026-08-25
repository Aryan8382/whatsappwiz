import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface MessengerSendResult {
  metaMessageId: string;
  status: 'sent' | 'failed' | 'accepted';
  rawResponse?: any;
  error?: string;
}

@Injectable()
export class MessengerService implements OnModuleInit {
  private readonly logger = new Logger(MessengerService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.logger.log(`Initializing Messenger API integration...`);
    if (!this.apiKey) {
      this.logger.warn(
        `MESSENGER_API_KEY is not configured in backend/.env. API calls will run in fallback mode.`,
      );
      return;
    }
    this.logger.log(
      `MESSENGER_API_KEY configured (length: ${this.apiKey.length}). Validating token with Messenger API...`,
    );
    // Warn if WABA ID is still placeholder
    if (this.wabaId === 'YOUR_WABA_ID' || !this.wabaId) {
      this.logger.warn(`MESSENGER_WABA_ID is set to placeholder. x-waba-id header will not be sent.`);
    }
    try {
      const res = await fetch(`${this.baseUrl}/get_templates?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        this.logger.log(`✅ Messenger API connection SUCCESSFUL. Token is active and valid.`);
      } else {
        this.logger.error(
          `❌ Messenger API Token Validation FAILED (${res.status}): ${data.message || data.error || JSON.stringify(data)}. Please regenerate MESSENGER_API_KEY in backend/.env`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Messenger API connection check error: ${err.message}`,
      );
    }
  }

  private get baseUrl(): string {
    return (
      this.config.get<string>('MESSENGER_API_BASE_URL') ||
      'https://live.themessenger.app/api'
    ).replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return (
      this.config.get<string>('MESSENGER_API_KEY') ||
      ''
    );
  }

  private get wabaId(): string {
    return this.config.get<string>('MESSENGER_WABA_ID') || '';
  }

  private get conversationsPath(): string {
    return (
      this.config.get<string>('MESSENGER_CONVERSATIONS_PATH') ||
      '/conversations'
    );
  }

  private getHeaders(contentType: string | null = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.wabaId && this.wabaId !== 'YOUR_WABA_ID') {
      headers['x-waba-id'] = this.wabaId;
    }
    return headers;
  }

  /**
   * Check API connectivity and token validity.
   * Returns a simple status object.
   */
  async getStatus(): Promise<{ tokenValid: boolean; wabaId?: string; placeholderWabaId: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/get_templates?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const ok = res.ok;
      // placeholder detection
      const placeholder = this.wabaId === 'YOUR_WABA_ID' || !this.wabaId;
      return { tokenValid: ok, wabaId: this.wabaId, placeholderWabaId: placeholder };
    } catch (err) {
      this.logger.error(`Status check error: ${err instanceof Error ? err.message : err}`);
      return { tokenValid: false, wabaId: this.wabaId, placeholderWabaId: true };
    }
  }

  /**
   * 1. Send Text Message via Messenger API
   * POST /send
   */
  async sendText(to: string, text: string | { body?: string; text?: string }): Promise<MessengerSendResult> {
    const cleanTo = to.replace(/[^\d]/g, '');
    let bodyText = '';
    if (typeof text === 'string') {
      bodyText = text;
    } else if (text && typeof text === 'object') {
      bodyText = text.body || text.text || '';
    } else if (text) {
      bodyText = String(text);
    }
    bodyText = bodyText.trim();
    if (!bodyText) {
      bodyText = 'Hello';
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        body: bodyText,
      },
    };

    return this.executeSend(payload);
  }

  /**
   * 2. Send Image Message via Messenger API
   * POST /send
   */
  async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessengerSendResult> {
    const cleanTo = to.replace(/[^\d]/g, '');
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'image',
      image: {
        link: imageUrl,
      },
    };
    if (caption && caption.trim()) {
      payload.image.caption = caption.trim();
    }

    return this.executeSend(payload);
  }

  /**
   * 3. Send Video Message via Messenger API
   * POST /send
   */
  async sendVideo(to: string, videoUrl: string, caption?: string): Promise<MessengerSendResult> {
    const cleanTo = to.replace(/[^\d]/g, '');
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'video',
      video: {
        link: videoUrl,
      },
    };
    if (caption && caption.trim()) {
      payload.video.caption = caption.trim();
    }

    return this.executeSend(payload);
  }

  /**
   * 4. Send Document Message via Messenger API
   * POST /send
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = to.replace(/[^\d]/g, '');
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'document',
      document: {
        link: documentUrl,
      },
    };
    if (filename && filename.trim()) payload.document.filename = filename.trim();
    if (caption && caption.trim()) payload.document.caption = caption.trim();

    return this.executeSend(payload);
  }

  /**
   * 5. Send Template Message via Messenger API
   * POST /send
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en_GB',
    components: any[] = [],
  ): Promise<MessengerSendResult> {
    let cleanTo = (to || '').replace(/[^\d]/g, '');
    if (cleanTo.startsWith('0') && cleanTo.length === 11) {
      cleanTo = cleanTo.substring(1);
    }
    if (cleanTo.length === 10) {
      cleanTo = `91${cleanTo}`;
    }
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode || 'en_GB',
        },
      },
    };
    if (components && components.length > 0) {
      payload.template.components = components;
    }

    return this.executeSend(payload);
  }

  /**
   * Helper to execute POST /send to Messenger API
   */
  private async executeSend(payload: any): Promise<MessengerSendResult> {
    const url = `${this.baseUrl}/send`;
    this.logger.log(
      `MESSENGER_API_KEY configured: ${this.apiKey ? 'YES' : 'NO'}, length: ${this.apiKey.length}, MESSENGER_API_BASE_URL: ${this.baseUrl}`,
    );
    this.logger.log(`Calling Messenger API: POST ${url} for recipient ${payload.to} with payload: ${JSON.stringify(payload)}`);

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

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = responseData.message || responseData.error || `HTTP ${res.status}`;
        this.logger.error(`Messenger API HTTP error ${res.status}: ${JSON.stringify(responseData)}`);
        return {
          metaMessageId: `wamid.failed.${Date.now()}`,
          status: 'failed',
          error: errorMsg,
          rawResponse: responseData,
        };
      }

      // Extract message ID from standard Meta response format: { messages: [{ id: "wamid..." }] }
      const messageId =
        responseData?.messages?.[0]?.id ||
        responseData?.data?.id ||
        `wamid.${randomUUID().replace(/-/g, '')}`;

      return {
        metaMessageId: messageId,
        status: 'sent',
        rawResponse: responseData,
      };
    } catch (error: any) {
      this.logger.error(`Messenger API call failed: ${error.message}`);
      return {
        metaMessageId: `wamid.err.${Date.now()}`,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Get Templates from Messenger API
   * GET /get_templates
   */
  async getTemplates(limit: number = 1000): Promise<any> {
    const url = `${this.baseUrl}/get_templates?limit=${limit}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch templates (${res.status})`);
      }
      return await res.json();
    } catch (err: any) {
      this.logger.error(`getTemplates error: ${err.message}`);
      return { data: [] };
    }
  }

  /**
   * Get Conversations from Messenger API
   * GET /conversations
   */
  async getConversations(phoneNumber?: string): Promise<any> {
    const path = this.conversationsPath.startsWith('/') ? this.conversationsPath : `/${this.conversationsPath}`;
    let url = `${this.baseUrl}${path}`;
    if (phoneNumber) {
      url += `?phone_number=${encodeURIComponent(phoneNumber)}`;
    }
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch conversations (${res.status})`);
      }
      return await res.json();
    } catch (err: any) {
      this.logger.error(`getConversations error: ${err.message}`);
      return { data: [] };
    }
  }

  /**
   * Create Media Handle
   * POST /media_handle
   */
  async createMediaHandle(formData: FormData): Promise<any> {
    const url = `${this.baseUrl}/media_handle`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(null),
        body: formData as any,
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`createMediaHandle error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get Media
   * GET /media
   */
  async getMedia(mediaId: string): Promise<any> {
    const url = `${this.baseUrl}/media?mediaId=${encodeURIComponent(mediaId)}&download=true`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`getMedia error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Webhook Registration: POST /webhook
   */
  async registerWebhook(webhookUrl: string): Promise<any> {
    const url = `${this.baseUrl}/webhook`;
    const formData = new URLSearchParams();
    formData.append('url', webhookUrl);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders('application/x-www-form-urlencoded'),
        },
        body: formData.toString(),
      });
      const data = await res.json().catch(() => ({}));
      this.logger.log(`Webhook registered with Messenger API: ${webhookUrl}`);
      return { success: res.ok, data };
    } catch (err: any) {
      this.logger.error(`Webhook registration error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get Webhook Info: GET /webhook
   */
  async getWebhookInfo(): Promise<any> {
    const url = `${this.baseUrl}/webhook`;
    try {
      const res = await fetch(url, {
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
   * Delete Webhook: DELETE /webhook
   */
  async deleteWebhook(): Promise<any> {
    const url = `${this.baseUrl}/webhook`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`Delete webhook error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // USERS
  // =========================================================================

  /**
   * List Users
   * GET /users
   */
  async listUsers(): Promise<any> {
    const url = `${this.baseUrl}/users`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`listUsers HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`listUsers error: ${err.message}`);
      return { data: [] };
    }
  }

  /**
   * Create a Waba User
   * POST /users (multipart/form-data)
   */
  async createUser(payload: {
    user_type?: string;
    name: string;
    email: string;
    currencies?: string;
    webhook_forwarding_url?: string;
    phone: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/users`;
    const form = new FormData();
    form.append('user_type', payload.user_type || 'waba_user');
    form.append('name', payload.name);
    form.append('email', payload.email);
    if (payload.currencies) form.append('currencies', payload.currencies);
    if (payload.webhook_forwarding_url) {
      form.append('webhook_forwarding_url', payload.webhook_forwarding_url);
    }
    form.append('phone', payload.phone);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(null), // let fetch set multipart boundary
        body: form as any,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`createUser HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`createUser error: ${err.message}`);
      throw err;
    }
  }

  // =========================================================================
  // PROFILE MANAGEMENT
  // =========================================================================

  /**
   * Get Business Profile Details
   * GET /get-profile?fields=about,address,description,email,profile_picture_url,websites,vertical
   */
  async getProfile(
    fields: string = 'about,address,description,email,profile_picture_url,websites,vertical',
  ): Promise<any> {
    const url = `${this.baseUrl}/get-profile?fields=${encodeURIComponent(fields)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`getProfile HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`getProfile error: ${err.message}`);
      return { data: null, error: err.message };
    }
  }

  /**
   * Get account/user details
   * GET /user
   */
  async getAccountUser(): Promise<any> {
    const url = `${this.baseUrl}/user`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      return await res.json().catch(() => ({}));
    } catch (err: any) {
      this.logger.error(`getAccountUser error: ${err.message}`);
      return { data: null, error: err.message };
    }
  }

  /**
   * Update Business Profile Details
   * POST /update-profile
   */
  async updateProfile(payload: {
    whatsAppAbout?: string;
    address?: string;
    description?: string;
    vertical?: string;
    email?: string;
    websites?: string[];
    profile_picture_handle?: string;
  }): Promise<any> {
    const url = `${this.baseUrl}/update-profile`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`updateProfile HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`updateProfile error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get Single Phone Number Details
   * GET /get-phone-number-details?fields=...
   */
  async getPhoneNumberDetails(
    fields: string = 'status,is_official_business_account,id,name_status,code_verification_status,display_phone_number,platform_type,messaging_limit_tier,throughput',
  ): Promise<any> {
    const url = `${this.baseUrl}/get-phone-number-details?fields=${encodeURIComponent(fields)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`getPhoneNumberDetails HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`getPhoneNumberDetails error: ${err.message}`);
      return { data: null, error: err.message };
    }
  }

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  /**
   * Get Template by Name (Single)
   * GET /get_template?template_name=xxx
   */
  async getTemplateByName(templateName: string): Promise<any> {
    const url = `${this.baseUrl}/get_template?template_name=${encodeURIComponent(templateName)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`getTemplateByName HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`getTemplateByName error: ${err.message}`);
      return { data: null, error: err.message };
    }
  }

  // =========================================================================
  // READ RECEIPTS
  // =========================================================================

  /**
   * Mark Message as Read
   * POST /read_receipts
   */
  async markAsRead(messageId: string): Promise<any> {
    const url = `${this.baseUrl}/read_receipts`;
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`markAsRead HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`markAsRead error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // INTERACTIVE MESSAGES (non-template, session messages via POST /send)
  // =========================================================================

  /**
   * Send Message with Reply (Quick Reply) Buttons
   */
  async sendReplyButtons(
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    header?: string,
    footer?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const interactive: any = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    const payload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveWithButton',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send Message with CTA (Call To Action) URL Button
   */
  async sendCtaUrlButton(
    to: string,
    displayText: string,
    url: string,
    bodyText: string,
    header?: string,
    footer?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const interactive: any = {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        name: 'cta_url',
        parameters: { display_text: displayText, url },
      },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    const payload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveWithButton',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send Message with a List (sections of selectable rows)
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
    header?: string,
    footer?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const interactive: any = {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send an Address request Message
   */
  async sendAddressMessage(
    to: string,
    bodyText: string,
    country: string,
    name?: string,
    phoneNumber?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const payload: any = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveGetAddress',
      interactive: {
        type: 'address_message',
        body: { text: bodyText },
        action: {
          name: 'address_message',
          parameters: {
            country,
            values: {
              ...(name ? { name } : {}),
              ...(phoneNumber ? { phone_number: phoneNumber } : {}),
            },
          },
        },
      },
    };
    return this.executeSend(payload);
  }

  /**
   * Send a standalone Location message (session message, not a template)
   */
  async sendLocationMessage(
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const payload: any = {
      to: cleanTo,
      type: 'location',
      location: {
        longitude,
        latitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      },
    };
    return this.executeSend(payload);
  }

  /**
   * Send a WhatsApp Flow (interactive)
   */
  async sendFlowMessage(
    to: string,
    params: {
      headerText?: string;
      bodyText: string;
      footerText?: string;
      flowToken: string;
      flowId: string;
      flowCta: string;
      flowAction?: 'navigate' | 'data_exchange';
      flowActionPayload?: any;
    },
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const interactive: any = {
      type: 'flow',
      body: { text: params.bodyText },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: params.flowToken,
          flow_id: params.flowId,
          flow_cta: params.flowCta,
          flow_action: params.flowAction || 'navigate',
          ...(params.flowActionPayload
            ? { flow_action_payload: params.flowActionPayload }
            : {}),
        },
      },
    };
    if (params.headerText) interactive.header = { type: 'text', text: params.headerText };
    if (params.footerText) interactive.footer = { text: params.footerText };

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveFlow',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send Audio Message
   */
  async sendAudio(to: string, audioLinkOrId: string): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const payload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'audio',
      audio: { id: audioLinkOrId },
    };
    return this.executeSend(payload);
  }

  /**
   * Reply to a specific message (session reply with context)
   */
  async sendReply(
    to: string,
    contextMessageId: string,
    text: string,
    previewUrl: boolean = false,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const payload = {
      messaging_product: 'whatsapp',
      context: { message_id: contextMessageId },
      to: cleanTo,
      type: 'text',
      text: { preview_url: previewUrl, body: text },
    };
    return this.executeSend(payload);
  }

  // =========================================================================
  // TEMPLATE CONVENIENCE WRAPPERS (advanced template types via POST /send)
  // =========================================================================

  /**
   * Send a Carousel Template (product/offer cards)
   */
  async sendCarouselTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    bodyParams: string[],
    cards: { imageLink: string; bodyParams: string[] }[],
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const components: any[] = [];
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((t) => ({ type: 'text', text: t })),
      });
    }
    components.push({
      type: 'carousel',
      cards: cards.map((card, index) => ({
        card_index: index,
        components: [
          {
            type: 'HEADER',
            parameters: [{ type: 'IMAGE', image: { link: card.imageLink } }],
          },
          {
            type: 'BODY',
            parameters: card.bodyParams.map((t) => ({ type: 'text', text: t })),
          },
        ],
      })),
    });

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    };
    return this.executeSend(payload);
  }

  /**
   * Send a Coupon Code Template (COPY_CODE button)
   */
  async sendCouponTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    bodyParams: string[],
    couponCode: string,
    buttonIndex: number = 0,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const components: any[] = [];
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((t) => ({ type: 'text', text: t })),
      });
    }
    components.push({
      type: 'button',
      sub_type: 'COPY_CODE',
      index: buttonIndex,
      parameters: [{ type: 'coupon_code', coupon_code: couponCode }],
    });

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    };
    return this.executeSend(payload);
  }

  /**
   * Send a Template that opens a Flow via its button (sub_type "flow")
   */
  async sendFlowsTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    bodyParams: string[],
    flowToken: string = 'unused',
    buttonIndex: string = '0',
  ): Promise<MessengerSendResult> {
    const cleanTo = this.normalizePhone(to);
    const components: any[] = [];
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((t) => ({ type: 'text', text: t })),
      });
    }
    components.push({
      type: 'button',
      sub_type: 'flow',
      index: buttonIndex,
      parameters: [{ type: 'action', action: { flow_token: flowToken } }],
    });

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    };
    return this.executeSend(payload);
  }

  /**
   * Shared phone number normalizer used across the interactive/session senders.
   */
  private normalizePhone(to: string): string {
    let cleanTo = (to || '').replace(/[^\d]/g, '');
    if (cleanTo.startsWith('0') && cleanTo.length === 11) {
      cleanTo = cleanTo.substring(1);
    }
    if (cleanTo.length === 10) {
      cleanTo = `91${cleanTo}`;
    }
    return cleanTo;
  }
}
