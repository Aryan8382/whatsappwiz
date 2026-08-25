import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { transformValue } from '../common/interceptors/transform.interceptor';

@Injectable()
export class WebhookDispatchService {
  constructor(private prisma: PrismaService) {}

  async dispatch(organizationId: number, event: string, payload: unknown) {
    try {
      const webhooks = await this.prisma.webhook.findMany({
        where: { organizationId: BigInt(organizationId), active: true },
      });
      for (const webhook of webhooks) {
        const events: string[] =
          (webhook.events as string[]) || [];
        if (!events.includes(event)) continue;

        const body = {
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        };

        const log = await this.prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: body as any,
            status: 'sent',
          },
        });

        fetch(webhook.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whatsapp-Wiz-Event': event,
            'X-Whatsapp-Wiz-Signature': webhook.secret || '',
          },
          body: JSON.stringify(transformValue(body)),
          signal: AbortSignal.timeout(8000),
        })
          .then((res) =>
            this.prisma.webhookLog.update({
              where: { id: log.id },
              data: { responseCode: res.status, status: 'delivered' },
            }),
          )
          .catch(() =>
            this.prisma.webhookLog.update({
              where: { id: log.id },
              data: { responseCode: 0, status: 'failed' },
            }),
          );
      }
    } catch {
      // never break the main flow on webhook failures
    }
  }
}
