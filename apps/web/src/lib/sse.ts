import type { SSEChatDelta, SSEChatDone, SSEParseProgress, SSEParseComplete } from '@/types/api';

type SSEEventMap = {
  'chat:delta': SSEChatDelta;
  'chat:done': SSEChatDone;
  'paper:parse:progress': SSEParseProgress;
  'paper:parse:complete': SSEParseComplete;
};

type EventCallback<T> = (data: T) => void;

class SSEManager {
  private es: EventSource | null = null;
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;

  connect() {
    if (this.es) return;

    const token = localStorage.getItem('accessToken');
    const url = token
      ? `/api/v1/sse/connect?token=${encodeURIComponent(token)}`
      : '/api/v1/sse/connect';

    this.es = new EventSource(url);

    this.es.onopen = () => {
      this.reconnectDelay = 3000;
    };

    this.es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventName = event.type;
        this.emit(eventName, data);
      } catch {
        // ignore non-JSON messages
      }
    };

    this.es.onerror = () => {
      this.disconnect();
      this.scheduleReconnect();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  on<K extends keyof SSEEventMap>(event: K, callback: EventCallback<SSEEventMap[K]>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
    return () => this.off(event, callback);
  }

  off<K extends keyof SSEEventMap>(event: K, callback: EventCallback<SSEEventMap[K]>) {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

export const sseManager = new SSEManager();
