export enum EventsEnum {
  ROUND_START = 'round.start',
  ROUND_END = 'round.end',
  ROUND_BET_TIME = 'round.end.bet.time',
  ROUND_JACKPOT = 'round.jackpot',
  ROUND_TO_CLOSED = 'round-to-closed',

  BET_SUCCESS = 'bet:success',
  BET_ERROR = 'bet:error',
  EMIT_JACKPOT = 'jackpot-values',
}
