import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { transformValue } from '../common/interceptors/transform.interceptor';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.server = server;
    server.on('connection', (socket) => {
      socket.on('join', (data: any) => {
        const orgId = data?.organizationId;
        if (orgId) {
          socket.join(`org:${orgId}`);
        }
      });
      socket.on('leave', (data: any) => {
        const orgId = data?.organizationId;
        if (orgId) {
          socket.leave(`org:${orgId}`);
        }
      });
    });
  }

  emitToOrg(organizationId: number, event: string, data: unknown) {
    if (!this.server) return;
    try {
      this.server.to(`org:${organizationId}`).emit(event, transformValue(data));
    } catch {
      // ignore emit errors
    }
  }
}
