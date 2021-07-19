import axios from 'axios'

import { AnalyticStatsDto } from '../../../shared/types/analytics'

/**
 * Retrieves landing page statistics - user, form and submission count.
 */
export const getLandingPageStatistics = async (): Promise<AnalyticStatsDto> =>
  axios
    .get<AnalyticStatsDto>('/api/v3/analytics/statistics')
    .then((response) => response.data)
