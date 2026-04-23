import { SFUService } from '../dist/services/Room/sfuService.js';

describe('SFUService (dist)', () => {
  let sfuService;

  beforeAll(async () => {
    sfuService = new SFUService();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for mediasoup workers')), 10000);
      const interval = setInterval(() => {
        if (sfuService.workers?.length > 0) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }, 12000);

  afterAll(async () => {
    await sfuService.shutdown();
  });

  it('creates and reuses the same router for the same room', async () => {
    const router1 = await sfuService.getOrCreateRouter('test-room-dist');
    const router2 = await sfuService.getOrCreateRouter('test-room-dist');
    expect(router1).toBe(router2);
  });

  it('creates a WebRTC transport with valid transport data', async () => {
    const transportData = await sfuService.createWebRtcTransport('test-room-dist', 'test-user-dist');

    expect(transportData).toHaveProperty('id');
    expect(transportData).toHaveProperty('iceParameters');
    expect(transportData).toHaveProperty('dtlsParameters');
    expect(transportData).toHaveProperty('iceCandidates');
  });
});
