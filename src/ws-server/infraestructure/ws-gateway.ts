import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketEventsEnum } from 'src/shared/enums/socket-events.enum';
import { getEntityFromCacheOrDb } from 'src/shared/helpers/get-entity-from-cache-or-db.helper';
import { LoggerPort } from 'src/logging/domain/logger.port';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueName } from 'src/shared/enums/queues-names.enum';
import { Queue } from 'bullmq';
import { RedisPort } from 'src/redis/domain/redis.port';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { RpcChannels } from 'src/shared/enums/rpc-channels.enum';
import { isValidBet } from 'src/shared/helpers/is-valid-bet.helper';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server: Server;
  private connectedClients = new Set<string>();

  constructor(
    @InjectQueue(QueueName.BET)
    private readonly queueBet: Queue,
    private readonly loggerPort: LoggerPort,
    private readonly redisPort: RedisPort,
    @Inject('REDIS_SUBSCRIBER') private readonly sub: Redis,
    @Inject('REDIS_PUBLISHER') private readonly pub: Redis,
  ) {}

  onModuleInit() {
    this.sub.subscribe(
      SocketEventsEnum.BET_ERROR,
      SocketEventsEnum.BET_SUCCESS,
      SocketEventsEnum.ROUND_START,
      SocketEventsEnum.ROUND_END,
      SocketEventsEnum.ROUND_JACKPOT_VALUES,
    );

    this.sub.on(SocketEventsEnum.ROUND_START, async (message) => {
      const data = JSON.parse(message);
      const socketsInRoom = await this.server.in(data.channel).fetchSockets();
      const usersOnline = socketsInRoom.length;

      this.pub.publish(
        'socket_events',
        JSON.stringify({
          event: SocketEventsEnum.ROUND_START,
          data: {
            ...data,
            usersOnline,
          },
          room: data.channel,
        }),
      );

      // Emitir a los clientes socket.io
      this.server.to(data.channel).emit(SocketEventsEnum.ROUND_START, {
        msg: data.msg,
        round: data.round,
        usersOnline,
      });
    });

    this.sub.on(SocketEventsEnum.ROUND_JACKPOT_VALUES, async (message) => {
      const data = JSON.parse(message);
      this.server.to(data.channel).emit(SocketEventsEnum.ROUND_JACKPOT_VALUES, {
        msg: data.msg,
        jackpot_values: data.jackpot_values,
        round: data.round,
      });
    });

    this.sub.on(SocketEventsEnum.ROUND_END, async (message) => {
      const data = JSON.parse(message);

      const socketsInRoom = await this.server.in(data.chanenel).fetchSockets();
      const usersOnline = socketsInRoom.length;

      this.pub.publish(
        'socket_events',
        JSON.stringify({
          event: SocketEventsEnum.ROUND_END,
          data: {
            ...data,
            usersOnline,
          },
          room: data.channel,
        }),
      );

      this.server.to(data.channel).emit(SocketEventsEnum.ROUND_END, {
        msg: data.msg,
        result: data.result,
        round: data.round,
        usersOnline,
      });
    });

    this.sub.on(SocketEventsEnum.BET_ERROR, (message) => {
      const data = JSON.parse(message);
      this.server.to(data.channel).emit(SocketEventsEnum.BET_ERROR, {
        msg: data.msg,
      });
    });

    this.sub.on(SocketEventsEnum.BET_SUCCESS, (message) => {
      const data = JSON.parse(message);
      const { channel, ...restData } = data;
      this.server.to(data.channel).emit(SocketEventsEnum.BET_SUCCESS, {
        ...restData,
      });
    });

    this.sub.on(SocketEventsEnum.WINNER, (message) => {
      const data = JSON.parse(message);
      this.server.to(data.room).emit(SocketEventsEnum.WINNER, {
        ...data.data,
      });
    });

    this.sub.on(SocketEventsEnum.WINNER_ERR, (message) => {
      const data = JSON.parse(message);
      this.server.to(data.room).emit(SocketEventsEnum.WINNER_ERR, {
        ...data.data,
      });
    });
  }

  handleConnection(client: Socket, ...args: any[]) {
    // const userId = client.handshake.query['user_id'];
    const sessionID = client.id;
    const user = client.handshake.query['userId'];
    const roulette = client.handshake.query['rouletteId'];
    const operator = client.handshake.query['operator'];

    const room = `${roulette}`;
    const user_room = `${roulette}-${user}`;
    const sessionRoom = `${sessionID}`;
    // BLOQUEO DE PLAYER
    const user_status = `${user}`;

    const rooms = [room, user_room, user_status, sessionRoom];

    this.loggerPort.log('NEW CLIENT CONECTED');
    this.connectedClients.add(client.id);
    client.join(rooms);
    this.loggerPort.log(
      `Cliente conectado: ${client.id}. Total conectados: ${this.connectedClients.size}`,
    );

    client.use((packet, next) => {
      const event = packet[0];
      if (event === 'bet') {
        const data = packet[1];
        const { player, roulette: rouletteId } = data;
        const betData = data.bet;
        if (!betData) {
          return this.server
            .to(`${rouletteId}-${player}`)
            .emit(SocketEventsEnum.BET_ERROR, {
              msg: 'there is not bet',
            });
        }

        if (
          !isValidBet({
            calleNumbers: data.bet.calleNumbers || [],
            chanceSimple: data.bet.chanceSimple || [],
            color: data.bet.color || [],
            columns: data.bet.columns || [],
            cuadroNumbers: data.bet.cuadroNumbers || [],
            cubre: data.bet.cubre || [],
            dozens: data.bet.dozens || [],
            even_odd: data.bet.even_odd || [],
            lineaNumbers: data.bet.lineaNumbers || [],
            plenoNumbers: data.bet.plenoNumbers || [],
            semiPlenoNumbers: data.bet.semiPlenoNumbers || [],
            specialCalle: data.bet.specialCalle || [],
          })
        ) {
          return this.server
            .to(`${rouletteId}-${player}`)
            .emit(SocketEventsEnum.BET_ERROR, {
              msg: 'Bet invalid',
            });
        }
      }
      next();
    });
  }
  handleDisconnect(client: any) {
    this.loggerPort.log('CLIENT DISCONECTED');
    this.connectedClients.delete(client.id);
    this.loggerPort.log(
      `Cliente desconectado: ${client.id}, Total conectados: ${this.connectedClients.size}`,
    );
  }

  emitEvent(event: string, data: any) {
    this.server.emit(event, data);
  }

  //TODO: betEvent
  @SubscribeMessage(SocketEventsEnum.BET)
  async handleBet(@MessageBody() data: any) {
    try {
      const round = await getEntityFromCacheOrDb(
        () => this.redisPort.get(`round-roulette:${data.roulette}`),
        () =>
          this.redisPort.send<any>(RpcChannels.GET_ROUND, {
            filter: { identifierNumber: data.identifierNumber },
          }),
        (roundDb) =>
          this.redisPort.set(`round-roulette:${data.roulette}`, roundDb, 35),
      );

      // Validaciones de ronda
      if (!round) {
        this.server.emit(SocketEventsEnum.BET_ERROR, {
          error: 'Round not found',
        });
        return;
      }
      if (!round.open) {
        this.server.emit(SocketEventsEnum.BET_ERROR, {
          error: 'Round closed',
        });
        return;
      }

      await this.queueBet.add(QueueName.BET, { ...data, round });
      return;
    } catch (error) {
      this.loggerPort.error('Error generando apuesta', error);
      this.server.emit(SocketEventsEnum.BET_ERROR, {
        msg: 'Internal server error',
      });
      return;
    }
  }
}
