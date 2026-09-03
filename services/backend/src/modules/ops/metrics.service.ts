import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';

/**
 * Prometheus metrics registry (spec §70). Collects default process/runtime
 * metrics; business counters/histograms can be registered here as modules grow.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  constructor() {
    this.registry.setDefaultLabels({ app: 'mystore-backend' });
    collectDefaultMetrics({ register: this.registry });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
