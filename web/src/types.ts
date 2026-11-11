export type ChannelType = 'tcp' | 'rtu';

export interface Datapoint {
  id: string;
  description: string;
  startAddr: number;
  dataType: string;
  regSize: number;
  byteOrder: string;
  funcCode: number;
  acqCycle: number;
  scale: number;
  units: string;
}

export interface Station {
  id: string;
  name: string;
  address: number;
  datapoints: Datapoint[];
}

export interface Channel {
  id: string;
  channelId: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  host?: string;
  port?: number;
  serialPort?: string;
  baudrate?: number;
  parity?: string;
  stopbits?: number;
  bytesize?: number;
  requestRetries: number;
  requestTimeout: number;
  connectRetries: number;
  connectTimeout: number;
  stations: Station[];
}

export type LinkState = 'ok' | 'timeout' | 'partial' | 'waiting' | 'idle' | 'disabled' | 'unknown';

export interface StationStatus {
  id: string;
  state: LinkState;
  lastValueAt: number | null;
  lastErrorAt: number | null;
  errorCount: number;
}

export interface ChannelStatus {
  id: string;
  state: LinkState;
  stations: StationStatus[];
}

export interface FieldError {
  field: string;
  message: string;
  // Channel / station name, set when a whole config is checked
  where?: string;
}

// [timestamp ms, value]
export type Sample = [number, number];
