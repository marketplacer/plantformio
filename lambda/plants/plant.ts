export interface Plant {
  /** Plant name */
  name: string
  threshold: {
    /** Minimum value to be considered wet enough */
    value: number;
    /** Number of hours where the readings need to be below `value` before alerting */
    hours: number;
  }
}
