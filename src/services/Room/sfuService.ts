import * as mediasoup from 'mediasoup';
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities
} from 'mediasoup/types';
import { mediasoupConfig } from '../../config/mediasoup.js';

interface RoomState {
  router: Router;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  participantTransports: Map<string, Set<string>>;
}

export class SFUService {
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;
  private rooms: Map<string, RoomState> = new Map();
  private workersReady: Promise<void>;

  constructor() {
    this.workersReady = this.initializeWorkers();
  }

  private async initializeWorkers() {
    const { numWorkers, worker: workerSettings } = mediasoupConfig;
    console.log(`🚀 Initializing ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(workerSettings);
      worker.on('died', () => {
        console.error('mediasoup worker died, exiting... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });
      this.workers.push(worker);
    }
  }

  private async getNextWorker(): Promise<Worker> {
    await this.workersReady;

    if (this.workers.length === 0) {
      throw new Error('Mediasoup workers are not available');
    }

    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  public async getOrCreateRouter(roomId: string): Promise<Router> {
    await this.workersReady;

    let room = this.rooms.get(roomId);
    if (!room) {
      const worker = await this.getNextWorker();
      const router = await worker.createRouter(mediasoupConfig.router);
      room = {
        router,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        participantTransports: new Map(),
      };
      this.rooms.set(roomId, room);
      router.on('workerclose', () => this.rooms.delete(roomId));
    }
    return room.router;
  }

  public async createWebRtcTransport(roomId: string, userId: string): Promise<any> {
    const router = await this.getOrCreateRouter(roomId);
    const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);
    
    const room = this.rooms.get(roomId)!;
    room.transports.set(transport.id, transport);

    const userTransports = room.participantTransports.get(userId) || new Set();
    userTransports.add(transport.id);
    room.participantTransports.set(userId, userTransports);

    transport.on('dtlsstatechange', (dtlsState: string) => {
      if (dtlsState === 'closed') transport.close();
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  public async connectTransport(roomId: string, transportId: string, dtlsParameters: any): Promise<void> {
    const transport = this.rooms.get(roomId)?.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');
    await transport.connect({ dtlsParameters });
  }

  public async createProducer(roomId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any, userId: string): Promise<string> {
    const room = this.rooms.get(roomId);
    const transport = room?.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({ 
      kind, 
      rtpParameters,
      appData: { userId, transportId } 
    });
    room!.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      producer.close();
      room!.producers.delete(producer.id);
    });

    return producer.id;
  }

  public async createConsumer(roomId: string, transportId: string, producerId: string, rtpCapabilities: RtpCapabilities): Promise<any> {
    const room = this.rooms.get(roomId);
    if (!room || !room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    room.consumers.set(consumer.id, consumer);
    consumer.on('transportclose', () => room.consumers.delete(consumer.id));
    consumer.on('producerclose', () => room.consumers.delete(consumer.id));

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
    };
  }

  public removeUser(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const userTransports = room.participantTransports.get(userId);
    if (userTransports) {
      userTransports.forEach(id => room.transports.get(id)?.close());
      room.participantTransports.delete(userId);
    }
  }

  public async resumeConsumer(roomId: string, consumerId: string): Promise<void> {
    const consumer = this.rooms.get(roomId)?.consumers.get(consumerId);
    if (!consumer) throw new Error('Consumer not found');
    await consumer.resume();
  }

  public getProducers(roomId: string): { id: string; userId: string; kind: string }[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const results: { id: string; userId: string; kind: string }[] = [];
    room.producers.forEach((producer, id) => {
      // Find which user this transport belongs to
      let userId = 'unknown';
      for (const [uid, transports] of room.participantTransports.entries()) {
        if (transports.has(producer.appData.transportId as string || '')) {
          userId = uid;
          break;
        }
      }
      
      results.push({
        id,
        userId: producer.appData.userId as string || 'unknown',
        kind: producer.kind
      });
    });
    return results;
  }

  public async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers = [];
  }
}

export const sfuService = new SFUService();
export default sfuService;
