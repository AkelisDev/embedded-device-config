<script setup lang="ts">
import { DATA_TYPES, BYTE_ORDERS, regCount } from '@shared/modbus.js';
import { modbusAddress } from '../../registers';
import type { Datapoint } from '../../types';

// dp is an object inside the draft list, so editing its fields here edits the
// draft directly; one emit per keystroke for hundreds of rows isn't worth it.
defineProps<{ dp: Datapoint; errors?: Record<string, string>; selected: boolean }>();
defineEmits<{ toggle: [range: boolean]; remove: [] }>();

const TYPES = Object.keys(DATA_TYPES);
// Short labels so the column stays narrow; the full name is in the filters
const FUNCTIONS: Record<number, string> = { 1: '1 Coil', 2: '2 Discrete', 3: '3 Holding', 4: '4 Input' };
</script>

<template>
  <tr :class="{ selected, invalid: errors }">
    <td><input type="checkbox" :checked="selected" @click="$emit('toggle', $event.shiftKey)" /></td>
    <td>
      <!-- lazy: the table is sorted by address, so the row moves only when the edit is done -->
      <input
        v-model.lazy.number="dp.startAddr"
        class="addr"
        type="number"
        min="0"
        max="65535"
        :class="{ bad: errors?.startAddr }"
        :title="errors?.startAddr"
      />
    </td>
    <td class="modbus">{{ modbusAddress(dp) }}</td>
    <td><input v-model="dp.description" class="descr" :class="{ bad: errors?.description }" /></td>
    <td>
      <select v-model="dp.dataType" class="type" :class="{ bad: errors?.dataType }" :title="errors?.dataType">
        <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
    </td>
    <td class="num muted">{{ regCount(dp) }}</td>
    <td>
      <select v-model.number="dp.funcCode" class="fc" :class="{ bad: errors?.funcCode }" :title="errors?.funcCode">
        <option v-for="(label, fc) in FUNCTIONS" :key="fc" :value="Number(fc)">{{ label }}</option>
      </select>
    </td>
    <td>
      <select v-model="dp.byteOrder" class="order" :class="{ bad: errors?.byteOrder }">
        <option v-for="o in BYTE_ORDERS" :key="o" :value="o">{{ o }}</option>
      </select>
    </td>
    <td>
      <input v-model.number="dp.acqCycle" class="cycle" type="number" min="100" step="100" :class="{ bad: errors?.acqCycle }" :title="errors?.acqCycle" />
    </td>
    <td>
      <input v-model.number="dp.scale" class="scale" type="number" step="any" :class="{ bad: errors?.scale }" :title="errors?.scale" />
    </td>
    <td><input v-model.trim="dp.units" class="units" /></td>
    <td><button type="button" class="remove" title="Delete register" @click="$emit('remove')">×</button></td>
  </tr>
</template>
