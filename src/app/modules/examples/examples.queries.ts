import mongoose from 'mongoose'

import { Status } from '../../../types'

/**
 * Precondition: Must be called as the **first** step in the aggregation
 * pipeline (requirement for MongoDB match text).
 *
 * Aggregation step to retrieve `_id` and `formInfo` of forms that contain words
 * that match given search term.
 * @param searchTerm The word that must appear in the form to be retrieved.
 * @returns aggregate step to search forms with text
 */
export const searchFormsWithText = (
  searchTerm: string,
): Record<string, unknown>[] => [
  {
    $match: {
      $text: { $search: searchTerm },
    },
  },
  {
    $project: {
      formInfo: '$$ROOT',
    },
  },
]

/**
 * Produces an aggregation step to retrieve form with the specified formId.
 * @param formId The _id field of the form to be retrieved
 */
export const searchFormsById = (formId: string): Record<string, unknown>[] => [
  {
    $match: {
      _id: mongoose.Types.ObjectId(formId),
    },
  },
  {
    $project: {
      formInfo: '$$ROOT',
    },
  },
]

/**
 * Precondition: `formInfo` must be retrieved beforehand, which can be done with
 * lookupFormInfo or searchFormsWithText.
 *
 * Aggregation step to only allow public and listed forms to pass to the next
 * step in the pipeline.
 */
export const filterInactiveAndUnlistedForms: Record<string, unknown>[] = [
  {
    $match: {
      'formInfo.status': Status.Public,
      'formInfo.isListed': true,
    },
  },
]

/**
 * Aggregation step to retrieve `agencyInfo` from agencies collection for each
 * form's admin agency data.
 */
export const lookupAgencyInfo: Record<string, unknown>[] = [
  {
    $lookup: {
      from: 'users',
      localField: 'formInfo.admin',
      foreignField: '_id',
      as: 'userInfo',
    },
  },
  // There should only be one user with this _id
  {
    $unwind: '$userInfo',
  },
  {
    $lookup: {
      from: 'agencies',
      localField: 'userInfo.agency',
      foreignField: '_id',
      as: 'agencyInfo',
    },
  },
  // There should only be one agency with this _id
  {
    $unwind: '$agencyInfo',
  },
  {
    $project: {
      userInfo: 0,
    },
  },
]

/**
 * Precondition: `agencyInfo` must be retrieved beforehand, which can be done
 * with lookupAgencyInfo.
 *
 * Aggregation step to only allow forms from a specific agency from passing.
 * @returns aggregate step to filter pipeline by given agency id
 */
export const filterByAgencyId = (
  agencyId: string,
): Record<string, unknown>[] => [
  {
    $match: {
      'agencyInfo._id': mongoose.Types.ObjectId(agencyId),
    },
  },
]

/**
 * Precondition: A group stage that produced a count field must be executed
 * beforehand, which can be done with lookupSubmissionInfo.

 * Aggregation step to filter forms with less than the minimum number of
 * submissions for the examples page. 
 * 
 * @param minSubmissionCount The minimum submission count of each form to allow past this aggragate step
  * @returns aggregate step to return submissions with at least minSubmissionCount
 */
export const filterBySubmissionCount = (
  minSubmissionCount: number,
): Record<string, unknown>[] => [
  {
    $match: {
      count: {
        $gt: minSubmissionCount,
      },
    },
  },
]

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
 * Precondition: `lastSubmission` field must have been generated beforehand,
 * which can be done using `groupSubmissionsByFormId`.
 *
 * Aggregation step to sort forms by the last submitted date.
 */
export const sortByLastSubmitted: Record<string, unknown>[] = [
  {
    $sort: { lastSubmission: -1 },
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
 * Precondition: `_id` field corresponding to the forms' ids must be retrieved
 * beforehand, which can be done by grouping submissions using
 * groupSubmissionsByFormId.
 *
 * Aggregation step to retrieve `formInfo` from the forms collection for each
 * form's form id.
 */
export const lookupFormInfo: Record<string, unknown>[] = [
  {
    $lookup: {
      from: 'forms',
      localField: '_id',
      foreignField: '_id',
      as: 'formInfo',
    },
  },
  // There should only be one form with this _id
  {
    $unwind: '$formInfo',
  },
]

/**
 * Precondition: `_id` field corresponding to the forms' ids must be retrieved
 * beforehand, which can be done using groupSubmissionsByFormId or
 * searchFormsForText.
 *
 * Aggregation step to retrieve `submissionInfo` by looking up, sorting and
 * grouping submissions with the form ids specified.
 */
export const lookupFormStatisticsInfo: Record<string, unknown>[] = [
  {
    $lookup: {
      from: 'formStatisticsTotal',
      localField: '_id',
      foreignField: 'formId',
      as: 'submissionInfo',
    },
  },
  // Unwind results in multiple copies of each form, where each copy has its own
  // submissionInfo.
  {
    $unwind: '$submissionInfo',
  },
  {
    $project: {
      _id: '$_id',
      count: '$submissionInfo.totalCount',
      formInfo: 1,
      agencyInfo: 1,
      lastSubmission: '$submissionInfo.lastSubmission',
      textScore: { $meta: 'textScore' }, // Used to sort by relevance
    },
  },
]

/**
 * Precondition: `_id` field corresponding to forms' ids must be retrieved
 * beforehand.
 *
 * !Note: Can only used on pipelines working with the FormStatisticsTotal collection.
 *
 * Aggregation step to project submissions by form id, get submission count, and
 * get the last submission date.
 */
export const projectSubmissionInfo: Record<string, unknown>[] = [
  {
    $project: {
      _id: '$formId',
      count: '$totalCount',
      lastSubmission: 1,
    },
  },
]

/**
 * Precondition: `formFeedbackInfo` must have been retrieved in a previous step,
 * which can be done using lookupFormFeedback.
 *
 * Aggregation step to project submissions by form id, get submission count, get
 * the last submission date, along with the average feedback of the submissions.
 */
export const projectAvgFeedback: Record<string, unknown>[] = [
  {
    $project: {
      _id: '$formId',
      count: 1,
      lastSubmission: 1,
      avgFeedback: { $avg: '$formFeedbackInfo.rating' },
    },
  },
]

/**
 * Precondition: `formInfo` must be retrieved beforehand, which can be done with
 * lookupFormInfo, searchFormsWithText or searchFormsById.
 *
 * Aggregation step to project form information without submission/feedback
 * information.
 */
export const projectFormDetails: Record<string, unknown>[] = [
  {
    $project: {
      _id: 1,
      title: '$formInfo.title',
      form_fields: '$formInfo.form_fields',
      logo: '$agencyInfo.logo',
      agency: '$agencyInfo.shortName',
      colorTheme: '$formInfo.startPage.colorTheme',
      authType: '$formInfo.authType',
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
      authType: '$formInfo.authType',
    },
  },
]

/**
 * Produces an aggregation step to retrieve submissions for the form with the
 * specified formId.
 *
 * If this aggregation step is used by the Submission collection, the key value
 * would be `form`. \
 * If used with the FormStatisticsTotal collection, the key
 * value would be `formId`. See ISubmissionSchema['form'] and
 * IFormStatisticsTotal['formId'].
 *
 * @param key The key of the formId to be retrieved from.
 * @param formId The _id field of the form to be retrieved
 */
export const searchSubmissionsForForm = (
  key: 'form' | 'formId',
  formId: string,
): Record<string, unknown>[] => [
  {
    $match: {
      [key]: mongoose.Types.ObjectId(formId),
    },
  },
]
