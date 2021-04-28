import { PresignedPost } from 'aws-sdk/clients/s3'
import { ObjectId } from 'bson-ext'
import { StatusCodes } from 'http-status-codes'
import { assignIn, cloneDeep, merge, pick } from 'lodash'
import { err, errAsync, ok, okAsync, Result } from 'neverthrow'
import { PassThrough } from 'stream'
import { MockedObject } from 'ts-jest/dist/utils/testing'
import { mocked } from 'ts-jest/utils'

import * as AuthService from 'src/app/modules/auth/auth.service'
import {
  DatabaseConflictError,
  DatabaseError,
  DatabasePayloadSizeError,
  DatabaseValidationError,
} from 'src/app/modules/core/core.errors'
import * as FeedbackService from 'src/app/modules/feedback/feedback.service'
import { FeedbackResponse } from 'src/app/modules/feedback/feedback.types'
import {
  AttachmentTooLargeError,
  InvalidFileExtensionError,
} from 'src/app/modules/submission/email-submission/email-submission.errors'
import * as EmailSubmissionService from 'src/app/modules/submission/email-submission/email-submission.service'
import * as EmailSubmissionUtil from 'src/app/modules/submission/email-submission/email-submission.util'
import * as EncryptSubmissionService from 'src/app/modules/submission/encrypt-submission/encrypt-submission.service'
import {
  ConflictError,
  InvalidEncodingError,
  ProcessingError,
  ResponseModeError,
  SendEmailConfirmationError,
  ValidateFieldError,
} from 'src/app/modules/submission/submission.errors'
import * as SubmissionService from 'src/app/modules/submission/submission.service'
import { MissingUserError } from 'src/app/modules/user/user.errors'
import {
  MailGenerationError,
  MailSendError,
} from 'src/app/services/mail/mail.errors'
import MailService from 'src/app/services/mail/mail.service'
import * as EncryptionUtils from 'src/app/utils/encryption'
import { EditFieldActions } from 'src/shared/constants'
import {
  AuthType,
  BasicField,
  FormMetaView,
  FormSettings,
  IEmailSubmissionSchema,
  IEncryptedSubmissionSchema,
  IFieldSchema,
  IForm,
  IFormSchema,
  ILogicSchema,
  IPopulatedEmailForm,
  IPopulatedEncryptedForm,
  IPopulatedForm,
  IPopulatedUser,
  IUserSchema,
  PublicForm,
  ResponseMode,
  Status,
} from 'src/types'
import {
  EncryptSubmissionDto,
  FieldCreateDto,
  FieldUpdateDto,
} from 'src/types/api'

import {
  generateDefaultField,
  generateNewSingleAnswerResponse,
  generateUnprocessedSingleAnswerResponse,
} from 'tests/unit/backend/helpers/generate-form-data'
import expressHandler from 'tests/unit/backend/helpers/jest-express'

import * as UserService from '../../../user/user.service'
import {
  ForbiddenFormError,
  FormDeletedError,
  FormNotFoundError,
  LogicNotFoundError,
  PrivateFormError,
  TransferOwnershipError,
} from '../../form.errors'
import * as FormService from '../../form.service'
import * as AdminFormController from '../admin-form.controller'
import {
  CreatePresignedUrlError,
  EditFieldError,
  FieldNotFoundError,
  InvalidFileTypeError,
} from '../admin-form.errors'
import * as AdminFormService from '../admin-form.service'
import {
  DuplicateFormBody,
  EditFormFieldParams,
  PermissionLevel,
} from '../admin-form.types'

jest.mock('src/app/modules/auth/auth.service')
const MockAuthService = mocked(AuthService)
jest.mock('src/app/modules/feedback/feedback.service')
const MockFeedbackService = mocked(FeedbackService)
jest.mock('src/app/modules/submission/submission.service')
const MockSubmissionService = mocked(SubmissionService)
jest.mock(
  'src/app/modules/submission/encrypt-submission/encrypt-submission.service',
)
const MockEncryptSubmissionService = mocked(EncryptSubmissionService)
jest.mock(
  'src/app/modules/submission/email-submission/email-submission.service',
)
const MockEmailSubmissionService = mocked(EmailSubmissionService)
jest.mock('src/app/utils/encryption')
const MockEncryptionUtils = mocked(EncryptionUtils)
jest.mock('../admin-form.service')
const MockAdminFormService = mocked(AdminFormService)
jest.mock('../../form.service')
const MockFormService = mocked(FormService)
jest.mock('../../../user/user.service')
const MockUserService = mocked(UserService)
jest.mock('src/app/services/mail/mail.service')
const MockMailService = mocked(MailService)

describe('admin-form.controller', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('handleListDashboardForms', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      session: {
        user: {
          _id: 'exists',
        },
      },
    })
    it('should return 200 with list of forms', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock return array.
      MockAdminFormService.getDashboardForms.mockReturnValueOnce(okAsync([]))

      // Act
      await AdminFormController.handleListDashboardForms(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith([])
    })

    it('should return 422 on MissingUserError', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.getDashboardForms.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )

      // Act
      await AdminFormController.handleListDashboardForms(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(422)
      expect(mockRes.json).toBeCalledWith({ message: 'User not found' })
    })

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'something went wrong'
      MockAdminFormService.getDashboardForms.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleListDashboardForms(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(500)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
    })
  })

  describe('createForm', () => {
    const MOCK_USER_ID = new ObjectId()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IUserSchema
    const MOCK_FORM = {
      admin: MOCK_USER_ID,
      _id: new ObjectId(),
      title: 'mock title',
    } as IFormSchema
    const MOCK_FORM_PARAMS: Omit<IForm, 'admin'> = {
      responseMode: ResponseMode.Encrypt,
      publicKey: 'some public key',
      title: 'some form title',
    }
    const MOCK_REQ = expressHandler.mockRequest({
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      body: {
        form: MOCK_FORM_PARAMS,
      },
    })

    it('should return 200 with created form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(okAsync(MOCK_USER))
      MockAdminFormService.createForm.mockReturnValueOnce(okAsync(MOCK_FORM))

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).toHaveBeenCalledWith({
        ...MOCK_FORM_PARAMS,
        admin: MOCK_USER._id,
      })
    })

    it('should return 409 on DatabaseConflictError', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(okAsync(MOCK_USER))
      const mockErrorString = 'conflict conflict'
      MockAdminFormService.createForm.mockReturnValueOnce(
        errAsync(new DatabaseConflictError(mockErrorString)),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(409)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).toHaveBeenCalledWith({
        ...MOCK_FORM_PARAMS,
        admin: MOCK_USER._id,
      })
    })

    it('should return 413 on DatabasePayloadSizeError', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(okAsync(MOCK_USER))
      const mockErrorString = 'size exceeds limit'
      MockAdminFormService.createForm.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(mockErrorString)),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(413)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).toHaveBeenCalledWith({
        ...MOCK_FORM_PARAMS,
        admin: MOCK_USER._id,
      })
    })

    it('should return 422 on DatabaseValidationError', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(okAsync(MOCK_USER))
      const mockErrorString = 'invalid form'
      MockAdminFormService.createForm.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(mockErrorString)),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(422)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).toHaveBeenCalledWith({
        ...MOCK_FORM_PARAMS,
        admin: MOCK_USER._id,
      })
    })

    it('should return 422 on MissingUserError', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(422)
      expect(mockRes.json).toBeCalledWith({ message: 'User not found' })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs during form creation', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(okAsync(MOCK_USER))
      const mockErrorString = 'something went wrong'
      MockAdminFormService.createForm.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(500)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).toHaveBeenCalledWith({
        ...MOCK_FORM_PARAMS,
        admin: MOCK_USER._id,
      })
    })

    it('should return 500 when database error occurs during user retrieval', async () => {
      // Arrange
      const mockErrorString = 'db ded'
      const mockRes = expressHandler.mockResponse()
      MockUserService.findUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.createForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toBeCalledWith(500)
      expect(mockRes.json).toBeCalledWith({ message: mockErrorString })
      expect(MockUserService.findUserById).toHaveBeenCalledWith(
        MOCK_REQ.session?.user?._id,
      )
      expect(MockAdminFormService.createForm).not.toHaveBeenCalled()
    })
  })

  describe('handleGetAdminForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with queried admin form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({ form: MOCK_FORM })
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const expectedErrorString = 'no read access'

      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving populated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('handlePreviewAdminForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'randomrandomtest@example.com',
    } as IPopulatedUser

    const MOCK_SCRUBBED_FORM = ({
      _id: MOCK_FORM_ID,
      title: 'mock preview title',
      admin: { _id: MOCK_USER_ID },
    } as unknown) as PublicForm

    const MOCK_FORM = (mocked({
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: MOCK_SCRUBBED_FORM.title,
      getPublicView: jest.fn().mockResolvedValue(MOCK_SCRUBBED_FORM),
    }) as unknown) as MockedObject<IPopulatedForm>

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    beforeEach(() => MOCK_FORM.getPublicView.mockClear())

    it('should return 200 with preview form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MOCK_FORM.getPublicView).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({ form: MOCK_SCRUBBED_FORM })
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const expectedErrorString = 'no read access'

      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving populated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handlePreviewAdminForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MOCK_FORM.getPublicView).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('createPresignedPostUrlForImages', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm
    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      body: {
        fileId: 'any file id',
        fileMd5Hash: 'any hash',
        fileType: 'any type',
      },
    })

    it('should return 200 with presigned POST URL object when successful', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      const expectedPresignedPost: PresignedPost = {
        fields: {
          'X-Amz-Signature': 'some-amz-signature',
          Policy: 'some policy',
        },
        url: 'some url',
      }
      MockAdminFormService.createPresignedPostUrlForImages.mockReturnValueOnce(
        okAsync(expectedPresignedPost),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(expectedPresignedPost)
    })

    it('should return 400 when InvalidFileTypeError is returned when creating presigned POST URL', async () => {
      // Arrange
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      // Mock error
      const mockErrorString = 'bad file type, bad!'
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.createPresignedPostUrlForImages.mockReturnValueOnce(
        errAsync(new InvalidFileTypeError(mockErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
    })

    it('should return 400 when CreatePresignedUrlError is returned when creating presigned POST URL', async () => {
      // Arrange
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      // Mock error
      const mockErrorString = 'creating presigned post url failed, oh no'
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.createPresignedPostUrlForImages.mockReturnValueOnce(
        errAsync(new CreatePresignedUrlError(mockErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
    })

    it('should return 403 when user does not have write permissions to form', async () => {
      // Arrange
      const expectedErrorString = 'no write permissions'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForImages,
      ).not.toHaveBeenCalled()
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const expectedErrorString = 'no form found'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForImages,
      ).not.toHaveBeenCalled()
    })

    it('should return 410 when form is archived', async () => {
      // Arrange
      const expectedErrorString = 'form deleted'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForImages,
      ).not.toHaveBeenCalled()
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForImages(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(AuthService.getFormAfterPermissionChecks).not.toHaveBeenCalled()
      expect(
        MockAdminFormService.createPresignedPostUrlForImages,
      ).not.toHaveBeenCalled()
    })
  })

  describe('createPresignedPostUrlForLogos', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm
    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      body: {
        fileId: 'any file id',
        fileMd5Hash: 'any hash',
        fileType: 'any type',
      },
    })

    it('should return 200 with presigned POST URL object when successful', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      const expectedPresignedPost: PresignedPost = {
        fields: {
          'X-Amz-Signature': 'some-amz-signature',
          Policy: 'some policy',
        },
        url: 'some url',
      }
      MockAdminFormService.createPresignedPostUrlForLogos.mockReturnValueOnce(
        okAsync(expectedPresignedPost),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(expectedPresignedPost)
    })

    it('should return 400 when InvalidFileTypeError is returned when creating presigned POST URL', async () => {
      // Arrange
      // Mock error
      const mockErrorString = 'bad file type, bad!'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.createPresignedPostUrlForLogos.mockReturnValueOnce(
        errAsync(new InvalidFileTypeError(mockErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
    })

    it('should return 400 when CreatePresignedUrlError is returned when creating presigned POST URL', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock error
      const mockErrorString = 'creating presigned post url failed, oh no'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.createPresignedPostUrlForLogos.mockReturnValueOnce(
        errAsync(new CreatePresignedUrlError(mockErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
    })

    it('should return 403 when user does not have write permissions to form', async () => {
      // Arrange
      const expectedErrorString = 'no write permissions'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForLogos,
      ).not.toHaveBeenCalled()
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const expectedErrorString = 'no form found'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForLogos,
      ).not.toHaveBeenCalled()
    })

    it('should return 410 when form is archived', async () => {
      // Arrange
      const expectedErrorString = 'form deleted'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAdminFormService.createPresignedPostUrlForLogos,
      ).not.toHaveBeenCalled()
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.createPresignedPostUrlForLogos(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(AuthService.getFormAfterPermissionChecks).not.toHaveBeenCalled()
      expect(
        MockAdminFormService.createPresignedPostUrlForLogos,
      ).not.toHaveBeenCalled()
    })
  })

  describe('countFormSubmissions', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER as IPopulatedUser,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with submission counts of given form when query params are not provided', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock return count.
      const expectedSubmissionCount = 201
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      MockSubmissionService.getFormSubmissionsCount.mockReturnValueOnce(
        okAsync(expectedSubmissionCount),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).toHaveBeenCalledWith(String(MOCK_FORM._id), {
        startDate: undefined,
        endDate: undefined,
      })
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(expectedSubmissionCount)
    })

    it('should return 200 with submission counts of given form when query params are provided', async () => {
      // Arrange
      const expectedDateRange = {
        startDate: '2020-01-01',
        endDate: '2021-01-01',
      }

      const mockReqWithQuery = merge({}, MOCK_REQ, { query: expectedDateRange })
      const mockRes = expressHandler.mockResponse()
      // Mock return count.
      const expectedSubmissionCount = 12
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      MockSubmissionService.getFormSubmissionsCount.mockReturnValueOnce(
        okAsync(expectedSubmissionCount),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        mockReqWithQuery,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).toHaveBeenCalledWith(String(MOCK_FORM._id), expectedDateRange)
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(expectedSubmissionCount)
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const expectedErrorString = 'no read access'

      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving populated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving form submission count', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      const expectedErrorString = 'database goes boom'
      MockSubmissionService.getFormSubmissionsCount.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.countFormSubmissions(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockSubmissionService.getFormSubmissionsCount,
      ).toHaveBeenCalledWith(String(MOCK_FORM._id), {
        startDate: undefined,
        endDate: undefined,
      })
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('handleCountFormFeedback', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER as IPopulatedUser,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with feedback counts of given form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock return count.
      const expectedFeedbackCount = 53
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      MockFeedbackService.getFormFeedbackCount.mockReturnValueOnce(
        okAsync(expectedFeedbackCount),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).toHaveBeenCalledWith(
        String(MOCK_FORM._id),
      )
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(expectedFeedbackCount)
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      const expectedErrorString = 'no read access'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving populated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving form feedback count', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      const expectedErrorString = 'database goes boom'
      MockFeedbackService.getFormFeedbackCount.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleCountFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackCount).toHaveBeenCalledWith(
        String(MOCK_FORM._id),
      )
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('handleStreamFormFeedback', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER as IPopulatedUser,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with feedback stream of given form', async () => {
      // Not sure how to really test the stream in Jest, testing to assert that
      // the correct services are being called instead.
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      // Mock cursor return.
      const mockCursor = new PassThrough()
      MockFeedbackService.getFormFeedbackStream.mockReturnValueOnce(
        mockCursor as any,
      )
      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackStream).toHaveBeenCalledWith(
        String(MOCK_FORM._id),
      )
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      const expectedErrorString = 'no read access'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving populated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleStreamFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbackStream).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('handleGetFormFeedback', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'yetanothertest@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER as IPopulatedUser,
      _id: MOCK_FORM_ID,
      title: 'mock title again',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with feedback response successfully', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const expectedFormFeedback: FeedbackResponse = {
        count: 212,
        feedback: [
          {
            comment: 'test feedback',
            rating: 5,
            date: 'some date',
            dateShort: 'some short date',
            index: 1,
            timestamp: Date.now(),
          },
        ],
        average: '5.00',
      }
      // Mock success on all service invocations.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockFeedbackService.getFormFeedbacks.mockReturnValueOnce(
        okAsync(expectedFormFeedback),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(expectedFormFeedback)
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
    })

    it('should return 403 when user does not have permissions to access form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      const mockErrorString = 'not allowed'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      const mockErrorString = 'not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 410 when form is archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      const mockErrorString = 'form gone'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 422 when user in session does not exist in database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'user gone'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db gone'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      const mockErrorString = 'db error'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving form feedback', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock success on all service invocations.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      const mockErrorString = 'db boom'
      MockFeedbackService.getFormFeedbacks.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleGetFormFeedback(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(MockFeedbackService.getFormFeedbacks).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
    })
  })

  describe('handleArchiveForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'another@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER as IPopulatedUser,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with archived form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      MockAdminFormService.archiveForm.mockReturnValueOnce(okAsync(true))

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).toHaveBeenCalledWith(MOCK_FORM)
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form has been archived',
      })
    })

    it('should return 403 when ForbiddenFormError is returned when verifying user permissions', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      const expectedErrorString = 'no archive access'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 422 when MissingUserError is returned when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'user is not found'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving user in session', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      const expectedErrorString = 'database goes boom'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving form after checking permissions', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      // Mock error when retrieving form.
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst archiving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER as IPopulatedUser),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM as IPopulatedForm),
      )
      const expectedErrorString = 'database goes boom'
      MockAdminFormService.archiveForm.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleArchiveForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.archiveForm).toHaveBeenCalledWith(MOCK_FORM)
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('duplicateAdminForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'another@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      body: {} as DuplicateFormBody,
    })

    it('should return duplicated form view on duplicate success', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'mock title',
      }
      const mockDupedFormView = { title: 'mock view' } as FormMetaView
      const mockDupedForm = merge({}, MOCK_FORM, {
        title: 'duped form with new title',
        _id: new ObjectId(),
        getDashboardView: jest.fn().mockReturnValue(mockDupedFormView),
      })
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        okAsync(mockDupedForm),
      )

      // Act
      await AdminFormController.duplicateAdminForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(mockDupedFormView)
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })

    it('should return 403 when user does not have read permissions to form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'hello no read permissions error'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 404 when form to duplicate cannot be found', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'mock title',
      }
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      const mockErrorString = 'cannot find form to duplicate suddenly'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        errAsync(new FormNotFoundError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })

    it('should return 410 when form to duplicate is archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'form archived error'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'oh no user'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst retrieving logged  in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db error retrieving user'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst retrieving form to duplicate', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db error retrieving form'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst duplicating form', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'mock title',
      }
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      const mockErrorString = 'db error duplicating form'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.duplicateAdminForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })
  })

  describe('handleGetTemplateForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      agency: {
        emailDomain: ['example.com'],
        _id: new ObjectId(),
        lastModified: new Date('2017-09-15T06:03:58.803Z'),
        shortName: 'test',
        fullName: 'Test Agency',
        logo: 'path/to/nowhere',
        created: new Date('2017-09-15T06:03:58.792Z'),
        __v: 0,
      },
      email: 'alwaystesting@example.com',
    } as IPopulatedUser

    const MOCK_SCRUBBED_FORM = ({
      _id: MOCK_FORM_ID,
      title: "guess what it's another mock title",
      admin: { _id: MOCK_USER_ID },
    } as unknown) as PublicForm

    const MOCK_FORM = (mocked({
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: MOCK_SCRUBBED_FORM.title,
      getPublicView: jest.fn().mockResolvedValue(MOCK_SCRUBBED_FORM),
    }) as unknown) as MockedObject<IPopulatedForm>

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with requested form with only public fields', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockAuthService.getFormIfPublic.mockReturnValueOnce(okAsync(MOCK_FORM))

      // Act
      await AdminFormController.handleGetTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        form: MOCK_SCRUBBED_FORM,
      })
    })

    it('should return 403 when PrivateFormError is returned when retrieving form', async () => {
      // Arrange
      const mockFormTitle = 'some form title'
      const mockRes = expressHandler.mockResponse()
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new PrivateFormError(expectedErrorString, mockFormTitle)),
      )

      // Act
      await AdminFormController.handleGetTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
        isPageFound: true,
        formTitle: mockFormTitle,
      })
    })

    it('should return 404 when FormNotFoundError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock error when retrieving form.
      const expectedErrorString = 'form is not found'
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 410 when FormDeletedError is returned when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const expectedErrorString = 'form is deleted'
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })

    it('should return 500 when database error occurs whilst retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const expectedErrorString = 'database goes boom'
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleGetTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
    })
  })

  describe('handleCopyTemplateForm', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'andanother@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title again',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      body: {} as DuplicateFormBody,
    })

    it('should return copied template form view on duplicate success', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Email,
        emails: ['some-email@example.com'],
        title: 'mock new template title',
      }
      const mockDupedFormView = {
        title: 'mock template view',
      } as FormMetaView
      const mockDupedForm = merge({}, MOCK_FORM, {
        title: 'duped form with new title',
        _id: new ObjectId(),
        getDashboardView: jest.fn().mockReturnValue(mockDupedFormView),
      })
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(okAsync(MOCK_FORM))
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        okAsync(mockDupedForm),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith(mockDupedFormView)
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })

    it('should return 403 when form is private', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new PrivateFormError(undefined, 'some random title')),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      // Should return specific message.
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form must be public to be copied',
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 404 when form to duplicate cannot be found', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'mock title',
      }
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      const mockErrorString = 'cannot find form to duplicate suddenly'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(okAsync(MOCK_FORM))
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        errAsync(new FormNotFoundError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })

    it('should return 410 when form to duplicate is archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'form archived error'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new FormDeletedError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'oh no user'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst retrieving logged  in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db error retrieving user'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst retrieving form to duplicate', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db error retrieving form'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
    })

    it('should return 500 when database error occurs whilst duplicating form', async () => {
      // Arrange
      const expectedParams: DuplicateFormBody = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'mock title',
      }
      const mockRes = expressHandler.mockResponse()
      const mockReqWithParams = merge({}, MOCK_REQ, {
        body: expectedParams,
      })
      const mockErrorString = 'db error duplicating form'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormIfPublic.mockReturnValueOnce(okAsync(MOCK_FORM))
      MockAdminFormService.duplicateForm.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.handleCopyTemplateForm(
        mockReqWithParams,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: mockErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAdminFormService.duplicateForm).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_USER_ID,
        expectedParams,
      )
    })
  })

  describe('transferFormOwnership', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_NEW_OWNER_EMAIL = 'updatedUser@example.com'

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      body: {
        email: MOCK_NEW_OWNER_EMAIL,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with updated form with transferred owners', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockUpdatedForm = {
        ...MOCK_FORM,
        admin: { _id: new ObjectId(), email: MOCK_NEW_OWNER_EMAIL },
      } as IPopulatedForm
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.transferFormOwnership.mockReturnValueOnce(
        okAsync(mockUpdatedForm),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_NEW_OWNER_EMAIL,
      )
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({ form: mockUpdatedForm })
    })

    it('should return 400 when new owner is not in the database yet', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'new owner not found in db'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      // Mock error returned when owner is not in db.
      MockAdminFormService.transferFormOwnership.mockReturnValueOnce(
        errAsync(new TransferOwnershipError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_NEW_OWNER_EMAIL,
      )
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 403 when user does not have delete permissions', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      const mockErrorString = 'not allowed'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'form not found error'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock error returned when form is not found.
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 410 when the form is already archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'form archived'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      // Mock form is archived error.
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'user not found in db'
      // Mock error returned when user cannot be found in db.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 500 when database error occurs when retrieving logged in user', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db error oh no'
      // Mock db error.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 500 when database error occurs when retrieving form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'retrieve form db error'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })

    it('should return 500 when database error occurs when transferring form ownership', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const mockErrorString = 'db not found'
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      // Mock db error when transferring form ownership.
      MockAdminFormService.transferFormOwnership.mockReturnValueOnce(
        errAsync(new DatabaseError(mockErrorString)),
      )

      // Act
      await AdminFormController.transferFormOwnership(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      // Check all arguments of called services.
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Delete,
        },
      )
      expect(MockAdminFormService.transferFormOwnership).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_NEW_OWNER_EMAIL,
      )
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockErrorString })
    })
  })

  describe('handleUpdateForm', () => {
    const editFormFieldSpy = jest.spyOn(AdminFormService, 'editFormFields')
    const updateFormSpy = jest.spyOn(AdminFormService, 'updateForm')

    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_BASE_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    const MOCK_EDIT_FIELD_REQ = assignIn(cloneDeep(MOCK_BASE_REQ), {
      body: {
        form: {
          editFormField: {
            action: { name: EditFieldActions.Create },
            field: generateDefaultField(BasicField.Mobile),
          } as EditFormFieldParams,
        },
      },
    })

    const MOCK_UPDATE_FORM_REQ = assignIn(cloneDeep(MOCK_BASE_REQ), {
      body: {
        form: {
          esrvcId: 'MOCK-SOME-ID',
        },
      },
    })

    it('should return 200 with updated form when updating form fields', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedForm = assignIn(cloneDeep(MOCK_FORM), {
        form_fields: [MOCK_EDIT_FIELD_REQ.body.form.editFormField.field],
      })
      editFormFieldSpy.mockReturnValueOnce(okAsync(expectedForm))

      // Mock services to return success results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_EDIT_FIELD_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(expectedForm)
      expect(editFormFieldSpy).toHaveBeenCalledTimes(1)
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 200 with updated form when updating form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedForm = assignIn(cloneDeep(MOCK_FORM), {
        esrvcId: MOCK_UPDATE_FORM_REQ.body.form.esrvcId,
      })
      updateFormSpy.mockReturnValueOnce(okAsync(expectedForm))

      // Mock services to return success results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(expectedForm)
      expect(updateFormSpy).toHaveBeenCalledTimes(1)
      expect(editFormFieldSpy).not.toHaveBeenCalled()
    })

    it('should return 403 when current user does not have permissions to update form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'no write permissions'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(editFormFieldSpy).not.toHaveBeenCalled()
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 404 when form to update cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'nope'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_EDIT_FIELD_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(editFormFieldSpy).not.toHaveBeenCalled()
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 409 when version conflict occurs whilst saving updated form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'some conflict happened'
      updateFormSpy.mockReturnValueOnce(
        errAsync(new DatabaseConflictError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(updateFormSpy).toHaveBeenCalledTimes(1)
      expect(editFormFieldSpy).not.toHaveBeenCalled()
    })

    it('should return 410 when form to update is already archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'already deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_EDIT_FIELD_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(editFormFieldSpy).not.toHaveBeenCalled()
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 413 when updated form is too large to be saved in the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'payload too large'
      editFormFieldSpy.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_EDIT_FIELD_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(editFormFieldSpy).toHaveBeenCalledTimes(1)
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 422 when performing invalid update to form fields', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      // Mock services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      // Return error when editing form fields
      const expectedErrorString = 'invalid field update'
      editFormFieldSpy.mockReturnValueOnce(
        errAsync(new EditFieldError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_EDIT_FIELD_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(editFormFieldSpy).toHaveBeenCalledTimes(1)
      expect(updateFormSpy).not.toHaveBeenCalled()
    })

    it('should return 422 when an invalid update is attempted on the form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'invalid update to form shape'
      updateFormSpy.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(updateFormSpy).toHaveBeenCalledTimes(1)
      expect(editFormFieldSpy).not.toHaveBeenCalled()
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'user not in session??!!'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(updateFormSpy).not.toHaveBeenCalled()
      expect(editFormFieldSpy).not.toHaveBeenCalled()
    })

    it('should return 500 when generic database error occurs during form update', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'some database error bam'
      updateFormSpy.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateForm(
        MOCK_UPDATE_FORM_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(updateFormSpy).toHaveBeenCalledTimes(1)
      expect(editFormFieldSpy).not.toHaveBeenCalled()
    })
  })

  describe('handleUpdateSettings', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      body: {
        status: Status.Private,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with updated settings successfully', async () => {
      // Arrange
      const mockUpdatedSettings: FormSettings = {
        authType: AuthType.NIL,
        hasCaptcha: false,
        inactiveMessage: 'some inactive message',
        status: Status.Private,
        submissionLimit: 42069,
        title: 'new title',
        webhook: {
          url: '',
        },
      }
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.updateFormSettings.mockReturnValueOnce(
        okAsync(mockUpdatedSettings),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdatedSettings)
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.body,
      )
    })

    it('should return 403 when current user does not have permissions to update form settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'no write permissions'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).not.toHaveBeenCalled()
    })

    it('should return 404 when form to update settings for cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'nope'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).not.toHaveBeenCalled()
    })

    it('should return 409 when version conflict occurs whilst saving form settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'some conflict happened'
      MockAdminFormService.updateFormSettings.mockReturnValueOnce(
        errAsync(new DatabaseConflictError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.body,
      )
    })

    it('should return 410 when updating settings of archived form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'already deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).not.toHaveBeenCalled()
    })

    it('should return 413 when updating settings causes form to be too large to be saved in the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'payload too large'
      MockAdminFormService.updateFormSettings.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.body,
      )
    })

    it('should return 422 when an invalid patch is attempted on settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'invalid update to form shape'
      MockAdminFormService.updateFormSettings.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.body,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'user not in session??!!'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.updateFormSettings).not.toHaveBeenCalled()
    })

    it('should return 500 when generic database error occurs during settings update', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'some database error bam'
      MockAdminFormService.updateFormSettings.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController.handleUpdateSettings(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.updateFormSettings).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.body,
      )
    })
  })

  describe('handleGetSettings', () => {
    const MOCK_FORM_SETTINGS: FormSettings = {
      authType: AuthType.NIL,
      hasCaptcha: false,
      inactiveMessage: 'some inactive message',
      status: Status.Private,
      submissionLimit: 42069,
      title: 'mock title',
      webhook: {
        url: '',
      },
    }
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      getSettings: () => MOCK_FORM_SETTINGS,
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    it('should return 200 with settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )
      const adminCheck = jest.fn(
        ({
          form,
        }: {
          form: IPopulatedForm
        }): Result<IPopulatedForm, FormDeletedError | ForbiddenFormError> =>
          ok(form),
      )
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_FORM_SETTINGS)
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).toHaveBeenCalledWith({
        user: MOCK_USER,
        form: MOCK_FORM,
      })
    })

    it('should return 403 when current user does not have permissions to view form settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      const expectedErrorString = 'no write permissions'
      const adminCheck = jest.fn(
        (): Result<IPopulatedForm, FormDeletedError | ForbiddenFormError> =>
          err(new ForbiddenFormError(expectedErrorString)),
      )
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).toHaveBeenCalledWith({
        user: MOCK_USER,
        form: MOCK_FORM,
      })
    })

    it('should return 404 when form to view settings for cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'nope'
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      const adminCheck = jest.fn()
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).not.toHaveBeenCalled()
    })

    it('should return 409 when version conflict occurs whilst retrieving form settings', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'some conflict happened'
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        errAsync(new DatabaseConflictError(expectedErrorString)),
      )

      const adminCheck = jest.fn()
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).not.toHaveBeenCalled()
    })

    it('should return 410 when viewing settings of archived form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'already deleted'
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      const adminCheck = jest.fn()
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).not.toHaveBeenCalled()
    })

    it('should return 500 when generic database error occurs during settings retrieval', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        okAsync(MOCK_USER),
      )

      const expectedErrorString = 'some database error bam'
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      const adminCheck = jest.fn()
      MockAuthService.checkFormForPermissions.mockReturnValueOnce(adminCheck)

      // Act
      await AdminFormController.handleGetSettings(MOCK_REQ, mockRes, jest.fn())

      // Assert
      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockFormService.retrieveFullFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockAuthService.checkFormForPermissions).toHaveBeenCalledWith(
        PermissionLevel.Read,
      )
      expect(adminCheck).not.toHaveBeenCalled()
    })
  })

  describe('submitEmailPreview', () => {
    const MOCK_FIELD_ID = new ObjectId().toHexString()
    const MOCK_RESPONSES = [
      generateUnprocessedSingleAnswerResponse(BasicField.Email, {
        _id: MOCK_FIELD_ID,
      }),
    ]
    const MOCK_PARSED_RESPONSES = [
      generateNewSingleAnswerResponse(BasicField.Email, { _id: MOCK_FIELD_ID }),
    ]
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_SUBMISSION_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
      form_fields: [
        generateDefaultField(BasicField.Email, {
          _id: MOCK_FIELD_ID,
        }),
      ],
    } as IPopulatedEmailForm
    const MOCK_SUBMISSION = {
      id: MOCK_SUBMISSION_ID,
      _id: MOCK_SUBMISSION_ID,
      created: new Date(),
    } as IEmailSubmissionSchema
    const MOCK_SUBMISSION_BODY = {
      responses: MOCK_RESPONSES,
      isPreview: false,
    }
    const MOCK_DATA_COLLATION_DATA = 'mockDataCollation'
    const MOCK_FORM_DATA = 'mockFormData'
    const MOCK_AUTOREPLY_DATA = 'mockAutoReply'

    beforeEach(() => {
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )
      MockEmailSubmissionService.checkFormIsEmailMode.mockReturnValue(
        ok(MOCK_FORM),
      )
      MockEmailSubmissionService.validateAttachments.mockReturnValue(
        okAsync(true),
      )
      MockSubmissionService.getProcessedResponses.mockReturnValue(
        ok(MOCK_PARSED_RESPONSES),
      )
      MockEmailSubmissionService.createEmailSubmissionWithoutSave.mockReturnValue(
        MOCK_SUBMISSION,
      )
      MockEmailSubmissionService.extractEmailAnswers.mockReturnValue([
        MOCK_RESPONSES[0].answer,
      ])
      MockAdminFormService.extractMyInfoFieldIds.mockReturnValue([
        MOCK_FIELD_ID,
      ])
      MockMailService.sendSubmissionToAdmin.mockReturnValue(okAsync(true))
      MockSubmissionService.sendEmailConfirmations.mockReturnValue(
        okAsync(true),
      )
      jest.spyOn(EmailSubmissionUtil, 'SubmissionEmailObj').mockReturnValue(({
        dataCollationData: MOCK_DATA_COLLATION_DATA,
        formData: MOCK_FORM_DATA,
        autoReplyData: MOCK_AUTOREPLY_DATA,
      } as unknown) as EmailSubmissionUtil.SubmissionEmailObj)
    })

    it('should call all services correctly when submission is valid', async () => {
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).toHaveBeenCalledWith(
        MOCK_FORM.form_fields,
      )
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).toHaveBeenCalledWith(MOCK_FORM, expect.any(String), expect.any(String))
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).toHaveBeenCalledWith(MOCK_PARSED_RESPONSES)
      expect(MockMailService.sendSubmissionToAdmin).toHaveBeenCalledWith({
        replyToEmails: [MOCK_RESPONSES[0].answer],
        form: MOCK_FORM,
        submission: MOCK_SUBMISSION,
        attachments: [],
        dataCollationData: MOCK_DATA_COLLATION_DATA,
        formData: MOCK_FORM_DATA,
      })
      expect(MockSubmissionService.sendEmailConfirmations).toHaveBeenCalledWith(
        {
          form: MOCK_FORM,
          parsedResponses: MOCK_PARSED_RESPONSES,
          submission: MOCK_SUBMISSION,
          attachments: [],
          autoReplyData: MOCK_AUTOREPLY_DATA,
        },
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form submission successful.',
        submissionId: MOCK_SUBMISSION_ID,
      })
    })

    it('should return 500 when generic database error occurs while retrieving user', async () => {
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 422 when user is missing', async () => {
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when generic database error occurs while retrieving form', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when form is not found', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 410 when form has been archived', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 403 when user does not have read permissions', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when form is not email mode', async () => {
      MockEmailSubmissionService.checkFormIsEmailMode.mockReturnValueOnce(
        err(new ResponseModeError(ResponseMode.Encrypt, ResponseMode.Email)),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when attachments are invalid', async () => {
      MockEmailSubmissionService.validateAttachments.mockReturnValueOnce(
        errAsync(new InvalidFileExtensionError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when attachments are too large', async () => {
      MockEmailSubmissionService.validateAttachments.mockReturnValueOnce(
        errAsync(new AttachmentTooLargeError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when responses cannot be processed', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ProcessingError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 409 when the submitted field IDs do not match the form field IDs', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ConflictError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when any answer is invalid', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ValidateFieldError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).not.toHaveBeenCalled()
      expect(MockMailService.sendSubmissionToAdmin).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when the submission email fails to be generated', async () => {
      MockMailService.sendSubmissionToAdmin.mockReturnValueOnce(
        errAsync(new MailGenerationError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).toHaveBeenCalledWith(
        MOCK_FORM.form_fields,
      )
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).toHaveBeenCalledWith(MOCK_FORM, expect.any(String), expect.any(String))
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).toHaveBeenCalledWith(MOCK_PARSED_RESPONSES)
      expect(MockMailService.sendSubmissionToAdmin).toHaveBeenCalledWith({
        replyToEmails: [MOCK_RESPONSES[0].answer],
        form: MOCK_FORM,
        submission: MOCK_SUBMISSION,
        attachments: [],
        dataCollationData: MOCK_DATA_COLLATION_DATA,
        formData: MOCK_FORM_DATA,
      })
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when the submission email fails to be sent', async () => {
      MockMailService.sendSubmissionToAdmin.mockReturnValueOnce(
        errAsync(new MailSendError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).toHaveBeenCalledWith(
        MOCK_FORM.form_fields,
      )
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).toHaveBeenCalledWith(MOCK_FORM, expect.any(String), expect.any(String))
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).toHaveBeenCalledWith(MOCK_PARSED_RESPONSES)
      expect(MockMailService.sendSubmissionToAdmin).toHaveBeenCalledWith({
        replyToEmails: [MOCK_RESPONSES[0].answer],
        form: MOCK_FORM,
        submission: MOCK_SUBMISSION,
        attachments: [],
        dataCollationData: MOCK_DATA_COLLATION_DATA,
        formData: MOCK_FORM_DATA,
      })
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 200 regardless of errors while sending email confirmations', async () => {
      MockSubmissionService.sendEmailConfirmations.mockReturnValueOnce(
        errAsync(new SendEmailConfirmationError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEmailPreview(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEmailSubmissionService.checkFormIsEmailMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEmailSubmissionService.validateAttachments,
      ).toHaveBeenCalledWith(MOCK_RESPONSES)
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(MockAdminFormService.extractMyInfoFieldIds).toHaveBeenCalledWith(
        MOCK_FORM.form_fields,
      )
      expect(
        MockEmailSubmissionService.createEmailSubmissionWithoutSave,
      ).toHaveBeenCalledWith(MOCK_FORM, expect.any(String), expect.any(String))
      expect(
        MockEmailSubmissionService.extractEmailAnswers,
      ).toHaveBeenCalledWith(MOCK_PARSED_RESPONSES)
      expect(MockMailService.sendSubmissionToAdmin).toHaveBeenCalledWith({
        replyToEmails: [MOCK_RESPONSES[0].answer],
        form: MOCK_FORM,
        submission: MOCK_SUBMISSION,
        attachments: [],
        dataCollationData: MOCK_DATA_COLLATION_DATA,
        formData: MOCK_FORM_DATA,
      })
      expect(MockSubmissionService.sendEmailConfirmations).toHaveBeenCalledWith(
        {
          form: MOCK_FORM,
          parsedResponses: MOCK_PARSED_RESPONSES,
          submission: MOCK_SUBMISSION,
          attachments: [],
          autoReplyData: MOCK_AUTOREPLY_DATA,
        },
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form submission successful.',
        submissionId: MOCK_SUBMISSION_ID,
      })
    })
  })

  describe('submitEncryptPreview', () => {
    const MOCK_RESPONSES = [
      generateUnprocessedSingleAnswerResponse(BasicField.Email),
    ]
    const MOCK_PARSED_RESPONSES = [
      generateNewSingleAnswerResponse(BasicField.Email),
    ]
    const MOCK_ENCRYPTED_CONTENT = 'mockEncryptedContent'
    const MOCK_VERSION = 1
    const MOCK_SUBMISSION_BODY: EncryptSubmissionDto = {
      responses: MOCK_RESPONSES,
      encryptedContent: MOCK_ENCRYPTED_CONTENT,
      version: MOCK_VERSION,
      isPreview: false,
      attachments: {
        [new ObjectId().toHexString()]: {
          encryptedFile: {
            binary: '10101',
            nonce: 'mockNonce',
            submissionPublicKey: 'mockPublicKey',
          },
        },
      },
    }
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_SUBMISSION_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedEncryptedForm
    const MOCK_SUBMISSION = {
      _id: MOCK_SUBMISSION_ID,
      created: new Date(),
    } as IEncryptedSubmissionSchema

    beforeEach(() => {
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )
      MockEncryptSubmissionService.checkFormIsEncryptMode.mockReturnValue(
        ok(MOCK_FORM),
      )
      MockEncryptionUtils.checkIsEncryptedEncoding.mockReturnValue(ok(true))
      MockSubmissionService.getProcessedResponses.mockReturnValue(
        ok(MOCK_PARSED_RESPONSES),
      )
      MockEncryptSubmissionService.createEncryptSubmissionWithoutSave.mockReturnValue(
        MOCK_SUBMISSION,
      )
    })

    it('should call all services correctly when submission is valid', async () => {
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockEncryptionUtils.checkIsEncryptedEncoding).toHaveBeenCalledWith(
        MOCK_ENCRYPTED_CONTENT,
      )
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).toHaveBeenCalledWith({
        form: MOCK_FORM,
        encryptedContent: MOCK_ENCRYPTED_CONTENT,
        verifiedContent: '',
        version: MOCK_VERSION,
      })
      expect(MockSubmissionService.sendEmailConfirmations).toHaveBeenCalledWith(
        {
          form: MOCK_FORM,
          parsedResponses: MOCK_PARSED_RESPONSES,
          submission: MOCK_SUBMISSION,
        },
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form submission successful.',
        submissionId: MOCK_SUBMISSION_ID,
      })
    })

    it('should return 500 when generic database error occurs while retrieving user', async () => {
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 422 when user is missing', async () => {
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when generic database error occurs while retrieving form', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when form is not found', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 410 when form has been archived', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 403 when user does not have read permissions', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).not.toHaveBeenCalled()
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when form is not encrypt mode', async () => {
      MockEncryptSubmissionService.checkFormIsEncryptMode.mockReturnValueOnce(
        err(new ResponseModeError(ResponseMode.Email, ResponseMode.Encrypt)),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(
        MockEncryptionUtils.checkIsEncryptedEncoding,
      ).not.toHaveBeenCalled()
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when encrypted content encoding is invalid', async () => {
      MockEncryptionUtils.checkIsEncryptedEncoding.mockReturnValueOnce(
        err(new InvalidEncodingError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockEncryptionUtils.checkIsEncryptedEncoding).toHaveBeenCalledWith(
        MOCK_ENCRYPTED_CONTENT,
      )
      expect(MockSubmissionService.getProcessedResponses).not.toHaveBeenCalled()
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when responses cannot be processed', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ProcessingError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockEncryptionUtils.checkIsEncryptedEncoding).toHaveBeenCalledWith(
        MOCK_ENCRYPTED_CONTENT,
      )
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 409 when form fields submitted are not updated', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ConflictError('')),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockEncryptionUtils.checkIsEncryptedEncoding).toHaveBeenCalledWith(
        MOCK_ENCRYPTED_CONTENT,
      )
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when responses cannot be validated', async () => {
      MockSubmissionService.getProcessedResponses.mockReturnValueOnce(
        err(new ValidateFieldError()),
      )
      const mockReq = expressHandler.mockRequest({
        params: {
          formId: MOCK_FORM_ID,
        },
        body: MOCK_SUBMISSION_BODY,
        session: {
          user: {
            _id: MOCK_USER_ID,
          },
        },
      })
      const mockRes = expressHandler.mockResponse()

      await AdminFormController.submitEncryptPreview(
        mockReq,
        mockRes,
        jest.fn(),
      )

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Read,
        },
      )
      expect(
        MockEncryptSubmissionService.checkFormIsEncryptMode,
      ).toHaveBeenCalledWith(MOCK_FORM)
      expect(MockEncryptionUtils.checkIsEncryptedEncoding).toHaveBeenCalledWith(
        MOCK_ENCRYPTED_CONTENT,
      )
      expect(MockSubmissionService.getProcessedResponses).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_RESPONSES,
      )
      expect(
        MockEncryptSubmissionService.createEncryptSubmissionWithoutSave,
      ).not.toHaveBeenCalled()
      expect(
        MockSubmissionService.sendEmailConfirmations,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })
  })

  describe('_handleUpdateFormField', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FIELD = generateDefaultField(BasicField.Rating)
    const MOCK_UPDATED_FIELD = {
      ...MOCK_FIELD,
      title: 'some new title',
    } as FieldUpdateDto

    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
        fieldId: MOCK_FIELD._id,
      },
      body: MOCK_UPDATED_FIELD,
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    beforeEach(() => {
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )

      MockAdminFormService.updateFormField.mockReturnValue(
        okAsync(MOCK_UPDATED_FIELD as IFieldSchema),
      )
    })
    it('should return 200 with updated form field', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_UPDATED_FIELD)
      expect(MockAdminFormService.updateFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        String(MOCK_FIELD._id),
        MOCK_REQ.body,
      )
    })

    it('should return 404 when field cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.updateFormField.mockReturnValueOnce(
        errAsync(new FieldNotFoundError()),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Field to modify not found',
      })
      expect(MockAdminFormService.updateFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        String(MOCK_FIELD._id),
        MOCK_REQ.body,
      )
    })

    it('should return 403 when current user does not have permissions to update form', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const expectedErrorString = 'no write permissions'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).not.toHaveBeenCalled()
    })

    it('should return 404 when form to update form field for cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'nope'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).not.toHaveBeenCalled()
    })

    it('should return 410 when form to update form field for is already archived', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'already deleted'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).not.toHaveBeenCalled()
    })

    it('should return 413 when updated form is too large to be saved in the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'payload too large'
      MockAdminFormService.updateFormField.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        String(MOCK_FIELD._id),
        MOCK_REQ.body,
      )
    })

    it('should return 422 when performing invalid update to form field', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      const expectedErrorString = 'invalid field update'
      MockAdminFormService.updateFormField.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        String(MOCK_FIELD._id),
        MOCK_REQ.body,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'user not in session??!!'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.updateFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when generic database error occurs during form field update', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      const expectedErrorString = 'some database error bam'
      MockAdminFormService.updateFormField.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )

      // Act
      await AdminFormController._handleUpdateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.updateFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        String(MOCK_FIELD._id),
        MOCK_REQ.body,
      )
    })
  })

  describe('_handleCreateFormField', () => {
    const MOCK_FORM_ID = new ObjectId()
    const MOCK_USER_ID = new ObjectId()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser

    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_RETURNED_FIELD = generateDefaultField(BasicField.Nric)
    const MOCK_CREATE_FIELD_BODY = pick(MOCK_RETURNED_FIELD, [
      'fieldType',
      'title',
    ]) as FieldCreateDto
    const MOCK_REQ = expressHandler.mockRequest({
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
      params: {
        formId: String(MOCK_FORM_ID),
      },
      body: MOCK_CREATE_FIELD_BODY,
    })
    beforeEach(() => {
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.createFormField.mockReturnValue(
        okAsync(MOCK_RETURNED_FIELD),
      )
    })

    it('should return 200 with created form field', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_RETURNED_FIELD)
      expect(MockAdminFormService.createFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_CREATE_FIELD_BODY,
      )
    })

    it('should return 403 when current user does not have permissions to create a form field', async () => {
      // Arrange
      const expectedErrorString = 'no permissions pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const expectedErrorString = 'no form pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 410 when attempting to create a form field for an archived form', async () => {
      // Arrange
      const expectedErrorString = 'form gone pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 413 when creating a form field causes the form to be too large to be saved in the database', async () => {
      // Arrange
      const expectedErrorString = 'payload too large'
      MockAdminFormService.createFormField.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_CREATE_FIELD_BODY,
      )
    })

    it('should return 422 when DatabaseValidationError occurs', async () => {
      // Arrange
      const expectedErrorString = 'invalid thing'
      MockAdminFormService.createFormField.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_CREATE_FIELD_BODY,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const expectedErrorString = 'user gone'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving user from database', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving form from database', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: String(MOCK_FORM_ID),
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.createFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst creating form field', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockAdminFormService.createFormField.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleCreateFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.createFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_CREATE_FIELD_BODY,
      )
    })
  })

  describe('_handleReorderFormField', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FIELDS = [
      generateDefaultField(BasicField.Rating),
      generateDefaultField(BasicField.Table),
    ]
    const MOCK_UPDATED_FIELDS = [MOCK_FIELDS[1], MOCK_FIELDS[0]]

    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      form_fields: MOCK_FIELDS,
      title: 'mock title',
    } as IPopulatedForm

    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
        fieldId: MOCK_FIELDS[1]._id,
      },
      query: { to: 2 },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    beforeEach(() => {
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )

      MockAdminFormService.reorderFormField.mockReturnValue(
        okAsync(MOCK_UPDATED_FIELDS),
      )
    })

    it('should return 200 with reordered form fields', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_UPDATED_FIELDS)
      expect(MockAdminFormService.reorderFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.params.fieldId,
        MOCK_REQ.query.to,
      )
    })

    it('should return 403 when current user does not have permissions to reorder a form field', async () => {
      // Arrange
      const expectedErrorString = 'no permissions pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const expectedErrorString = 'no form pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 404 when field cannot be found', async () => {
      // Arrange
      const mockRes = expressHandler.mockResponse()
      MockAdminFormService.reorderFormField.mockReturnValueOnce(
        errAsync(new FieldNotFoundError()),
      )

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Field to modify not found',
      })
      expect(MockAdminFormService.reorderFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.params.fieldId,
        MOCK_REQ.query.to,
      )
    })

    it('should return 410 when attempting to reorder a form field for an archived form', async () => {
      // Arrange
      const expectedErrorString = 'form gone pls'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 413 when reordering a form field causes the form to be too large to be saved in the database', async () => {
      // Arrange
      const expectedErrorString = 'payload too large'
      MockAdminFormService.reorderFormField.mockReturnValueOnce(
        errAsync(new DatabasePayloadSizeError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.params.fieldId,
        MOCK_REQ.query.to,
      )
    })

    it('should return 422 when DatabaseValidationError occurs', async () => {
      // Arrange
      const expectedErrorString = 'invalid thing'
      MockAdminFormService.reorderFormField.mockReturnValueOnce(
        errAsync(new DatabaseValidationError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.params.fieldId,
        MOCK_REQ.query.to,
      )
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      const expectedErrorString = 'user gone'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving user from database', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst retrieving form from database', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: String(MOCK_FORM_ID),
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.reorderFormField).not.toHaveBeenCalled()
    })

    it('should return 500 when database error occurs whilst reordering form field', async () => {
      // Arrange
      const expectedErrorString = 'database error'
      MockAdminFormService.reorderFormField.mockReturnValueOnce(
        errAsync(new DatabaseError(expectedErrorString)),
      )
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleReorderFormField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expectedErrorString,
      })
      expect(MockAdminFormService.reorderFormField).toHaveBeenCalledWith(
        MOCK_FORM,
        MOCK_REQ.params.fieldId,
        MOCK_REQ.query.to,
      )
    })
  })

  describe('handleDeleteLogic', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser

    const logicId = new ObjectId().toHexString()
    const mockFormLogic = {
      form_logics: [
        {
          _id: logicId,
          id: logicId,
        } as ILogicSchema,
      ],
    }

    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
      title: 'mock title',
      ...mockFormLogic,
    } as IPopulatedForm

    const mockReq = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
        logicId,
      },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })
    const mockRes = expressHandler.mockResponse()
    beforeEach(() => {
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )
      MockAdminFormService.deleteFormLogic.mockReturnValue(okAsync(true))
    })

    it('should call all services correctly when request is valid', async () => {
      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.deleteFormLogic).toHaveBeenCalledWith(
        MOCK_FORM,
        logicId,
      )

      expect(mockRes.sendStatus).toHaveBeenCalledWith(200)
    })

    it('should return 403 when user does not have permissions to delete logic', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        errAsync(
          new ForbiddenFormError('not authorized to perform write operation'),
        ),
      )

      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.deleteFormLogic).not.toHaveBeenCalled()

      expect(mockRes.status).toHaveBeenCalledWith(403)

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'not authorized to perform write operation',
      })
    })

    it('should return 404 when logicId cannot be found', async () => {
      MockAdminFormService.deleteFormLogic.mockReturnValue(
        errAsync(new LogicNotFoundError()),
      )

      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )

      expect(MockAdminFormService.deleteFormLogic).toHaveBeenCalledWith(
        MOCK_FORM,
        logicId,
      )

      expect(mockRes.status).toHaveBeenCalledWith(404)

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'logicId does not exist on form',
      })
    })

    it('should return 404 when form cannot be found', async () => {
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        errAsync(new FormNotFoundError()),
      )

      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(MockAuthService.getFormAfterPermissionChecks).toHaveBeenCalledWith(
        {
          user: MOCK_USER,
          formId: MOCK_FORM_ID,
          level: PermissionLevel.Write,
        },
      )
      expect(MockAdminFormService.deleteFormLogic).not.toHaveBeenCalled()

      expect(mockRes.status).toHaveBeenCalledWith(404)

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Form not found',
      })
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      MockUserService.getPopulatedUserById.mockReturnValue(
        errAsync(new MissingUserError()),
      )

      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()

      expect(MockAdminFormService.deleteFormLogic).not.toHaveBeenCalled()

      expect(mockRes.status).toHaveBeenCalledWith(422)

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User not found',
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockUserService.getPopulatedUserById.mockReturnValue(
        errAsync(new DatabaseError()),
      )

      await AdminFormController.handleDeleteLogic(mockReq, mockRes, jest.fn())

      expect(MockUserService.getPopulatedUserById).toHaveBeenCalledWith(
        MOCK_USER_ID,
      )
      expect(
        MockAuthService.getFormAfterPermissionChecks,
      ).not.toHaveBeenCalled()

      expect(MockAdminFormService.deleteFormLogic).not.toHaveBeenCalled()

      expect(mockRes.status).toHaveBeenCalledWith(500)

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Something went wrong. Please try again.',
      })
    })
  })

  describe('_handleUpdateCollaborators', () => {
    const MOCK_USER_ID = new ObjectId().toHexString()
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_USER = {
      _id: MOCK_USER_ID,
      email: 'somerandom@example.com',
    } as IPopulatedUser
    const MOCK_FORM = {
      admin: MOCK_USER,
      _id: MOCK_FORM_ID,
    } as IPopulatedForm
    const MOCK_COLLABORATORS = [
      {
        email: `fakeuser@gov.sg`,
        write: false,
      },
    ]
    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        formId: MOCK_FORM_ID,
      },
      body: { permissionList: MOCK_COLLABORATORS },
      session: {
        user: {
          _id: MOCK_USER_ID,
        },
      },
    })

    beforeEach(() => {
      // Mock various services to return expected results.
      MockUserService.getPopulatedUserById.mockReturnValue(okAsync(MOCK_USER))
      MockAuthService.getFormAfterPermissionChecks.mockReturnValue(
        okAsync(MOCK_FORM),
      )
    })
    it('should return 200 when collaborators are updated successfully', async () => {
      // Arrange
      MockAdminFormService.updateFormCollaborators.mockReturnValueOnce(
        okAsync(MOCK_COLLABORATORS),
      )
      const mockRes = expressHandler.mockResponse()
      const expectedResponse = { permissionList: MOCK_COLLABORATORS }

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.OK)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
    })

    it('should return 403 when the user does not have sufficient permissions to update the form', async () => {
      // Arrange
      const ERROR_MESSAGE = 'all your base are belong to us'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new ForbiddenFormError(ERROR_MESSAGE)),
      )
      const mockRes = expressHandler.mockResponse()
      const expectedResponse = { message: ERROR_MESSAGE }

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.FORBIDDEN)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
      expect(
        MockAdminFormService.updateFormCollaborators,
      ).not.toHaveBeenCalled()
    })

    it('should return 404 when the form could not be found', async () => {
      // Arrange
      const ERROR_MESSAGE = 'all your base are belong to us'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormNotFoundError(ERROR_MESSAGE)),
      )
      const mockRes = expressHandler.mockResponse()
      const expectedResponse = { message: ERROR_MESSAGE }

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
      expect(
        MockAdminFormService.updateFormCollaborators,
      ).not.toHaveBeenCalled()
    })

    it('should return 410 when the form has been archived', async () => {
      // Arrange
      const ERROR_MESSAGE = 'all your base are belong to us'
      MockAuthService.getFormAfterPermissionChecks.mockReturnValueOnce(
        errAsync(new FormDeletedError(ERROR_MESSAGE)),
      )
      const mockRes = expressHandler.mockResponse()
      const expectedResponse = { message: ERROR_MESSAGE }

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.GONE)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
      expect(
        MockAdminFormService.updateFormCollaborators,
      ).not.toHaveBeenCalled()
    })

    it('should return 422 when the session user could not be retrieved from the database', async () => {
      // Arrange
      const ERROR_MESSAGE = 'all your base are belong to us'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new MissingUserError(ERROR_MESSAGE)),
      )
      const expectedResponse = { message: ERROR_MESSAGE }
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.UNPROCESSABLE_ENTITY)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
      expect(
        MockAdminFormService.updateFormCollaborators,
      ).not.toHaveBeenCalled()
    })

    it('should return 500 when a database error occurs', async () => {
      // Arrange
      const ERROR_MESSAGE = 'all your base are belong to us'
      MockUserService.getPopulatedUserById.mockReturnValueOnce(
        errAsync(new DatabaseError(ERROR_MESSAGE)),
      )
      const expectedResponse = { message: ERROR_MESSAGE }
      const mockRes = expressHandler.mockResponse()

      // Act
      await AdminFormController._handleUpdateCollaborators(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(mockRes.status).toBeCalledWith(StatusCodes.INTERNAL_SERVER_ERROR)
      expect(mockRes.json).toBeCalledWith(expectedResponse)
      expect(
        MockAdminFormService.updateFormCollaborators,
      ).not.toHaveBeenCalled()
    })
  })
})
