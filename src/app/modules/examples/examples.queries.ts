/**
 * Precondition: A match by text was called earlier, which can be done with
 * searchFormsWithText.
 *
 * Aggregation step to sort forms by their textScore relevance; i.e. how well
 * the search terms were matched.
 */
export const sortByRelevance: Record<string, unknown>[] = [
  {
    $sort: {
      textScore: -1,
    },
  },
]

/**
 * Aggregation step to produce an object containing the pageResults and
 * totalCount.
 * pageResults will only contain condensed information to be displayed on an
 * example card.
 * @param limit Number of forms to return information about.
 * @param offset Number of forms that have already been returned previously and should be skipped in this query.
 */
export const selectAndProjectCardInfo = (
  limit: number,
  offset: number,
): Record<string, unknown>[] => [
  {
    $skip: offset,
  },
  {
    $limit: limit,
  },
  {
    $project: {
      _id: 1,
      count: 1,
      lastSubmission: 1,
      title: '$formInfo.title',
      form_fields: '$formInfo.form_fields',
      logo: '$agencyInfo.logo',
      agency: '$agencyInfo.shortName',
      colorTheme: '$formInfo.startPage.colorTheme',
      avgFeedback: { $avg: '$formFeedbackInfo.rating' },
    },
  },
]
