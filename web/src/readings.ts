import { classify } from '@shared/quantity.js';
import { valueKey } from '@shared/modbus.js';
import type { Channel, Datapoint, Station } from './types';

export interface Reading {
  key: string;
  label: string;
  dp: Datapoint;
}

export interface ReadingGroup {
  title: string;
  readings: Reading[];
}

// What an engineer checks first on a meter: is there voltage on all phases,
// is current flowing, how much power and energy.
const WANTED = [
  { title: 'Voltage', quantity: 'voltage', phases: [1, 2, 3] },
  { title: 'Current', quantity: 'current', phases: [1, 2, 3] },
  { title: 'Power', quantity: 'power', phases: [0] },
  { title: 'Energy', quantity: 'energy', phases: [0] },
];

const phaseLabel = (phase: number) => (phase ? `L${phase}` : 'Total');

export function keyReadings(ch: Channel, st: Station): ReadingGroup[] {
  const classified = st.datapoints.map((dp) => ({ dp, kind: classify(dp) }));

  const groups = WANTED.map(({ title, quantity, phases }) => ({
    title,
    readings: phases.flatMap((phase) => {
      const match = classified.find(({ kind }) => kind.quantity === quantity && kind.phase === phase && !kind.isExport);
      return match ? [{ key: valueKey(ch, st, match.dp), label: phaseLabel(phase), dp: match.dp }] : [];
    }),
  })).filter((g) => g.readings.length);

  if (groups.length) return groups;

  // Not a meter we recognise: show the first few registers as they are
  const readings = st.datapoints.slice(0, 4).map((dp) => ({ key: valueKey(ch, st, dp), label: dp.description || `Register ${dp.startAddr}`, dp }));
  return readings.length ? [{ title: 'Registers', readings }] : [];
}
