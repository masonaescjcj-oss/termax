/** Strategy engine — public surface. See docs/ai-architecture.md §1. */
export * from './types';
export { validateSpec, SpecError, ValidationResult, MAX_LOOKBACK_BARS } from './validate';
export { compileStrategy, CompiledStrategy } from './interpreter';
export { BarSeries, BarAggregator, bucketStart } from './series';
export { createIndicator, indicatorKey, sourceValue, Incr, Ring } from './indicators';
