import { Controller, Get, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';

/**
 * Public endpoint for quick testing of sending a WhatsApp message.
 * No JWT guard is applied, so it can be called from any client (e.g., a phone).
 * URL format:
 *   GET /api/v1/public/test/:phone/:text
 * Example:
 *   http://<host>:4000/api/v1/public/test/9574776909/Hello%20from%20phone
 */
@Controller('public')
export class PublicTestController {
  constructor(private readonly messages: MessagesService) {}

  @Get('test/:phone/:text')
  async testMessageViaGet(@Param('phone') phone: string, @Param('text') text: string) {
    // Decode URL‑encoded text, then forward to the Messenger service.
    return this.messages.sendTestMessage(phone, decodeURIComponent(text));
  }
}
