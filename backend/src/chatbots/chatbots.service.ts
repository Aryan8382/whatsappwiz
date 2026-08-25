import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const NODE_TYPES = [
  'start',
  'message',
  'question',
  'button',
  'condition',
  'delay',
  'api',
  'handover',
  'end',
];

@Injectable()
export class ChatbotsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async list(organizationId: number) {
    return this.prisma.botFlow.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: { _count: { select: { nodes: true, connections: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(organizationId: number, userId: number, name: string) {
    const flow = await this.prisma.botFlow.create({
      data: {
        organizationId: BigInt(organizationId),
        name,
        createdById: BigInt(userId),
      },
    });
    await this.prisma.botNode.create({
      data: {
        flowId: flow.id,
        nodeType: 'start',
        name: 'Start',
        config: {},
        positionX: 200,
        positionY: 80,
      },
    });
    return this.get(organizationId, Number(flow.id));
  }

  async get(organizationId: number, id: number) {
    const flow = await this.prisma.botFlow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      include: {
        nodes: { orderBy: { id: 'asc' } },
        connections: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }

  async addNode(
    organizationId: number,
    flowId: number,
    nodeType: string,
    config: any,
    positionX?: number,
    positionY?: number,
  ) {
    if (!NODE_TYPES.includes(nodeType)) {
      throw new BadRequestException(`Invalid node type: ${nodeType}`);
    }
    await this.findFlow(organizationId, flowId);
    return this.prisma.botNode.create({
      data: {
        flowId: BigInt(flowId),
        nodeType,
        name: config?.name || nodeType,
        config: config || {},
        positionX: positionX || 100,
        positionY: positionY || 100,
      },
    });
  }

  async updateNode(
    organizationId: number,
    flowId: number,
    nodeId: number,
    data: { name?: string; config?: any; positionX?: number; positionY?: number },
  ) {
    const node = await this.findNode(organizationId, flowId, nodeId);
    return this.prisma.botNode.update({
      where: { id: node.id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        config: data.config !== undefined ? (data.config as any) : undefined,
        positionX: data.positionX !== undefined ? data.positionX : undefined,
        positionY: data.positionY !== undefined ? data.positionY : undefined,
      },
    });
  }

  async deleteNode(organizationId: number, flowId: number, nodeId: number) {
    const node = await this.findNode(organizationId, flowId, nodeId);
    await this.prisma.botConnection.deleteMany({
      where: { OR: [{ sourceNode: node.id }, { targetNode: node.id }] },
    });
    await this.prisma.botNode.delete({ where: { id: node.id } });
    return { success: true };
  }

  async connect(
    organizationId: number,
    flowId: number,
    sourceNode: number,
    targetNode: number,
  ) {
    await this.findFlow(organizationId, flowId);
    await this.findNode(organizationId, flowId, sourceNode);
    await this.findNode(organizationId, flowId, targetNode);
    return this.prisma.botConnection.create({
      data: {
        flowId: BigInt(flowId),
        sourceNode: BigInt(sourceNode),
        targetNode: BigInt(targetNode),
      },
    });
  }

  async disconnect(
    organizationId: number,
    flowId: number,
    sourceNode: number,
    targetNode: number,
  ) {
    await this.findFlow(organizationId, flowId);
    await this.prisma.botConnection.deleteMany({
      where: { sourceNode: BigInt(sourceNode), targetNode: BigInt(targetNode) },
    });
    return { success: true };
  }

  async publish(organizationId: number, flowId: number) {
    await this.findFlow(organizationId, flowId);
    const updated = await this.prisma.botFlow.update({
      where: { id: BigInt(flowId) },
      data: { published: true },
    });
    this.realtime.emitToOrg(organizationId, 'bot:published', updated);
    return updated;
  }

  async unpublish(organizationId: number, flowId: number) {
    await this.findFlow(organizationId, flowId);
    return this.prisma.botFlow.update({
      where: { id: BigInt(flowId) },
      data: { published: false },
    });
  }

  async updateConfig(organizationId: number, flowId: number, config: any) {
    await this.findFlow(organizationId, flowId);
    return this.prisma.botFlow.update({
      where: { id: BigInt(flowId) },
      data: { config: config ?? {} },
    });
  }

  async update(
    organizationId: number,
    flowId: number,
    data: { name?: string; config?: any },
  ) {
    await this.findFlow(organizationId, flowId);
    return this.prisma.botFlow.update({
      where: { id: BigInt(flowId) },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        config: data.config !== undefined ? (data.config ?? {}) : undefined,
      },
    });
  }


  async remove(organizationId: number, flowId: number) {
    await this.findFlow(organizationId, flowId);
    await this.prisma.botFlow.delete({ where: { id: BigInt(flowId) } });
    return { success: true };
  }

  async preview(organizationId: number, flowId: number) {
    const flow = await this.get(organizationId, flowId);
    const nodes = flow.nodes;
    const adjacency = new Map<number, number[]>();
    for (const conn of flow.connections) {
      const from = Number(conn.sourceNode);
      const list = adjacency.get(from) || [];
      list.push(Number(conn.targetNode));
      adjacency.set(from, list);
    }
    const preview: { nodeType: string; text: string }[] = [];
    let node = nodes.find((n) => n.nodeType === 'start');
    let guard = 0;
    while (node && guard < 30) {
      guard++;
      const config: any = node.config || {};
      if (['message', 'question', 'button', 'api'].includes(node.nodeType)) {
        const buttons = config.buttons?.map((b: any) => b.text).join(', ');
        preview.push({
          nodeType: node.nodeType,
          text: [config.text, buttons ? `[${buttons}]` : null].filter(Boolean).join(' '),
        });
      } else if (node.nodeType === 'handover') {
        preview.push({ nodeType: 'handover', text: '→ Handed over to an agent' });
      } else if (node.nodeType === 'end') {
        preview.push({ nodeType: 'end', text: config.text || '→ Flow ends' });
      }
      if (node.nodeType === 'handover' || node.nodeType === 'end') break;
      if (node.nodeType === 'question' || node.nodeType === 'button') break;
      const nextId = adjacency.get(Number(node.id))?.[0];
      node = nextId ? nodes.find((n) => Number(n.id) === nextId) : undefined;
    }
    return { flowName: flow.name, preview };
  }

  private async findFlow(organizationId: number, flowId: number) {
    const flow = await this.prisma.botFlow.findFirst({
      where: { id: BigInt(flowId), organizationId: BigInt(organizationId) },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }

  private async findNode(organizationId: number, flowId: number, nodeId: number) {
    const flow = await this.findFlow(organizationId, flowId);
    const node = await this.prisma.botNode.findFirst({
      where: { id: BigInt(nodeId), flowId: flow.id },
    });
    if (!node) throw new NotFoundException('Node not found');
    return node;
  }
}
