import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { transformValue } from '../common/interceptors/transform.interceptor';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('✅ RealtimeGateway initialized and listening for socket connections');
  }

  handleConnection(client: Socket) {
    const rawOrgId =
      client.handshake.auth?.organizationId ||
      client.handshake.query?.organizationId ||
      1;
    const orgId = String(rawOrgId);

    // Auto-join org room and global room
    client.join(`org:${orgId}`);
    client.join('global');

    this.logger.log(
      `🔌 Realtime Client connected: ${client.id} (auto-joined org:${orgId})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Realtime Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const orgId = data?.organizationId || 1;
    client.join(`org:${orgId}`);
    this.logger.log(`Socket ${client.id} joined org:${orgId}`);
    return { event: 'joined', organizationId: orgId };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const orgId = data?.organizationId;
    if (orgId) {
      client.leave(`org:${orgId}`);
      this.logger.log(`Socket ${client.id} left org:${orgId}`);
    }
  }

  emitToOrg(organizationId: number | string | bigint, event: string, data: unknown) {
    if (!this.server) {
      this.logger.warn(`emitToOrg: server is null, cannot emit "${event}"`);
      return;
    }
    const orgStr = String(organizationId || 1);
    const payload = transformValue(data);

    try {
      this.server.to(`org:${orgStr}`).emit(event, payload);
      // Fallback broadcast to all connected clients to ensure real-time updates always land
      this.server.emit(event, payload);
      this.logger.log(`📡 Emitted "${event}" to org:${orgStr}`);
    } catch (err: any) {
      this.logger.error(`emitToOrg error for "${event}": ${err.message}`);
    }
  }
}
