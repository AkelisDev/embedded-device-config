// The device firmware reads modbus_config.json as is (every value is a string),
// so the file keeps its format and we only convert at the API boundary.

import { DATA_TYPES } from './modbus.js';

const toNum = (v) => (v === undefined || v === '' ? undefined : Number(v));

function readDatapoint(d) {
  return {
    id: String(d.id),
    description: d.meta?.descr ?? '',
    startAddr: toNum(d.start_addr),
    dataType: d.data_type,
    regSize: toNum(d.reg_size),
    byteOrder: d.byte_order,
    funcCode: toNum(d.func_code),
    acqCycle: toNum(d.acq_cycle),
    scale: toNum(d.meta?.scale) ?? 1,
    units: d.meta?.units ?? '',
  };
}

function writeDatapoint(d) {
  return {
    id: String(d.id),
    start_addr: String(d.startAddr),
    reg_size: String(DATA_TYPES[d.dataType] ?? d.regSize),
    data_type: d.dataType,
    byte_order: d.byteOrder,
    func_code: String(d.funcCode),
    acq_cycle: String(d.acqCycle),
    meta: { descr: d.description, scale: String(d.scale), units: d.units },
  };
}

function readStation(s) {
  return {
    id: String(s.id),
    name: s.name,
    address: toNum(s.station_addr),
    datapoints: (s.datapoints ?? []).map(readDatapoint),
  };
}

function writeStation(s) {
  return {
    station_addr: String(s.address),
    id: String(s.id),
    name: s.name,
    datapoints: s.datapoints.map(writeDatapoint),
  };
}

function readChannel(c, type) {
  const channel = {
    // channel_id repeats between the TCP and serial lists, so prefix it
    id: `${type}-${c.channel_id}`,
    channelId: String(c.channel_id),
    type,
    name: c.name,
    enabled: c.enable === 'true' || c.enable === true,
    requestRetries: toNum(c.request_retries),
    requestTimeout: toNum(c.request_timeout),
    connectRetries: toNum(c.connect_retries),
    connectTimeout: toNum(c.connect_timeout),
    stations: (c.stations ?? []).map(readStation),
  };

  if (type === 'tcp') {
    channel.host = c.tcp_host;
    channel.port = toNum(c.tcp_port);
  } else {
    channel.serialPort = c.ser_port;
    channel.baudrate = toNum(c.baudrate);
    channel.parity = c.parity;
    channel.stopbits = toNum(c.stopbits);
    channel.bytesize = toNum(c.bytesize);
  }
  return channel;
}

function writeChannel(c) {
  const out = {
    channel_id: c.channelId,
    name: c.name,
    conn_type: c.type,
    request_retries: String(c.requestRetries),
    request_timeout: String(c.requestTimeout),
    connect_retries: String(c.connectRetries),
    connect_timeout: String(c.connectTimeout),
    enable: String(!!c.enabled),
  };

  if (c.type === 'tcp') {
    out.tcp_host = c.host;
    out.tcp_port = String(c.port);
  } else {
    out.ser_port = c.serialPort;
    out.baudrate = String(c.baudrate);
    out.stopbits = String(c.stopbits);
    out.bytesize = String(c.bytesize);
    out.parity = c.parity;
  }
  out.stations = c.stations.map(writeStation);
  return out;
}

export function parseConfig(file) {
  const tcp = (file.modbus_tcp ?? []).map((c) => readChannel(c, 'tcp'));
  const rtu = (file.modbus_ser ?? []).map((c) => readChannel(c, 'rtu'));
  return [...tcp, ...rtu];
}

export function serializeConfig(channels) {
  return {
    modbus_tcp: channels.filter((c) => c.type === 'tcp').map(writeChannel),
    modbus_ser: channels.filter((c) => c.type === 'rtu').map(writeChannel),
  };
}
