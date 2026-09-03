import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/**
 * Opt a route OUT of the standard success envelope — for endpoints that must
 * return raw payloads (e.g. Prometheus `/metrics`, file streams).
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
