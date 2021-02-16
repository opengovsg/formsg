import Busboy from 'busboy'
import FormData from 'form-data'
import { createReadStream, readFileSync } from 'fs'
import { IncomingHttpHeaders } from 'http'
import { pick } from 'lodash'
import { mocked } from 'ts-jest/utils'

import { MB } from 'src/app/constants/filesize'
import { BasicField } from 'src/types'

import {
  generateNewAttachmentResponse,
  generateNewSingleAnswerResponse,
} from 'tests/unit/backend/helpers/generate-form-data'

import {
  InitialiseMultipartReceiverError,
  MultipartError,
} from '../email-submission.errors'
import * as EmailSubmissionReceiver from '../email-submission.receiver'

jest.mock('busboy')
const MockBusboy = mocked(Busboy, true)
const RealBusboy = jest.requireActual('busboy') as typeof Busboy

const MOCK_HEADERS = { key: 'value' }

const MOCK_BUSBOY_ON = jest.fn().mockReturnThis()
const MOCK_BUSBOY = ({
  on: MOCK_BUSBOY_ON,
} as unknown) as busboy.Busboy

const VALID_FILE_PATH = 'tests/unit/backend/resources/'
const VALID_FILENAME_1 = 'valid.txt'
const VALID_FILE_CONTENT_1 = readFileSync(
  `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
)
const VALID_FILENAME_2 = 'valid2.txt'
const VALID_FILE_CONTENT_2 = readFileSync(
  `${VALID_FILE_PATH}${VALID_FILENAME_2}`,
)

describe('email-submission.receiver', () => {
  describe('createMultipartReceiver', () => {
    it('should call Busboy constructor with the correct params', () => {
      MockBusboy.mockReturnValueOnce(MOCK_BUSBOY)

      const result = EmailSubmissionReceiver.createMultipartReceiver(
        MOCK_HEADERS as IncomingHttpHeaders,
      )

      expect(MockBusboy).toHaveBeenCalledWith({
        headers: MOCK_HEADERS,
        limits: {
          fieldSize: 3 * MB,
          fileSize: 7 * MB,
        },
      })
      expect(result._unsafeUnwrap()).toEqual(MOCK_BUSBOY)
    })

    it('should return error when busboy constructor errors', () => {
      MockBusboy.mockImplementationOnce(() => {
        throw new Error()
      })

      const result = EmailSubmissionReceiver.createMultipartReceiver(
        MOCK_HEADERS as IncomingHttpHeaders,
      )

      expect(MockBusboy).toHaveBeenCalledWith({
        headers: MOCK_HEADERS,
        limits: {
          fieldSize: 3 * MB,
          fileSize: 7 * MB,
        },
      })
      expect(result._unsafeUnwrapErr()).toEqual(
        new InitialiseMultipartReceiverError(),
      )
    })
  })

  describe('configureMultipartReceiver', () => {
    it('should receive a single attachment and add it to the response', async () => {
      const mockResponse = pick(generateNewAttachmentResponse(), [
        '_id',
        'question',
        'answer',
        'fieldType',
      ])
      const mockBody = { responses: [mockResponse] }

      const fileStream = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      form.append(VALID_FILENAME_1, fileStream, mockResponse._id)
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      fileStream.emit('data', VALID_FILE_CONTENT_1)
      fileStream.emit('end')
      form.emit('end')

      const result = await resultPromise
      expect(result._unsafeUnwrap()).toEqual({
        responses: [
          {
            _id: mockResponse._id,
            question: mockResponse.question,
            answer: VALID_FILENAME_1,
            fieldType: mockResponse.fieldType,
            filename: VALID_FILENAME_1,
            content: Buffer.concat([VALID_FILE_CONTENT_1]),
          },
        ],
      })
    })

    it('should receive a mix of attachment and non-attachment responses', async () => {
      const mockAttachment = pick(generateNewAttachmentResponse(), [
        '_id',
        'question',
        'answer',
        'fieldType',
      ])
      const mockTextField = pick(
        generateNewSingleAnswerResponse(BasicField.ShortText),
        ['_id', 'question', 'answer', 'fieldType'],
      )
      const mockBody = { responses: [mockAttachment, mockTextField] }

      const fileStream = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      form.append(VALID_FILENAME_1, fileStream, mockAttachment._id)
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      fileStream.emit('data', VALID_FILE_CONTENT_1)
      fileStream.emit('end')
      form.emit('end')

      const result = await resultPromise
      expect(result._unsafeUnwrap()).toEqual({
        responses: [
          {
            _id: mockAttachment._id,
            question: mockAttachment.question,
            answer: VALID_FILENAME_1,
            fieldType: mockAttachment.fieldType,
            filename: VALID_FILENAME_1,
            content: Buffer.concat([VALID_FILE_CONTENT_1]),
          },
          {
            _id: mockTextField._id,
            question: mockTextField.question,
            answer: mockTextField.answer,
            fieldType: mockTextField.fieldType,
          },
        ],
      })
    })

    it('should receive multiple attachments and add them to responses', async () => {
      const mockResponse1 = pick(
        generateNewAttachmentResponse({
          question: 'Question 1',
          answer: VALID_FILENAME_1,
        }),
        ['_id', 'question', 'answer', 'fieldType'],
      )
      const mockResponse2 = pick(
        generateNewAttachmentResponse({
          question: 'Question 2',
          answer: VALID_FILENAME_2,
        }),
        ['_id', 'question', 'answer', 'fieldType'],
      )
      const mockBody = { responses: [mockResponse1, mockResponse2] }

      const fileStream1 = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const fileStream2 = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_2}`,
      )
      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      form.append(VALID_FILENAME_1, fileStream1, mockResponse1._id)
      form.append(VALID_FILENAME_2, fileStream2, mockResponse2._id)
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      fileStream1.emit('data', VALID_FILE_CONTENT_1)
      fileStream1.emit('end')
      fileStream2.emit('data', VALID_FILE_CONTENT_2)
      fileStream2.emit('end')
      form.emit('end')

      const result = await resultPromise
      expect(result._unsafeUnwrap()).toEqual({
        responses: [
          {
            _id: mockResponse1._id,
            question: mockResponse1.question,
            answer: VALID_FILENAME_1,
            fieldType: mockResponse1.fieldType,
            filename: VALID_FILENAME_1,
            content: Buffer.concat([VALID_FILE_CONTENT_1]),
          },
          {
            _id: mockResponse2._id,
            question: mockResponse2.question,
            answer: VALID_FILENAME_2,
            fieldType: mockResponse2.fieldType,
            filename: VALID_FILENAME_2,
            content: Buffer.concat([VALID_FILE_CONTENT_2]),
          },
        ],
      })
    })

    it('should de-duplicate identical attachment filenames', async () => {
      const mockResponse1 = pick(
        generateNewAttachmentResponse({
          question: 'Question 1',
          answer: VALID_FILENAME_1,
        }),
        ['_id', 'question', 'answer', 'fieldType'],
      )
      const mockResponse2 = pick(
        generateNewAttachmentResponse({
          question: 'Question 2',
          answer: VALID_FILENAME_2,
        }),
        ['_id', 'question', 'answer', 'fieldType'],
      )
      const mockBody = { responses: [mockResponse1, mockResponse2] }

      const fileStream1 = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const fileStream2 = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      form.append(VALID_FILENAME_1, fileStream1, mockResponse1._id)
      form.append(VALID_FILENAME_1, fileStream2, mockResponse2._id)
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      fileStream1.emit('data', VALID_FILE_CONTENT_1)
      fileStream1.emit('end')
      fileStream2.emit('data', VALID_FILE_CONTENT_1)
      fileStream2.emit('end')
      form.emit('end')

      const result = await resultPromise
      expect(result._unsafeUnwrap()).toEqual({
        responses: [
          {
            _id: mockResponse1._id,
            question: mockResponse1.question,
            answer: `1-${VALID_FILENAME_1}`,
            fieldType: mockResponse1.fieldType,
            filename: `1-${VALID_FILENAME_1}`,
            content: Buffer.concat([VALID_FILE_CONTENT_1]),
          },
          {
            _id: mockResponse2._id,
            question: mockResponse2.question,
            answer: VALID_FILENAME_1,
            fieldType: mockResponse2.fieldType,
            filename: VALID_FILENAME_1,
            content: Buffer.concat([VALID_FILE_CONTENT_1]),
          },
        ],
      })
    })

    it('should return MultipartError when file limit is reached', async () => {
      const mockResponse = pick(generateNewAttachmentResponse(), [
        '_id',
        'question',
        'answer',
        'fieldType',
      ])
      const mockBody = { responses: [mockResponse] }

      const fileStream = createReadStream(
        `${VALID_FILE_PATH}${VALID_FILENAME_1}`,
      )
      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      form.append(VALID_FILENAME_1, fileStream, mockResponse._id)
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        limits: {
          fieldSize: 3 * MB,
          fileSize: 7 * MB,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      fileStream.emit('data', Buffer.alloc(7 * MB + 1))

      const result = await resultPromise
      expect(result._unsafeUnwrapErr()).toEqual(new MultipartError())
    })

    it('should return MultipartError when error event is emitted', async () => {
      const mockBody = { responses: [] }

      const form = new FormData()
      form.append('body', JSON.stringify(mockBody))
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)

      realBusboy.emit('error', new Error())

      const result = await resultPromise
      expect(result._unsafeUnwrapErr()).toEqual(new MultipartError())
    })

    it('should return MultipartError when body cannot be parsed', async () => {
      const form = new FormData()
      form.append('body', 'invalid')
      const realBusboy = new RealBusboy({
        headers: {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
      })
      const resultPromise = EmailSubmissionReceiver.configureMultipartReceiver(
        realBusboy,
      )
      form.pipe(realBusboy)
      form.emit('end')

      const result = await resultPromise
      expect(result._unsafeUnwrapErr()).toEqual(new MultipartError())
    })
  })
})
