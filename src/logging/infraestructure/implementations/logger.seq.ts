import {
  Inject,
  Injectable,
  LoggerService,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  SEQ_LOGGER_OPTIONS,
  SeqLoggerModuleOptions,
} from '../logger-seq.config';
import { envs } from 'src/config/envs';

@Injectable()
export class LoggerSeq implements LoggerService, OnModuleInit, OnModuleDestroy {
  private enabled = false;
  private batchedLogs: any[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private options: Required<SeqLoggerModuleOptions>;

  constructor(
    @Inject(SEQ_LOGGER_OPTIONS)
    private readonly userOptions: SeqLoggerModuleOptions,
  ) {
    // Default options
    this.options = {
      seqUrl: envs.seqUrl || '',
      apiKey: envs.seqApiKey || '',
      application: 'pay-bets-ms',
      workspace: envs.seqWorkSpace || '',
      minimumLevel: 'information',
      ...this.userOptions,
    };
  }

  // async onModuleInit() {
  //   if (this.options.seqUrl) {
  //     try {
  //       // Test connection to Seq
  //       await axios.get(`${this.options.seqUrl}/api`, {
  //         headers: this.options.apiKey
  //           ? { 'X-Seq-ApiKey': this.options.apiKey }
  //           : {},
  //         timeout: 3000,
  //       });

  //       this.enabled = true;
  //       this.startBatchProcessing();
  //       console.log(`Seq logger connected to ${this.options.seqUrl}`);
  //     } catch (error) {
  //       // Silently handle connection errors
  //       console.log(
  //         `Seq logger could not connect to ${this.options.seqUrl}. Logs will not be sent to Seq.`,
  //       );
  //     }
  //   } else {
  //     console.log('Seq URL not provided. Seq logging is disabled.');
  //   }
  // }

  async onModuleInit() {
    if (this.options.seqUrl) {
      try {
        const headers: Record<string, string> = {};
        if (this.options.apiKey) {
          headers['X-Seq-ApiKey'] = this.options.apiKey;
        }

        // Configurar un timeout manual ya que fetch no tiene timeout nativo
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(`${this.options.seqUrl}/api`, {
          method: 'GET',
          headers,
          signal: controller.signal, // para manejar el timeout
        });

        clearTimeout(timeoutId);

        this.enabled = true;
        this.startBatchProcessing();
        console.log(`Seq logger connected to ${this.options.seqUrl}`);
      } catch (error: any) {
        // Manejar errores de red, timeout, etc.
        if (error.name === 'AbortError') {
          console.log(
            `Seq logger timed out when connecting to ${this.options.seqUrl}. Logs will not be sent to Seq.`,
          );
        } else {
          console.log(
            `Seq logger could not connect to ${this.options.seqUrl}. Logs will not be sent to Seq. Error: ${error.message}`,
          );
        }
      }
    } else {
      console.log('Seq URL not provided. Seq logging is disabled.');
    }
  }

  onModuleDestroy() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    // Send any remaining logs before shutting down
    if (this.enabled && this.batchedLogs.length > 0) {
      this.flushLogs().catch(() => {});
    }
  }

  private startBatchProcessing() {
    this.batchInterval = setInterval(() => {
      if (this.batchedLogs.length > 0) {
        this.flushLogs().catch(() => {});
      }
    }, 5000); // Envía logs cada 5 segundos
  }

  private async flushLogs() {
    if (!this.enabled || this.batchedLogs.length === 0) return;

    const logsToSend = [...this.batchedLogs];
    this.batchedLogs = [];

    try {
      // Convertir los eventos a formato CLEF (newline-separated JSON)
      const clefEvents = logsToSend
        .map((event) => JSON.stringify(event))
        .join('\n');

      const headers: Record<string, string> = {
        'Content-Type': 'application/vnd.serilog.clef',
      };
      if (this.options.apiKey) {
        headers['X-Seq-ApiKey'] = this.options.apiKey;
      }

      const response = await fetch(`${this.options.seqUrl}/ingest/clef`, {
        method: 'POST',
        headers,
        body: clefEvents,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Error enviando logs a Seq: ${response.status} ${response.statusText}`,
          errorText,
        );
        return;
      }

      const responseData = await response.text(); // Seq puede responder con texto o JSON
      console.log(
        `Enviados ${logsToSend.length} eventos a Seq. Respuesta:`,
        response.status,
        responseData,
      );
    } catch (error: any) {
      console.error('Error de red enviando logs a Seq:', error.message);
    }
  }

  // private async flushLogs() {
  //   if (!this.enabled || this.batchedLogs.length === 0) return;

  //   const logsToSend = [...this.batchedLogs];
  //   this.batchedLogs = [];

  //   try {
  //     // Convertir los eventos a formato CLEF (newline-separated JSON)
  //     const clefEvents = logsToSend
  //       .map((event) => JSON.stringify(event))
  //       .join('\n');

  //     // Enviar al endpoint correcto: /ingest/clef
  //     const response = await axios.post(
  //       `${this.options.seqUrl}/ingest/clef`,
  //       clefEvents,
  //       {
  //         headers: {
  //           'Content-Type': 'application/vnd.serilog.clef',
  //           ...(this.options.apiKey
  //             ? { 'X-Seq-ApiKey': this.options.apiKey }
  //             : {}),
  //         },
  //       },
  //     );

  //     console.log(
  //       `Enviados ${logsToSend.length} eventos a Seq. Respuesta:`,
  //       response.status,
  //       response.data,
  //     );
  //   } catch (error) {
  //     console.error(
  //       'Error enviando logs a Seq:',
  //       error.response?.data || error.message,
  //     );
  //   }
  // }

  private addLogToBatch(
    level: string,
    message: string,
    context?: string,
    data?: any,
  ) {
    if (!this.enabled) return;

    const levels = {
      verbose: 'Verbose',
      debug: 'Debug',
      log: 'Information',
      warn: 'Warning',
      error: 'Error',
      fatal: 'Fatal',
    };

    const seqLevel = levels[level] || 'Information';
    const levelMap = {
      Verbose: 0,
      Debug: 1,
      Information: 2,
      Warning: 3,
      Error: 4,
      Fatal: 5,
    };

    if (levelMap[seqLevel] < levelMap[this.options.minimumLevel]) {
      return;
    }

    // Crear evento básico en formato CLEF
    const logEntry: Record<string, any> = {
      '@t': new Date().toISOString(), // Timestamp (obligatorio)
      '@mt': message, // Message template (obligatorio)
      '@l': seqLevel, // Level
    };

    // Si existe datos de excepción, incluirla
    if (data?.stack) {
      logEntry['@x'] = data.stack; // Exception
    }

    // Si existe un ID de evento, incluirlo
    if (data?.eventId) {
      logEntry['@i'] = data.eventId; // Event ID
    }

    // Soporte para trazas (si se proporciona la información)
    if (data?.traceId) {
      logEntry['@tr'] = data.traceId; // Trace ID
    }

    if (data?.spanId) {
      logEntry['@sp'] = data.spanId; // Span ID
    }

    if (data?.parentId) {
      logEntry['@ps'] = data.parentId; // Parent ID
    }

    // Información de componente
    if (context) {
      logEntry['@sc'] = context; // Instrumentation scope (componente)
    }

    // Recursos/Infraestructura
    logEntry['@ra'] = {
      'service.name': this.options.application || 'whitelabel-api',
      'service.workspace': this.options.workspace || 'kingboxplus',
      'host.name': process.env.HOSTNAME || 'unknown',
      // 'deployment.environment': process.env.NODE_ENV || 'development', // Each server has own environment
    };

    // Si es una operación que representa un span
    if (data?.spanKind) {
      // Los valores permitidos según la especificación son:
      // Client, Server, Internal, Producer, Consumer
      logEntry['@sk'] = data.spanKind; // Span kind

      // Si tiene hora de inicio (para spans)
      if (data?.startTime) {
        logEntry['@st'] = data.startTime; // Start timestamp
      }
    }

    // Propiedades personalizadas (excluir las ya procesadas)
    const customProps = { ...data };
    const reservedProps = [
      'stack',
      'eventId',
      'traceId',
      'spanId',
      'parentId',
      'startTime',
      'spanKind',
    ];

    reservedProps.forEach((prop) => delete customProps[prop]);

    // Agregar propiedades personalizadas aplanadas
    Object.entries(this.flattenProperties(customProps)).forEach(
      ([key, value]) => {
        // Evitar sobrescribir propiedades especiales
        if (!key.startsWith('@')) {
          logEntry[key] = value;
        }
      },
    );

    this.batchedLogs.push(logEntry);

    if (this.batchedLogs.length >= 10) {
      this.flushLogs().catch(() => {});
    }
  }

  // Implementación segura de flattenProperties
  private flattenProperties(obj: any, prefix = ''): Record<string, any> {
    if (!obj || typeof obj !== 'object') return {};

    const result: Record<string, any> = {};

    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        key !== 'stack' &&
        typeof obj[key] !== 'function'
      ) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value === null || value === undefined) {
          result[newKey] = null;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          try {
            // Verifica si se puede convertir a JSON (no circular)
            JSON.stringify(value);
            // Si llega aquí, no hubo error, continúa aplanando
            Object.assign(result, this.flattenProperties(value, newKey));
          } catch (e) {
            console.log('Error flatten properties', e);

            // Si hay referencias circulares, lo convierte a string
            result[newKey] = '[Objeto circular]';
          }
        } else {
          result[newKey] = value;
        }
      }
    }

    return result;
  }

  // Logger estándar
  log(message: any, context?: string, data?: any): void {
    this.addLogToBatch('log', this.formatMessage(message), context, data);
    console.log(`[Global] ${this.formatMessage(message)}`);
  }

  // Errores con stack trace
  error(
    message: any,
    trace?: string | Error,
    context?: string,
    data?: any,
  ): void {
    const errorData = { ...data };

    // Manejar trace como string o como objeto Error
    if (trace instanceof Error) {
      errorData.stack = trace.stack;
    } else if (typeof trace === 'string') {
      errorData.stack = trace;
    }

    this.addLogToBatch(
      'error',
      this.formatMessage(message),
      context,
      errorData,
    );
    console.error(
      `[${context || 'Global'}] ${this.formatMessage(message)}`,
      errorData.stack || '',
    );
  }

  // Advertencias
  warn(message: any, context?: string, data?: any): void {
    this.addLogToBatch('warn', this.formatMessage(message), context, data);
    console.warn(`[${context || 'Global'}] ${this.formatMessage(message)}`);
  }

  // Logs de depuración
  debug(message: any, context?: string, data?: any): void {
    this.addLogToBatch('debug', this.formatMessage(message), context, data);
    console.debug(`[${context || 'Global'}] ${this.formatMessage(message)}`);
  }

  // Logs detallados
  verbose(message: any, context?: string, data?: any): void {
    this.addLogToBatch('verbose', this.formatMessage(message), context, data);
    console.log(
      `[Verbose][${context || 'Global'}] ${this.formatMessage(message)}`,
    );
  }

  // Errores críticos
  fatal(message: any, context?: string, data?: any): void {
    this.addLogToBatch('fatal', this.formatMessage(message), context, data);
    console.error(
      `[Fatal][${context || 'Global'}] ${this.formatMessage(message)}`,
    );
  }

  // Para logs relacionados con trazas/spans
  traceEvent(
    message: any,
    context?: string,
    traceData?: {
      traceId?: string;
      spanId?: string;
      parentId?: string;
      spanKind?: 'Client' | 'Server' | 'Internal' | 'Producer' | 'Consumer';
      startTime?: string;
      [key: string]: any;
    },
  ): void {
    this.addLogToBatch('log', this.formatMessage(message), context, traceData);
    console.log(
      `[Trace][${context || 'Global'}] ${this.formatMessage(message)}`,
    );
  }

  private formatMessage(message: any): string {
    if (typeof message === 'object') {
      return JSON.stringify(message);
    }
    return String(message);
  }

  public objectToJson(obj: any, maxDepth = 8): any {
    // Creamos un cache para detectar referencias circulares
    const cache = new WeakSet();

    const convertToSerializable = (value: any, currentDepth = 0): any => {
      // Para valores primitivos, devolvemos directamente
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object') return value;

      // Control de profundidad para evitar objetos excesivamente anidados
      if (currentDepth >= maxDepth) return '[Max Depth Reached]';

      // Detectar referencias circulares
      if (cache.has(value)) return '[Circular Reference]';
      cache.add(value);

      // Manejar arrays
      if (Array.isArray(value)) {
        return value.map((item) =>
          convertToSerializable(item, currentDepth + 1),
        );
      }

      // Manejar objetos regulares
      const result: Record<string, any> = {};

      // Consideramos solo propiedades enumerables
      for (const key of Object.keys(value)) {
        try {
          // Skip propiedades internas o funciones
          if (typeof value[key] === 'function') {
            result[key] = '[Function]';
            continue;
          }

          // Ignorar propiedades que suelen causar problemas en req/res
          if (
            [
              'socket',
              'connection',
              'client',
              '_events',
              '_eventsCount',
              '_maxListeners',
            ].includes(key)
          ) {
            result[key] = '[Object]';
            continue;
          }

          result[key] = convertToSerializable(value[key], currentDepth + 1);
        } catch (err) {
          console.log('ERROR CONVERT TO SERIALIZABLE', err);

          result[key] = '[Error: Unable to serialize]';
        }
      }

      return result;
    };

    try {
      return convertToSerializable(obj);
    } catch (error) {
      return {
        error: 'Failed to convert object',
        message: (error as Error).message,
      };
    }
  }
}
