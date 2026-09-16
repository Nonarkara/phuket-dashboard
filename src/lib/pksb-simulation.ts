/**
 * PKSB Bus Simulation Engine
 *
 * Simulates bus movement along Phuket Smart Bus routes using real
 * timetable data and exact route polylines from the Smart Bus subcodebase.
 */

import { calculateSmartBusPositions } from "./smart-bus-engine";
import type { PksbBusPosition } from "../types/dashboard";

export type SimulatedBus = PksbBusPosition;

export function simulateBusPositions(nowDate?: Date): PksbBusPosition[] {
  return calculateSmartBusPositions(nowDate);
}
