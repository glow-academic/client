/**
 * Utility functions for simulation time-based completion detection
 */

export interface SimulationTimeData {
  attemptCreatedAt: string;
  simulationTimeLimit: number | null; // in minutes
}

/**
 * Determines if a simulation attempt is incomplete due to time running out
 * @param timeData - Object containing attempt creation time and simulation time limit
 * @returns false - we no longer mark simulations as timed out since users can continue with negative timer
 */
export function isSimulationTimedOut(_timeData: SimulationTimeData): boolean {
  // Never mark as timed out - allow users to continue with negative timer
  return false;
}

/**
 * Determines if a simulation attempt is still within the time limit
 * @param timeData - Object containing attempt creation time and simulation time limit
 * @returns true if the simulation is still within time limit, false if timed out or no time limit
 */
export function isSimulationWithinTimeLimit(
  timeData: SimulationTimeData
): boolean {
  const { attemptCreatedAt, simulationTimeLimit } = timeData;

  // If no time limit, it's always within time limit
  if (!simulationTimeLimit || simulationTimeLimit <= 0) {
    return true;
  }

  const attemptStartTime = new Date(attemptCreatedAt);
  const currentTime = new Date();
  const elapsedMinutes =
    (currentTime.getTime() - attemptStartTime.getTime()) / (1000 * 60);

  // Check if less time has elapsed than the time limit
  return elapsedMinutes <= simulationTimeLimit;
}

/**
 * Gets the remaining time for a simulation attempt in minutes
 * @param timeData - Object containing attempt creation time and simulation time limit
 * @returns remaining time in minutes, or null if no time limit
 */
export function getRemainingTime(timeData: SimulationTimeData): number | null {
  const { attemptCreatedAt, simulationTimeLimit } = timeData;

  if (!simulationTimeLimit || simulationTimeLimit <= 0) {
    return null;
  }

  const attemptStartTime = new Date(attemptCreatedAt);
  const currentTime = new Date();
  const elapsedMinutes =
    (currentTime.getTime() - attemptStartTime.getTime()) / (1000 * 60);
  const remainingMinutes = simulationTimeLimit - elapsedMinutes;

  return Math.floor(remainingMinutes);
}
