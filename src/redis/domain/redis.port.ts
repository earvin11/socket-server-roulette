export abstract class RedisPort {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: any, ttl: number): Promise<string>;
  abstract publish(event: string, data: any): Promise<void>;
  abstract subscribe(event: string, data: any): Promise<void>;
  abstract send<T>(pattern: string, data: any, timeoutMs?: number): Promise<T>;
}
