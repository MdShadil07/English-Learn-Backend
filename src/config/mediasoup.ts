import type { WorkerSettings, RouterOptions, WebRtcTransportOptions } from 'mediasoup';
import os from 'os';

export const mediasoupConfig = {
  numWorkers: process.env.MEDIASOUP_WORKERS ? parseInt(process.env.MEDIASOUP_WORKERS) : os.cpus().length,
  
  worker: {
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: process.env.MEDIASOUP_MIN_PORT ? parseInt(process.env.MEDIASOUP_MIN_PORT) : 10000,
    rtcMaxPort: process.env.MEDIASOUP_MAX_PORT ? parseInt(process.env.MEDIASOUP_MAX_PORT) : 10100,
  } as WorkerSettings,

  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  } as RouterOptions,

  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  } as WebRtcTransportOptions,
};
