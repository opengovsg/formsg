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
 * Precondition: `created` field must have already been retrieved from the
 * submissions collection via searchSubmissionsForForm.
 *
 * Aggregation step to sort forms by the creation date.
 */
export const sortByCreated = [
  {
    $sort: { 'formInfo.created': -1 },
  },
]

/**
 * Precondition: `_id` field corresponding to the forms' ids must be retrieved
 * beforehand, which can be done using groupSubmissionsByFormId or
 * searchFormsForText.
 *
 * Aggregation step to retrieve `formFeedbackInfo` from the formfeedback
 * collection for each of the `formId`s specified.
 */
export const lookupFormFeedback: Record<string, unknown>[] = [
  {
    $lookup: {
      from: 'formfeedback',
      localField: '_id',
      foreignField: 'formId',
      as: 'formFeedbackInfo',
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

/**
 * Precondition: `formFeedbackInfo` must have been retrieved in a previous step,
 * which can be done using lookupFormFeedback.
 *
 * Aggregation step to replace the array of feedback info with its average.
 */
export const replaceFeedbackWithAvg = [
  {
    $addFields: {
      avgFeedback: {
        $avg: '$formFeedbackInfo.rating',
      },
    },
  },
  {
    $project: {
      agency: 1,
      avgFeedback: 1,
      colorTheme: 1,
      form_fields: 1,
      logo: 1,
      title: 1,
    },
  },
]
