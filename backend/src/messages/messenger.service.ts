import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface MessengerSendResult {
  metaMessageId: string;
  status: 'sent' | 'failed' | 'accepted';
  rawResponse?: any;
  error?: string;
}

export type BotButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface BotButton {
  id?: string;
  type: BotButtonType;
  text: string;
  value?: string; // URL or phone number; unused for QUICK_REPLY
}

/**
 * A media header (image/video/document) that can be attached directly to
 * a WhatsApp interactive message (buttons or CTA URL), so the media,
 * body text, and buttons all arrive as ONE message/bubble instead of a
 * media message followed by a separate button message.
 */
export interface BotHeaderMedia {
  type: 'image' | 'video' | 'document';
  url: string;
  filename?: string; // only used for document headers
}

@Injectable()
export class MessengerService implements OnModuleInit {
  private readonly logger = new Logger(MessengerService.name);

  private fetchedWabaId: string | null = null;

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

    // Auto-discover real WABA ID if environment variable is set to placeholder
    if (!this.fetchedWabaId) {
      try {
        const usersRes = await this.listUsers('waba_users');
        const wabaUsers = usersRes?.data?.[0] || usersRes?.data || [];
        const firstWaba = Array.isArray(wabaUsers) ? wabaUsers[0] : wabaUsers;
        if (firstWaba?.whatsapp_business_account_id) {
          this.fetchedWabaId = String(firstWaba.whatsapp_business_account_id);
          this.logger.log(
            `✅ Auto-discovered WABA ID from Messenger API: ${this.fetchedWabaId}`,
          );
        } else {
          this.logger.warn(
            `MESSENGER_WABA_ID is set to placeholder. x-waba-id header will not be sent.`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`Could not auto-discover WABA ID: ${err.message}`);
      }
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
          `❌ Messenger API Token Validation FAILED (${res.status}): ${data.message || data.error || JSON.stringify(data)}. Please check MESSENGER_API_KEY in backend/.env`,
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
    const envWaba = this.config.get<string>('MESSENGER_WABA_ID') || '';
    if (envWaba && envWaba !== 'YOUR_WABA_ID') {
      return envWaba;
    }
    return this.fetchedWabaId || '';
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

  private sanitizePhoneNumber(to: string): string {
    let clean = (to || '').replace(/[^\d]/g, '');
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.substring(1);
    }
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return clean;
  }

  /**
   * Builds the `interactive.header` object for a media header (image,
   * video, or document) so it can be attached to an interactive
   * button/CTA message alongside body text and buttons.
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
   * Status & Connectivity check
   */
  async getStatus(): Promise<{ tokenValid: boolean; wabaId?: string; baseUrl: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/get_templates?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return { tokenValid: res.ok, wabaId: this.wabaId, baseUrl: this.baseUrl };
    } catch (err: any) {
      return { tokenValid: false, wabaId: this.wabaId, baseUrl: this.baseUrl };
    }
  }

  // ==========================================
  // 1. USER APIS (/api/users)
  // ==========================================

  /**
   * List users / businesses / WABA users
   * GET /users?user_type=business | waba_users
   */
  async listUsers(userType?: 'business' | 'waba_users' | string): Promise<any> {
    let url = `${this.baseUrl}/users`;
    if (userType) {
      url += `?user_type=${encodeURIComponent(userType)}`;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  /**
   * Create Business User
   * POST /users (form-data: user_type: business, name, email, company_name, phone, webhook_forwarding_url)
   */
  async createBusinessUser(data: {
    name: string;
    email: string;
    company_name: string;
    phone?: string;
    webhook_forwarding_url?: string;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('user_type', 'business');
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('company_name', data.company_name);
    if (data.phone) formData.append('phone', data.phone);
    if (data.webhook_forwarding_url) formData.append('webhook_forwarding_url', data.webhook_forwarding_url);

    const res = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: this.getHeaders(null),
      body: formData as any,
    });
    return res.json();
  }

  /**
   * Create WABA User
   * POST /users (form-data: user_type: waba_user, name, email, currencies, phone, webhook_forwarding_url)
   */
  async createWabaUser(data: {
    name: string;
    email: string;
    currencies?: string;
    phone: string;
    webhook_forwarding_url?: string;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('user_type', 'waba_user');
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('currencies', data.currencies || 'INR');
    formData.append('phone', this.sanitizePhoneNumber(data.phone));
    if (data.webhook_forwarding_url) formData.append('webhook_forwarding_url', data.webhook_forwarding_url);

    const res = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: this.getHeaders(null),
      body: formData as any,
    });
    return res.json();
  }

  // ==========================================
  // 2. CONVERSATIONS APIS (/api/conversations)
  // ==========================================

  /**
   * Fetch conversation history
   * GET /conversations?phone_number=...&page=...
   */
  async getConversations(phoneNumber?: string, page?: number): Promise<any> {
    const path = this.conversationsPath.startsWith('/') ? this.conversationsPath : `/${this.conversationsPath}`;
    const params = new URLSearchParams();
    if (phoneNumber) {
      params.append('phone_number', this.sanitizePhoneNumber(phoneNumber));
    }
    if (page) {
      params.append('page', String(page));
    }
    const query = params.toString();
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;

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
      return { data: { messsages: [] } };
    }
  }

  // ==========================================
  // 3. TEMPLATES APIS (/api/get_templates)
  // ==========================================

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
   * Submit New Template for Meta Approval
   * POST /create_template
   */
  async createTemplate(data: {
    name: string;
    category: string;
    language: string;
    header?: string | null;
    body: string;
    footer?: string | null;
    buttons?: any[];
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const cleanName = data.name.toLowerCase().replace(/[^\w]/g, '_');
    const components: any[] = [];

    if (data.header && data.header.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: data.header.trim(),
      });
    }

    components.push({
      type: 'BODY',
      text: data.body.trim(),
    });

    if (data.footer && data.footer.trim()) {
      components.push({
        type: 'FOOTER',
        text: data.footer.trim(),
      });
    }

    if (data.buttons && data.buttons.length > 0) {
      const formattedBtns = data.buttons.map((b) => {
        if (b.type === 'URL') {
          return { type: 'URL', text: b.text, url: b.value };
        } else if (b.type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.value };
        } else {
          return { type: 'QUICK_REPLY', text: b.text };
        }
      });
      components.push({
        type: 'BUTTONS',
        buttons: formattedBtns,
      });
    }

    const payload = {
      name: cleanName,
      category: (data.category || 'MARKETING').toUpperCase(),
      language: data.language || 'en',
      components,
    };

    const url = `${this.baseUrl}/create_template`;
    this.logger.log(
      `Submitting template to Meta API: POST ${url} with payload: ${JSON.stringify(payload)}`,
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (
        !res.ok ||
        responseData?.status === false ||
        responseData?.success === false ||
        responseData?.error
      ) {
        let errorMsg =
          responseData?.message ||
          responseData?.error_message ||
          responseData?.error_user_msg;
        if (!errorMsg && typeof responseData?.error === 'string') {
          errorMsg = responseData.error;
        } else if (
          !errorMsg &&
          typeof responseData?.error === 'object' &&
          responseData?.error?.message
        ) {
          errorMsg = responseData.error.message;
        }
        if (!errorMsg) {
          errorMsg = `Meta API error (HTTP ${res.status}): ${JSON.stringify(responseData)}`;
        }

        this.logger.error(
          `❌ Meta Template Creation FAILED (${res.status}): ${errorMsg} | Response: ${JSON.stringify(responseData)}`,
        );
        return { success: false, error: String(errorMsg), data: responseData };
      }

      this.logger.log(
        `✅ Meta Template Creation SUCCESS: ${JSON.stringify(responseData)}`,
      );
      return { success: true, data: responseData };
    } catch (err: any) {
      this.logger.error(`Meta Template Creation exception: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // 4. SEND APIS (/api/send)
  // ==========================================

  /**
   * Generic Send Execution
   */
  private async executeSend(payload: any): Promise<MessengerSendResult> {
    const url = `${this.baseUrl}/send`;
    this.logger.log(
      `Calling Messenger API: POST ${url} for recipient ${payload.to} with payload: ${JSON.stringify(payload)}`,
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

      const responseData = await res.json().catch(() => ({}));

      // Detect HTTP errors OR API response-level failure objects
      const hasHttpError = !res.ok;
      const hasApiError =
        responseData?.status === false ||
        responseData?.status === 'false' ||
        responseData?.status === 'failed' ||
        responseData?.status === 'error' ||
        responseData?.success === false ||
        responseData?.success === 'false' ||
        Boolean(responseData?.error) ||
        Boolean(responseData?.errors);

      if (hasHttpError || hasApiError) {
        let errorMsg =
          responseData?.message ||
          responseData?.error_message ||
          responseData?.error_user_msg ||
          responseData?.reason;

        if (!errorMsg && typeof responseData?.error === 'string') {
          errorMsg = responseData.error;
        } else if (
          !errorMsg &&
          typeof responseData?.error === 'object' &&
          responseData?.error?.message
        ) {
          errorMsg = responseData.error.message;
        } else if (
          !errorMsg &&
          Array.isArray(responseData?.errors) &&
          responseData.errors[0]
        ) {
          const err0 = responseData.errors[0];
          errorMsg =
            typeof err0 === 'string'
              ? err0
              : err0.message || JSON.stringify(err0);
        }
        if (!errorMsg) {
          errorMsg = `API error (HTTP ${res.status}): ${JSON.stringify(responseData)}`;
        }

        this.logger.error(
          `❌ Messenger API Send FAILED (${res.status}): ${errorMsg} | Raw Payload: ${JSON.stringify(payload)} | Raw Response: ${JSON.stringify(responseData)}`,
        );
        return {
          metaMessageId: `wamid.failed.${Date.now()}`,
          status: 'failed',
          error: errorMsg,
          rawResponse: responseData,
        };
      }

      const messageId =
        responseData?.messages?.[0]?.id ||
        responseData?.data?.id ||
        responseData?.id ||
        `wamid.${randomUUID().replace(/-/g, '')}`;

      this.logger.log(
        `✅ Messenger API Send SUCCESS: ${messageId} | Response: ${JSON.stringify(responseData)}`,
      );

      return {
        metaMessageId: messageId,
        status: 'sent',
        rawResponse: responseData,
      };
    } catch (error: any) {
      this.logger.error(`Messenger API call exception: ${error.message}`);
      return {
        metaMessageId: `wamid.err.${Date.now()}`,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send Text Message
   */
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
   * Send Image Message
   */
  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
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
   * Send Video Message
   */
  async sendVideo(
    to: string,
    videoUrl: string,
    caption?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
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
   * Send Document Message
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'document',
      document: {
        link: documentUrl,
      },
    };
    if (filename && filename.trim())
      payload.document.filename = filename.trim();
    if (caption && caption.trim()) payload.document.caption = caption.trim();

    return this.executeSend(payload);
  }

  /**
   * Send Audio Message
   */
  async sendAudio(to: string, audioUrl: string): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'audio',
      audio: {
        link: audioUrl,
      },
    };
    return this.executeSend(payload);
  }

  /**
   * Send Location Message
   */
  async sendLocation(
    to: string,
    location: {
      longitude: number;
      latitude: number;
      name?: string;
      address?: string;
    },
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'location',
      location: {
        longitude: location.longitude,
        latitude: location.latitude,
        name: location.name || 'Location',
        address: location.address || '',
      },
    };
    return this.executeSend(payload);
  }

  /**
   * Send Template Message
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components: any[] = [],
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const cleanName = (templateName || '').trim();
    const lang = (languageCode || 'en').trim();

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: cleanName,
        language: {
          code: lang,
        },
      },
    };
    if (components && components.length > 0) {
      payload.template.components = components;
    }
    return this.executeSend(payload);
  }

  /**
   * Send Interactive Message with Reply Buttons
   */
  async sendInteractiveButtons(
    to: string,
    text: string,
    buttons: Array<{ id: string; title: string }>,
    opts?: { headerText?: string; headerMedia?: BotHeaderMedia; footerText?: string },
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const interactive: any = {
      type: 'button',
      body: {
        text,
      },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: {
            id: b.id,
            title: b.title,
          },
        })),
      },
    };
    if (opts?.headerMedia) {
      interactive.header = this.buildMediaHeader(opts.headerMedia);
    } else if (opts?.headerText) {
      interactive.header = { type: 'text', text: opts.headerText };
    }
    if (opts?.footerText) {
      interactive.footer = { text: opts.footerText };
    }

    const payload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveWithButton',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send Interactive Message with CTA URL Button
   */
  async sendInteractiveCtaUrl(
    to: string,
    bodyText: string,
    displayText: string,
    url: string,
    headerText?: string,
    footerText?: string,
    headerMedia?: BotHeaderMedia,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const interactive: any = {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: displayText,
          url,
        },
      },
    };
    if (headerMedia) {
      interactive.header = this.buildMediaHeader(headerMedia);
    } else if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) interactive.footer = { text: footerText };

    const payload = {
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveWithButton',
      interactive,
    };
    return this.executeSend(payload);
  }

  /**
   * Send Interactive Message with List
   */
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
    const cleanTo = this.sanitizePhoneNumber(to);
    const interactive: any = {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections,
      },
    };
    if (headerText) interactive.header = { type: 'text', text: headerText };
    if (footerText) interactive.footer = { text: footerText };

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
   * Send Address Request Message (India & Singapore)
   */
  async sendInteractiveAddress(
    to: string,
    bodyText: string,
    country: 'IN' | 'SG',
    customerName: string,
    phoneNumber: string,
  ): Promise<MessengerSendResult> {
    const cleanTo = this.sanitizePhoneNumber(to);
    const payload = {
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
              name: customerName,
              phone_number: this.sanitizePhoneNumber(phoneNumber),
            },
          },
        },
      },
    };
    return this.executeSend(payload);
  }

  /**
   * Send Interactive Flow Message
   */
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
    const cleanTo = this.sanitizePhoneNumber(to);
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
          flow_action_payload: {
            screen: flowData.screen || 'welcome',
          },
        },
      },
    };
    if (flowData.header) interactive.header = { type: 'text', text: flowData.header };
    if (flowData.footer) interactive.footer = { text: flowData.footer };

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactiveFlow',
      interactive,
    };
    return this.executeSend(payload);
  }

  // ==========================================
  // 4b. BOT-CONFIGURED BUTTONS ROUTING
  // ==========================================

  /**
   * Send a message with bot-configured buttons (Quick Reply / Website /
   * Call), routing to the correct underlying WhatsApp message type.
   *
   * WhatsApp session-message rules this enforces:
   *  - QUICK_REPLY only, up to 3        -> sendInteractiveButtons
   *  - Exactly one URL button, no others -> sendInteractiveCtaUrl
   *  - Any PHONE_NUMBER button, or mixed
   *    button types, or >1 URL button    -> cannot be sent as a session
   *    message at all; caller must use an approved template instead
   *    (see createTemplate + sendTemplate). This method will not attempt
   *    that automatically since it requires a pre-approved template name.
   *
   * If `opts.headerMedia` is provided (image/video/document), it's
   * attached directly to the interactive message header so the media,
   * body text, and buttons all arrive as ONE WhatsApp message/bubble.
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

    const hasPhone = cleaned.some((b) => b.type === 'PHONE_NUMBER');
    const urlButtons = cleaned.filter((b) => b.type === 'URL');
    const quickReplyButtons = cleaned.filter((b) => b.type === 'QUICK_REPLY');
    const typeCount = [hasPhone, urlButtons.length > 0, quickReplyButtons.length > 0].filter(Boolean).length;

    // Phone-call buttons, mixed button types, or multiple URL buttons
    // are not supported on a plain session message — an approved
    // template is required.
    if (hasPhone || typeCount > 1 || urlButtons.length > 1) {
      this.logger.warn(
        `sendButtonsMessage: button combination requires an approved WhatsApp template (phone button, mixed types, or multiple URLs). Skipping direct send for ${to}.`,
      );
      return {
        metaMessageId: `wamid.skipped.${Date.now()}`,
        status: 'failed',
        error:
          'This button combination requires an approved WhatsApp message template (e.g. a call button, or mixing button types). Use createTemplate/sendTemplate instead.',
        requiresTemplate: true,
      };
    }

    if (urlButtons.length === 1) {
      const btn = urlButtons[0];
      return this.sendInteractiveCtaUrl(
        to,
        bodyText,
        btn.text,
        btn.value,
        opts?.headerText,
        opts?.footerText,
        opts?.headerMedia,
      );
    }

    // Quick-reply only
    return this.sendInteractiveButtons(
      to,
      bodyText,
      quickReplyButtons.map((b) => ({ id: b.id, title: b.text })),
      { headerText: opts?.headerText, headerMedia: opts?.headerMedia, footerText: opts?.footerText },
    );
  }

  // ==========================================
  // 5. MEDIA APIS (/api/upload & /api/media)
  // ==========================================

  /**
   * Upload Media
   * POST /upload
   */
  async uploadMedia(formData: FormData): Promise<any> {
    const url = `${this.baseUrl}/upload`;
    try {
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
   * Get Media
   * GET /media?mediaId=...&download=true
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

  // ==========================================
  // 6. WEBHOOK APIS (/api/webhook)
  // ==========================================

  /**
   * Get Webhook Info
   * GET /webhook
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
   * Register / Update Webhook
   * POST /webhook
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
   * Delete Webhook
   * DELETE /webhook
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
}