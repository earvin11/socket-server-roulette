export const SEQ_LOGGER_OPTIONS = 'SEQ_LOGGER_OPTIONS';

export interface SeqLoggerModuleOptions {
  seqUrl?: string;
  apiKey?: string;
  application?: string;
  workspace?: string;
  minimumLevel?:
    | 'trace'
    | 'debug'
    | 'information'
    | 'warning'
    | 'error'
    | 'fatal';
}
