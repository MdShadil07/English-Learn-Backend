import { redisCache } from '../../config/redis.js';

export type RoomMode = 'interactive' | 'classroom' | 'webinar';

export interface RoomMediaBudgets {
  maxActiveVideoPublishers: number;
  maxActiveAudioPublishers: number;
  maxVideoConsumersPerClient: number;
  maxAudioConsumersPerClient: number;
}

export interface RoomCoordinatorState {
  roomId: string;
  mode: RoomMode;
  participants: string[];
  activeSpeakers: string[];
  stageUsers: string[];
  audienceUsers: string[];
  mediaBudgets: RoomMediaBudgets;
  isLocked: boolean;
  updatedAt: string;
}

class RoomCoordinatorService {
  private readonly localState = new Map<string, RoomCoordinatorState>();
  // Map roomId -> (userId -> lastSeenEpochMs)
  private readonly participantLastSeen = new Map<string, Map<string, number>>();
  private readonly stateTtlSeconds = Number(process.env.ROOM_COORDINATOR_TTL_SECONDS || 60 * 60 * 12);
  private readonly snapshotsTtlSeconds = Number(process.env.ROOM_COORDINATOR_SNAPSHOT_TTL_SECONDS || 60 * 60 * 24);
  private readonly participantTtlSeconds = Number(process.env.ROOM_PARTICIPANT_TTL_SECONDS || 60 * 5); // default 5 minutes

  private getStateKey(roomId: string): string {
    return `room:coordinator:state:${roomId}`;
  }

  private getSnapshotsKey(roomId: string): string {
    return `room:coordinator:snapshots:${roomId}`;
  }

  private getRoomIndexKey(): string {
    return 'room:coordinator:index';
  }

  private getDefaultBudgets(mode: RoomMode): RoomMediaBudgets {
    if (mode === 'interactive') {
      return {
        maxActiveVideoPublishers: 25,
        maxActiveAudioPublishers: 50,
        maxVideoConsumersPerClient: 12,
        maxAudioConsumersPerClient: 32,
      };
    }

    if (mode === 'classroom') {
      return {
        maxActiveVideoPublishers: 12,
        maxActiveAudioPublishers: 50,
        maxVideoConsumersPerClient: 9,
        maxAudioConsumersPerClient: 24,
      };
    }

    return {
      maxActiveVideoPublishers: 6,
      maxActiveAudioPublishers: 24,
      maxVideoConsumersPerClient: 6,
      maxAudioConsumersPerClient: 16,
    };
  }

  private normalizeState(state: RoomCoordinatorState): RoomCoordinatorState {
    // Ensure participants reflect last-seen map when available
    const lastSeen = this.participantLastSeen.get(state.roomId);
    const participants = lastSeen ? Array.from(lastSeen.keys()) : Array.from(new Set(state.participants));

    return {
      ...state,
      participants,
      activeSpeakers: Array.from(new Set(state.activeSpeakers)).filter((id) => participants.includes(id)),
      stageUsers: Array.from(new Set(state.stageUsers)).filter((id) => participants.includes(id)),
      audienceUsers: Array.from(new Set(state.audienceUsers)).filter((id) => participants.includes(id)),
      updatedAt: new Date().toISOString(),
    };
  }

  private async persistState(state: RoomCoordinatorState): Promise<RoomCoordinatorState> {
    // prune stale participants before persisting
    await this.pruneStaleParticipants(state.roomId);
    const normalized = this.normalizeState(state);
    this.localState.set(normalized.roomId, normalized);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        if (client) {
          const payload = JSON.stringify(normalized);
          const indexKey = this.getRoomIndexKey();
          const stateKey = this.getStateKey(normalized.roomId);
          const snapshotsKey = this.getSnapshotsKey(normalized.roomId);

          await client.multi()
            .set(stateKey, payload, 'EX', this.stateTtlSeconds)
            .sadd(indexKey, normalized.roomId)
            .expire(indexKey, this.stateTtlSeconds)
            .lpush(snapshotsKey, payload)
            .ltrim(snapshotsKey, 0, 49)
            .expire(snapshotsKey, this.snapshotsTtlSeconds)
            .exec();
        }
      } catch (error) {
        console.warn('[RoomCoordinator] Redis persist failed, using local cache only', error);
      }
    }

    return normalized;
  }

  private async loadState(roomId: string): Promise<RoomCoordinatorState | null> {
    const cached = this.localState.get(roomId);
    if (cached) return cached;

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        if (client) {
          const payload = await client.get(this.getStateKey(roomId));
          if (payload) {
            const parsed = JSON.parse(payload) as RoomCoordinatorState;
            // initialize last-seen map for participants (assume recent)
            const map = new Map<string, number>();
            for (const p of parsed.participants || []) map.set(p, Date.now());
            this.participantLastSeen.set(roomId, map);
            this.localState.set(roomId, parsed);
            return parsed;
          }
        }
      } catch (error) {
        console.warn('[RoomCoordinator] Redis load failed, falling back to local state', error);
      }
    }

    return null;
  }

  async ensureRoomState(roomId: string, options?: { mode?: RoomMode; participants?: string[]; isLocked?: boolean }): Promise<RoomCoordinatorState> {
    const existing = await this.loadState(roomId);
    if (existing) return existing;

    const mode = options?.mode || 'webinar';
    const participants = options?.participants || [];

    // initialize last-seen map
    if (!this.participantLastSeen.has(roomId)) {
      const map = new Map<string, number>();
      for (const p of participants) map.set(p, Date.now());
      this.participantLastSeen.set(roomId, map);
    }

    return this.persistState({
      roomId,
      mode,
      participants,
      activeSpeakers: [],
      stageUsers: [],
      audienceUsers: participants,
      mediaBudgets: this.getDefaultBudgets(mode),
      isLocked: options?.isLocked || false,
      updatedAt: new Date().toISOString(),
    });
  }

  async addParticipant(roomId: string, userId: string): Promise<RoomCoordinatorState> {
    const state = await this.ensureRoomState(roomId);

    // touch last-seen
    if (!this.participantLastSeen.has(roomId)) this.participantLastSeen.set(roomId, new Map());
    this.participantLastSeen.get(roomId)!.set(userId, Date.now());

    const currentParticipants = Array.from(this.participantLastSeen.get(roomId)!.keys());
    const nextAudience = state.audienceUsers.includes(userId) || state.stageUsers.includes(userId)
      ? state.audienceUsers
      : [...state.audienceUsers, userId];

    return this.persistState({
      ...state,
      participants: currentParticipants,
      audienceUsers: nextAudience,
    });
  }

  async removeParticipant(roomId: string, userId: string): Promise<RoomCoordinatorState | null> {
    const state = await this.loadState(roomId);
    if (!state) return null;

    // remove from last-seen map as well
    const lastSeen = this.participantLastSeen.get(roomId);
    if (lastSeen) {
      lastSeen.delete(userId);
    }

    const next = await this.persistState({
      ...state,
      participants: (this.participantLastSeen.get(roomId) && Array.from(this.participantLastSeen.get(roomId)!.keys())) || state.participants.filter((id) => id !== userId),
      activeSpeakers: state.activeSpeakers.filter((id) => id !== userId),
      stageUsers: state.stageUsers.filter((id) => id !== userId),
      audienceUsers: state.audienceUsers.filter((id) => id !== userId),
    });

    if (next.participants.length === 0) {
      await this.clearRoomState(roomId);
      return null;
    }

    return next;
  }

  private async pruneStaleParticipants(roomId: string): Promise<void> {
    const lastSeen = this.participantLastSeen.get(roomId);
    if (!lastSeen) return;
    const now = Date.now();
    let changed = false;
    for (const [userId, ts] of Array.from(lastSeen.entries())) {
      if (now - ts > this.participantTtlSeconds * 1000) {
        lastSeen.delete(userId);
        changed = true;
      }
    }

    if (changed) {
      // if we have a persisted state, update it to reflect removals
      const state = await this.loadState(roomId);
      if (state) {
        const participants = Array.from(lastSeen.keys());
        await this.persistState({
          ...state,
          participants,
          activeSpeakers: state.activeSpeakers.filter((id) => participants.includes(id)),
          stageUsers: state.stageUsers.filter((id) => participants.includes(id)),
          audienceUsers: state.audienceUsers.filter((id) => participants.includes(id)),
        });
      }
    }
  }

  async setActiveSpeakers(roomId: string, userIds: string[]): Promise<RoomCoordinatorState> {
    const state = await this.ensureRoomState(roomId);
    return this.persistState({
      ...state,
      activeSpeakers: userIds,
    });
  }

  async setMode(roomId: string, mode: RoomMode): Promise<RoomCoordinatorState> {
    const state = await this.ensureRoomState(roomId);
    return this.persistState({
      ...state,
      mode,
      mediaBudgets: this.getDefaultBudgets(mode),
    });
  }

  async setLock(roomId: string, isLocked: boolean): Promise<RoomCoordinatorState> {
    const state = await this.ensureRoomState(roomId);
    return this.persistState({
      ...state,
      isLocked,
    });
  }

  async setStageUsers(roomId: string, stageUsers: string[]): Promise<RoomCoordinatorState> {
    const state = await this.ensureRoomState(roomId);
    const stageSet = new Set(stageUsers.filter((id) => state.participants.includes(id)));

    return this.persistState({
      ...state,
      stageUsers: Array.from(stageSet),
      audienceUsers: state.participants.filter((id) => !stageSet.has(id)),
    });
  }

  async getRoomState(roomId: string): Promise<RoomCoordinatorState | null> {
    return this.loadState(roomId);
  }

  async listRoomStates(): Promise<RoomCoordinatorState[]> {
    const fromLocal = Array.from(this.localState.values());

    if (!redisCache.isConnected()) {
      return fromLocal;
    }

    try {
      const client = redisCache.getClient();
      if (!client) return fromLocal;

      const roomIds = await client.smembers(this.getRoomIndexKey());
      if (!roomIds.length) return fromLocal;

      const pipeline = client.pipeline();
      roomIds.forEach((roomId: string) => pipeline.get(this.getStateKey(roomId)));
      const result = await pipeline.exec();

      const states: RoomCoordinatorState[] = [];
      for (const row of result || []) {
        const payload = row?.[1];
        if (typeof payload === 'string') {
          const parsed = JSON.parse(payload) as RoomCoordinatorState;
          this.localState.set(parsed.roomId, parsed);
          states.push(parsed);
        }
      }

      if (states.length > 0) return states;
      return fromLocal;
    } catch (error) {
      console.warn('[RoomCoordinator] listRoomStates failed, using local cache only', error);
      return fromLocal;
    }
  }

  async getRoomSnapshots(roomId: string, limit = 20): Promise<RoomCoordinatorState[]> {
    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        if (client) {
          const payloads = await client.lrange(this.getSnapshotsKey(roomId), 0, Math.max(0, limit - 1));
          return payloads.map((item: string) => JSON.parse(item) as RoomCoordinatorState);
        }
      } catch (error) {
        console.warn('[RoomCoordinator] getRoomSnapshots failed', error);
      }
    }

    const state = this.localState.get(roomId);
    return state ? [state] : [];
  }

  async clearRoomState(roomId: string): Promise<void> {
    this.localState.delete(roomId);

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        if (client) {
          await client.multi()
            .del(this.getStateKey(roomId))
            .del(this.getSnapshotsKey(roomId))
            .srem(this.getRoomIndexKey(), roomId)
            .exec();
        }
      } catch (error) {
        console.warn('[RoomCoordinator] clearRoomState failed', error);
      }
    }
  }
}

export const roomCoordinatorService = new RoomCoordinatorService();
export default roomCoordinatorService;
