import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { envs } from 'src/config/envs';
import { LoggerPort } from 'src/logging/domain/logger.port';
import { RedisPort } from 'src/redis/domain/redis.port';

@Injectable()
export class RedisService implements RedisPort {
  private handlers = new Map<string, (data: any) => void>();
  private redisManager: Redis;
  constructor(
    private readonly loggerPort: LoggerPort,
    @Inject('REDIS_SUBSCRIBER') private readonly redisSub: Redis,
    @Inject('REDIS_PUBLISHER') private readonly redisPub: Redis,
  ) {
    this.redisSub.on('message', (__, message) => {
      // Extrae data y correlationId
      // En la data vendria la response
      const { correlationId, data } = JSON.parse(message);
      // Selecciona handler por corrlationId
      const handler = this.handlers.get(correlationId);
      if (handler) {
        handler(data);
        // borra el handler
        this.handlers.delete(correlationId);
      }
    });

    this.redisManager = new Redis({
      host: envs.redisHost,
      port: envs.redisPort,
      password: envs.redisPassword,
    });
  }
  async get(key: string): Promise<string | null> {
    return await this.redisManager.get(key);
  }
  async set(key: string, value: any, ttl: number): Promise<string> {
    return await this.redisManager.set(key, value, 'EX', ttl);
  }
  async publish(event: string, data: any): Promise<void> {
    await this.redisPub.publish(event, data);
  }
  async subscribe(event: string, data: any): Promise<void> {
    await this.redisSub.subscribe(event, () => {
      console.log('Subscribe on channel: ', event);
    });
  }

  async send<T = any>(
    pattern: string,
    data: any,
    timeoutMs = 2000,
    maxRetries = 3, // ⬅️ Número máximo de reintentos
    retryDelayMs = 500, // ⬅️ Retraso inicial entre reintentos
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendSingleAttempt<T>(pattern, data, timeoutMs);
      } catch (err) {
        // const error = err as Error;

        // Solo reintentamos en caso de Timeout o errores de publicación
        // Puedes ajustar esta lógica según tus necesidades
        const isRetryable =
          err.message.includes('Timeout') || err.message.includes('publish');

        if (!isRetryable || attempt === maxRetries) {
          throw err; // Propaga si no es reintentable o ya no quedan intentos
        }

        // Esperar antes del próximo intento
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)),
        ); // backoff exponencial opcional
        this.loggerPort.log(
          `[Retry ${attempt + 1}/${maxRetries}] Reintentando enviar ${pattern}...`,
        );
      }
    }

    // ✅ Esto NUNCA debería ejecutarse, pero TypeScript lo requiere.
    //    Lo marcamos como "unreachable".
    throw new Error('Unexpected error: send loop exited without throwing');
  }
  // Método auxiliar: lógica de un solo intento (tu método original mejorado)
  private async sendSingleAttempt<T = any>(
    pattern: string,
    data: any,
    timeoutMs: number,
  ): Promise<T> {
    const correlationId = randomUUID();
    const replyChannel = `rpc:reply:${correlationId}`;

    await this.redisSub.subscribe(replyChannel);

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        this.handlers.delete(correlationId);
        this.redisSub.unsubscribe(replyChannel).catch((err) => {
          this.loggerPort.warn(
            `Failed to unsubscribe from ${replyChannel}:`,
            err,
          );
        });
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for response on ${pattern}`));
      }, timeoutMs);

      this.handlers.set(correlationId, (responseData) => {
        clearTimeout(timeout);
        cleanup();
        resolve(responseData);
      });

      const channel = `${pattern}-${this.randomSubscriber()}`;
      this.loggerPort.log(
        `[SOCKET-ROULETTE-SERVICE RPC event send] ${channel}`,
        { correlationId, replyChannel, data },
      );
      this.redisPub
        .publish(channel, JSON.stringify({ correlationId, replyChannel, data }))
        .catch((err) => {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(`Failed to publish message: ${err.message}`));
        });
    });
  }

  private randomSubscriber() {
    return Math.floor(Math.random() * envs.subscribersInstances) + 1;
  }
}
