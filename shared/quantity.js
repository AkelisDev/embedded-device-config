// Works out what a register measures from its units and description, so the
// UI can find e.g. the L1 voltage without the user tagging every register.

// Units in the field are inconsistent ("Volts" vs "V"), so match loosely.
// The factor converts from the model's base unit to the register's unit.
const UNITS = {
  v: ['voltage', 1], volts: ['voltage', 1],
  a: ['current', 1], amps: ['current', 1],
  w: ['power', 1], kw: ['power', 1e-3],
  va: ['apparent', 1], kva: ['apparent', 1e-3],
  var: ['reactive', 1], kvar: ['reactive', 1e-3],
  wh: ['energy', 1], kwh: ['energy', 1e-3],
  varh: ['reactiveEnergy', 1], kvarh: ['reactiveEnergy', 1e-3],
  hz: ['frequency', 1],
};

export function classify(dp) {
  const descr = dp.description.toLowerCase();
  const [quantity, factor] = descr.includes('power factor')
    ? ['pf', 1]
    : UNITS[dp.units.trim().toLowerCase()] ?? ['generic', 1];
  const phase = Number(descr.match(/\b(?:phase|l)\s*([123])\b/)?.[1]) || 0;
  return { quantity, factor, phase, isExport: descr.includes('export'), isAverage: descr.includes('average') };
}
