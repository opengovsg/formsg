import { decode as decodeBase64 } from '@stablelib/base64'
import axios from 'axios'
import JSZip from 'jszip'

import { EncryptedSubmissionDto, SubmissionMetadataList } from 'src/types'
import {
  SubmissionCountQueryDto,
  SubmissionMetadataQueryDto,
  SubmissionResponseQueryDto,
} from 'src/types/api'

import formSgSdk from '../services/FormSgSdk'

import { ADMIN_FORM_ENDPOINT } from './AdminFormService'

/**
 * Counts the number of submissions for a given form
 * @param urlParameters Mapping of the url parameters to values
 * @returns The number of form submissions
 */
export const countFormSubmissions = async ({
  formId,
  startDate,
  endDate,
}: SubmissionCountQueryDto): Promise<number> => {
  const queryUrl = `${ADMIN_FORM_ENDPOINT}/${formId}/submissions/count`
  if (startDate && endDate) {
    return axios
      .get(queryUrl, {
        params: { startDate, endDate },
      })
      .then(({ data }) => data)
  }
  return axios.get(queryUrl).then(({ data }) => data)
}

/**
 * Retrieves the metadata for either a page of submission or a single submissionId if submissionId is specified
 * @param formId The id of the form to retrieve submission for
 * @param submissionId The id of the specified submission to retrieve
 * @param pageNum The page number of the responses
 * @returns The metadata of the form
 */
export const getFormsMetadata = async ({
  formId,
  submissionId,
  pageNum,
}: SubmissionMetadataQueryDto): Promise<SubmissionMetadataList> => {
  const params = submissionId ? { submissionId } : { page: pageNum }

  return axios
    .get(`${ADMIN_FORM_ENDPOINT}/${formId}/submissions/metadata`, {
      params,
    })
    .then(({ data }) => data)
}

/**
 * Returns the data of a single submission of a given storage mode form
 * @param formId The id of the form to query
 * @param submissionId The id of the submission
 * @returns The data of the submission
 */
export const getEncryptedResponse = ({
  formId,
  submissionId,
}: SubmissionResponseQueryDto): Promise<EncryptedSubmissionDto> => {
  return axios
    .get(`${ADMIN_FORM_ENDPOINT}/${formId}/submissions/${submissionId}`)
    .then(({ data }) => data)
}

/**
 * Triggers a download of a set of attachments as a zip file when given attachment metadata and a secret key
 * @param {Map} attachmentDownloadUrls Map of question number to individual attachment metadata (object with url and filename properties)
 * @param {String} secretKey An instance of EncryptionKey for decrypting the attachment
 * @returns {Promise} A Promise containing the contents of the ZIP file as a blob
 */
export const downloadAndDecryptAttachmentsAsZip = async (
  attachmentDownloadUrls: Map<number, { url: string; filename: string }>,
  secretKey: string,
): Promise<Blob> => {
  const zip = new JSZip()
  const downloadPromises = Array.from(attachmentDownloadUrls).map(
    async ([questionNum, { url, filename }]) => {
      const bytesArray = await downloadAndDecryptAttachment(url, secretKey)
      const fileName = `Question ${questionNum} - ${filename}`
      return zip.file(fileName, bytesArray || [])
    },
  )

  return Promise.all(downloadPromises).then(() => {
    return zip.generateAsync({ type: 'blob' })
  })
}

/**
 * Triggers a download of a single attachment when given an S3 presigned url and a secretKey
 * @param {String} url URL pointing to the location of the encrypted attachment
 * @param {String} secretKey An instance of EncryptionKey for decrypting the attachment
 * @returns {Promise} A Promise containing the contents of the file as a Blob
 */
const downloadAndDecryptAttachment = (url: string, secretKey: string) => {
  return axios.get(url).then(({ data }) => {
    data.encryptedFile.binary = decodeBase64(data.encryptedFile.binary)
    return formSgSdk.crypto.decryptFile(secretKey, data.encryptedFile)
  })
}