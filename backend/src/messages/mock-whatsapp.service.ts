import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class MockWhatsappService {
  /**
   * Simulates the Meta WhatsApp Cloud API send call.
   * Returns a Meta-style message id.
   */
  async send(payload: {
    phoneNumberId: string;
    to: string;
    type: string;
    text?: string;
    templateName?: string;
    language?: string;
    parameters?: string[];
  }): Promise<{ metaMessageId: string; status: string }> {
    const metaMessageId = `wamid.${randomUUID().replace(/-/g, '')}`;
    // simulate ~2% random failure to demonstrate retry + failure tracking
    if (Math.random() < 0.02) {
      return { metaMessageId, status: 'failed' };
    }
    return { metaMessageId, status: 'sent' };
  }

  async uploadMedia(): Promise<string> {
    return `https://demo.whatsappwiz.com/media/${randomUUID()}`;
  }
}
