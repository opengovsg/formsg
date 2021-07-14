/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PresignedPost } from 'aws-sdk/clients/s3'
import { ObjectId } from 'bson-ext'
import { assignIn, cloneDeep, merge, omit, pick } from 'lodash'
import mongoose from 'mongoose'
import { err, errAsync, ok, okAsync } from 'neverthrow'
import { mocked } from 'ts-jest/utils'

import { aws } from 'src/app/config/config'
import getFormModel, {
  getEmailFormModel,
  getEncryptedFormModel,
} from 'src/app/models/form.server.model'
import {
  ApplicationError,
  DatabaseConflictError,
  DatabaseError,
  DatabasePayloadSizeError,
  DatabaseValidationError,
} from 'src/app/modules/core/core.errors'
import { MissingUserError } from 'src/app/modules/user/user.errors'
import * as UserService from 'src/app/modules/user/user.service'
import { SmsLimitExceededError } from 'src/app/modules/verification/verification.errors'
import { formatErrorRecoveryMessage } from 'src/app/utils/handle-mongo-error'
import { EditFieldActions, VALID_UPLOAD_FILE_TYPES } from 'src/shared/constants'
import {
  AuthType,
  BasicField,
  EndPage,
  FormLogoState,
  FormMetaView,
  FormSettings,
  ICustomFormLogo,
  IEmailFormSchema,
  IFormDocument,
  IFormSchema,
  ILogicSchema,
  IPopulatedForm,
  IPopulatedUser,
  IUserSchema,
  LogicType,
  PickDuplicateForm,
  ResponseMode,
  StartPage,
  Status,
} from 'src/types'
import {
  DuplicateFormBody,
  EditFormFieldParams,
  FieldCreateDto,
  FieldUpdateDto,
  SettingsUpdateDto,
} from 'src/types/api'

import { generateDefaultField } from 'tests/unit/backend/helpers/generate-form-data'

import { smsConfig } from '../../../../config/features/sms.config'
import * as SmsService from '../../../../services/sms/sms.service'
import {
  FormNotFoundError,
  LogicNotFoundError,
  TransferOwnershipError,
} from '../../form.errors'
import {
  CreatePresignedUrlError,
  EditFieldError,
  FieldNotFoundError,
  InvalidFileTypeError,
} from '../admin-form.errors'
import {
  archiveForm,
  createForm,
  createFormField,
  createFormLogic,
  createPresignedPostUrlForImages,
  createPresignedPostUrlForLogos,
  deleteFormField,
  deleteFormLogic,
  disableSmsVerificationsForUser,
  duplicateForm,
  duplicateFormField,
  editFormFields,
  getDashboardForms,
  getFormField,
  reorderFormField,
  shouldUpdateFormField,
  transferFormOwnership,
  updateEndPage,
  updateForm,
  updateFormCollaborators,
  updateFormField,
  updateFormLogic,
  updateFormSettings,
  updateStartPage,
} from '../admin-form.service'
import { OverrideProps } from '../admin-form.types'
import * as AdminFormUtils from '../admin-form.utils'

const FormModel = getFormModel(mongoose)
const EmailFormModel = getEmailFormModel(mongoose)
const EncryptFormModel = getEncryptedFormModel(mongoose)

jest.mock('src/app/modules/user/user.service')
const MockUserService = mocked(UserService)

describe('admin-form.service', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('getDashboardForms', () => {
    it('should return list of forms user is authorized to view', async () => {
      // Arrange
      const mockUserId = 'mockUserId'
      const mockUser = {
        email: 'MOCK_EMAIL@example.com',
        _id: mockUserId,
      } as IUserSchema
      const mockDashboardForms: FormMetaView[] = [
        {
          admin: {} as IPopulatedUser,
          title: 'test form 1',
          _id: 'any',
          responseMode: ResponseMode.Email,
        },
        {
          admin: {} as IPopulatedUser,
          title: 'test form 2',
          _id: 'any2',
          responseMode: ResponseMode.Encrypt,
        },
      ]
      // Mock user admin success.
      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(mockUser as IUserSchema),
      )
      const getSpy = jest
        .spyOn(FormModel, 'getMetaByUserIdOrEmail')
        .mockResolvedValueOnce(mockDashboardForms)

      // Act
      const actualResult = await getDashboardForms(mockUserId)

      // Assert
      expect(getSpy).toHaveBeenCalledWith(mockUserId, mockUser.email)
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(mockDashboardForms)
    })

    it('should return MissingUserError when user with userId does not exist', async () => {
      // Arrange
      const expectedError = new MissingUserError('not found')
      MockUserService.findUserById.mockReturnValueOnce(errAsync(expectedError))

      // Act
      const actualResult = await getDashboardForms('any')

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      // Error should passthrough.
      expect(actualResult._unsafeUnwrapErr()).toEqual(expectedError)
    })

    it('should return DatabaseError when error occurs whilst querying the database', async () => {
      // Arrange
      const mockUserId = 'mockUserId'
      const mockUser = {
        email: 'MOCK_EMAIL@example.com',
        _id: mockUserId,
      } as IUserSchema
      // Mock user admin success.
      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(mockUser as IUserSchema),
      )
      const getSpy = jest
        .spyOn(FormModel, 'getMetaByUserIdOrEmail')
        .mockRejectedValueOnce(new Error('some error'))

      // Act
      const actualResult = await getDashboardForms(mockUserId)

      // Assert
      expect(getSpy).toHaveBeenCalledWith(mockUserId, mockUser.email)
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new DatabaseError())
    })
  })

  describe('createPresignedPostUrlForImages', () => {
    it('should successfully create presigned POST URL', async () => {
      // Arrange
      const expectedPresignedPostUrl: PresignedPost = {
        fields: {
          'X-Amz-Signature': 'some-amz-signature',
          Policy: 'some policy',
        },
        url: 'some url',
      }
      // Mock external service success.
      const s3Spy = jest
        .spyOn(aws.s3, 'createPresignedPost')

        // @ts-ignore
        .mockImplementationOnce((_obj, cb) => {
          cb(null, expectedPresignedPostUrl)
        })

      // Act
      const actualResult = await createPresignedPostUrlForImages({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: VALID_UPLOAD_FILE_TYPES[0],
      })

      // Assert
      // Check that the correct bucket was used.
      expect(s3Spy).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: aws.imageS3Bucket }),

        // @ts-ignore
        expect.any(Function),
      )
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(expectedPresignedPostUrl)
    })

    it('should return InvalidFileTypeError when given file type is not supported', async () => {
      // Arrange
      const invalidFileType = 'something'
      expect(VALID_UPLOAD_FILE_TYPES.includes(invalidFileType)).toEqual(false)

      // Act
      const actualResult = await createPresignedPostUrlForImages({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: invalidFileType,
      })

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new InvalidFileTypeError(
          `"${invalidFileType}" is not a supported file type`,
        ),
      )
    })

    it('should return CreatePresignedUrlError when error occurs whilst creating presigned POST URL', async () => {
      // Arrange
      // Mock external service failure.
      const s3Spy = jest
        .spyOn(aws.s3, 'createPresignedPost')
        .mockImplementationOnce(() => {
          throw new Error('boom')
        })

      // Act
      const actualResult = await createPresignedPostUrlForImages({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: VALID_UPLOAD_FILE_TYPES[0],
      })

      // Assert
      // Check that the correct bucket was used.
      expect(s3Spy).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: aws.imageS3Bucket }),

        // @ts-ignore
        expect.any(Function),
      )
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new CreatePresignedUrlError('Error occurred whilst uploading file'),
      )
    })
  })

  describe('createPresignedPostUrlForLogos', () => {
    it('should successfully create presigned POST URL', async () => {
      // Arrange
      const expectedPresignedPostUrl: PresignedPost = {
        fields: {
          'X-Amz-Signature': 'some-amz-signature',
          Policy: 'some policy',
        },
        url: 'some url',
      }
      // Mock external service success.
      const s3Spy = jest
        .spyOn(aws.s3, 'createPresignedPost')

        // @ts-ignore
        .mockImplementationOnce((_obj, cb) => {
          cb(null, expectedPresignedPostUrl)
        })

      // Act
      const actualResult = await createPresignedPostUrlForLogos({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: VALID_UPLOAD_FILE_TYPES[0],
      })

      // Assert
      // Check that the correct bucket was used.
      expect(s3Spy).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: aws.logoS3Bucket }),

        // @ts-ignore
        expect.any(Function),
      )
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(expectedPresignedPostUrl)
    })

    it('should return InvalidFileTypeError when given file type is not supported', async () => {
      // Arrange
      const invalidFileType = 'something'
      expect(VALID_UPLOAD_FILE_TYPES.includes(invalidFileType)).toEqual(false)

      // Act
      const actualResult = await createPresignedPostUrlForLogos({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: invalidFileType,
      })

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new InvalidFileTypeError(
          `"${invalidFileType}" is not a supported file type`,
        ),
      )
    })

    it('should return CreatePresignedUrlError when error occurs whilst creating presigned POST URL', async () => {
      // Arrange
      // Mock external service failure.
      const s3Spy = jest
        .spyOn(aws.s3, 'createPresignedPost')
        .mockImplementationOnce(() => {
          throw new Error('boom')
        })

      // Act
      const actualResult = await createPresignedPostUrlForLogos({
        fileId: 'any id',
        fileMd5Hash: 'any hash',
        fileType: VALID_UPLOAD_FILE_TYPES[0],
      })

      // Assert
      // Check that the correct bucket was used.
      expect(s3Spy).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: aws.logoS3Bucket }),

        // @ts-ignore
        expect.any(Function),
      )
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new CreatePresignedUrlError('Error occurred whilst uploading file'),
      )
    })
  })

  describe('archiveForm', () => {
    it('should true when form is successfully archived', async () => {
      // Arrange
      const mockArchivedForm = {
        _id: new ObjectId(),
        admin: new ObjectId(),
        status: Status.Archived,
      } as IEmailFormSchema
      const mockArchiveFn = jest.fn().mockResolvedValue(mockArchivedForm)
      const mockInitialForm = {
        archive: mockArchiveFn,
      } as unknown as IPopulatedForm

      // Act
      const actual = await archiveForm(mockInitialForm)

      // Assert
      expect(actual.isOk()).toEqual(true)
      expect(actual._unsafeUnwrap()).toEqual(true)
    })

    it('should return DatabaseError if any database errors occur', async () => {
      // Arrange
      const mockErrorString = 'database went wrong something'
      const mockArchiveFn = jest
        .fn()
        .mockRejectedValue(new Error(mockErrorString))
      const mockInitialForm = {
        archive: mockArchiveFn,
      } as unknown as IPopulatedForm

      // Act
      const actual = await archiveForm(mockInitialForm)

      // Assert
      expect(actual.isErr()).toEqual(true)
      expect(actual._unsafeUnwrapErr()).toEqual(
        new DatabaseError(formatErrorRecoveryMessage(mockErrorString)),
      )
    })
  })

  describe('duplicateForm', () => {
    const MOCK_NEW_ADMIN_ID = new ObjectId().toHexString()
    const MOCK_VALID_FORM = {
      _id: new ObjectId(),
      admin: new ObjectId(),
      endPage: {
        buttonLink: 'original form endpage link',
      },
      startPage: {
        logo: {
          state: FormLogoState.Custom,
          fileId: 'some file_id',
          fileName: 'some file name',
          fileSizeInBytes: 10000,
        } as ICustomFormLogo,
      },
    } as unknown as IFormDocument
    const MOCK_EMAIL_OVERRIDE_PARAMS: DuplicateFormBody = {
      responseMode: ResponseMode.Email,
      title: 'mock new title',
      emails: ['mockExample@example.com'],
    }
    const MOCK_ENCRYPT_OVERRIDE_PARAMS: DuplicateFormBody = {
      responseMode: ResponseMode.Encrypt,
      title: 'mock new title',
      publicKey: 'some public key',
    }

    const createMockForm = (expectedParams: OverrideProps) =>
      merge({}, MOCK_VALID_FORM, {
        getDuplicateParams: jest.fn().mockReturnValue(expectedParams),
      }) as IFormDocument

    it('should successfully duplicate form', async () => {
      // Arrange
      const mockNewAdminId = new ObjectId().toHexString()
      const expectedParams: PickDuplicateForm & OverrideProps = {
        admin: MOCK_NEW_ADMIN_ID,
        ...MOCK_ENCRYPT_OVERRIDE_PARAMS,
      }
      const mockForm = createMockForm(expectedParams)

      // Mock util return
      const expectedOverrideProps = { title: 'new title' } as OverrideProps
      jest
        .spyOn(AdminFormUtils, 'processDuplicateOverrideProps')
        .mockReturnValueOnce(expectedOverrideProps)
      const expectedForm = createMockForm(expectedOverrideProps)
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockResolvedValueOnce(expectedForm as never)

      // Act
      const actualResult = await duplicateForm(
        mockForm,
        mockNewAdminId,
        MOCK_EMAIL_OVERRIDE_PARAMS,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(expectedForm)
      expect(createSpy).toHaveBeenCalledWith(expectedParams)
      expect(mockForm.getDuplicateParams).toHaveBeenCalledWith({
        ...expectedOverrideProps,
        // Should now have start page set to default
        startPage: {
          logo: {
            state: FormLogoState.Default,
          },
        },
      })
    })

    it('should omit buttonLink if original form link is to the form itself', async () => {
      // Arrange
      const mockNewAdminId = new ObjectId().toHexString()
      const expectedParams: PickDuplicateForm & OverrideProps = {
        admin: MOCK_NEW_ADMIN_ID,
        ...omit(MOCK_ENCRYPT_OVERRIDE_PARAMS, 'isTemplate'),
      }
      const mockForm = merge({}, MOCK_VALID_FORM, {
        endPage: {
          // Legacy: buttonLink is hashed link.
          buttonLink: `#!/${MOCK_VALID_FORM._id}`,
        },
        getDuplicateParams: jest.fn().mockReturnValue(expectedParams),
      }) as IFormDocument

      // Mock util return
      const expectedOverrideProps = {
        endPage: { buttonLink: 'has button link' },
      } as OverrideProps
      jest
        .spyOn(AdminFormUtils, 'processDuplicateOverrideProps')
        .mockReturnValueOnce(expectedOverrideProps)
      const expectedForm = createMockForm(expectedOverrideProps)
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockResolvedValueOnce(expectedForm as never)

      // Act
      const actualResult = await duplicateForm(
        mockForm,
        mockNewAdminId,
        MOCK_EMAIL_OVERRIDE_PARAMS,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(expectedForm)
      expect(createSpy).toHaveBeenCalledWith(expectedParams)
      expect(mockForm.getDuplicateParams).toHaveBeenCalledWith({
        // No more button link.
        endPage: {},
        startPage: {
          logo: {
            state: FormLogoState.Default,
          },
        },
      })
    })

    it('should return DatabaseError if error occurred during the duplication', async () => {
      // Arrange
      const mockNewAdminId = new ObjectId().toHexString()
      const expectedParams: PickDuplicateForm & OverrideProps = {
        admin: MOCK_NEW_ADMIN_ID,
        ...omit(MOCK_ENCRYPT_OVERRIDE_PARAMS, 'isTemplate'),
      }
      const mockForm = createMockForm(expectedParams)

      const mockErrorString = 'something went wrong!'
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockRejectedValueOnce(new Error(mockErrorString) as never)
      // Mock util return
      const expectedOverrideProps = { title: 'new title' } as OverrideProps
      jest
        .spyOn(AdminFormUtils, 'processDuplicateOverrideProps')
        .mockReturnValueOnce(expectedOverrideProps)

      // Act
      const actualResult = await duplicateForm(
        mockForm,
        mockNewAdminId,
        MOCK_EMAIL_OVERRIDE_PARAMS,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new DatabaseError(formatErrorRecoveryMessage(mockErrorString)),
      )
      expect(createSpy).toHaveBeenCalledWith(expectedParams)
      expect(mockForm.getDuplicateParams).toHaveBeenCalledWith({
        ...expectedOverrideProps,
        // Should now have start page set to default
        startPage: {
          logo: {
            state: FormLogoState.Default,
          },
        },
      })
    })
  })

  describe('transferFormOwnership', () => {
    const MOCK_NEW_OWNER_EMAIL = 'random@example.com'
    const MOCK_CURRENT_OWNER = {
      _id: new ObjectId(),
      email: 'someemail@example.com',
    } as IUserSchema
    const MOCK_NEW_OWNER = {
      _id: new ObjectId(),
      email: MOCK_NEW_OWNER_EMAIL,
    } as IUserSchema

    it('should return updated form with new owner successfully', async () => {
      // Arrange
      const expectedPopulateResult = {
        title: 'mock populated form',
      } as IPopulatedForm

      const mockUpdatedForm = {
        _id: new ObjectId(),
        admin: MOCK_CURRENT_OWNER,
        emails: [MOCK_NEW_OWNER_EMAIL],
        responseMode: ResponseMode.Email,
        title: 'some mock form',
        populate: jest.fn().mockReturnValue({
          execPopulate: jest.fn().mockResolvedValue(expectedPopulateResult),
        }),
      } as unknown as IFormSchema

      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm

      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(MOCK_CURRENT_OWNER),
      )
      MockUserService.findUserByEmail.mockReturnValueOnce(
        okAsync(MOCK_NEW_OWNER),
      )

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(expectedPopulateResult)
      expect(mockValidForm.transferOwner).toHaveBeenCalledWith(
        MOCK_CURRENT_OWNER,
        MOCK_NEW_OWNER,
      )
      expect(mockUpdatedForm.populate).toHaveBeenCalled()
    })

    it('should return TransferOwnershipError when new owner cannot be found in the database', async () => {
      // Arrange
      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(MOCK_CURRENT_OWNER),
      )
      // Mock unable to retrieve new owner.
      MockUserService.findUserByEmail.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )
      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn(),
      } as unknown as IPopulatedForm

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      // Messaging should have been overridden.
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new TransferOwnershipError(
          `${MOCK_NEW_OWNER.email} must have logged in once before being added as Owner`,
        ),
      )
      expect(mockValidForm.transferOwner).not.toHaveBeenCalled()
    })

    it('should return MissingUserError when current form owner cannot be found in the database', async () => {
      // Arrange
      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn(),
      } as unknown as IPopulatedForm
      MockUserService.findUserById.mockReturnValueOnce(
        errAsync(new MissingUserError()),
      )

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      // Messaging should have been overridden.
      expect(actualResult._unsafeUnwrapErr()).toEqual(new MissingUserError())
      expect(mockValidForm.transferOwner).not.toHaveBeenCalled()
    })

    it('should return DatabaseError when database error occurs whilst retrieving current form owner', async () => {
      // Arrange
      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn(),
      } as unknown as IPopulatedForm
      MockUserService.findUserById.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      // Messaging should have been overridden.
      expect(actualResult._unsafeUnwrapErr()).toEqual(new DatabaseError())
      expect(mockValidForm.transferOwner).not.toHaveBeenCalled()
    })

    it('should return DatabaseError when database error occurs whilst retrieving new owner', async () => {
      // Arrange
      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(MOCK_CURRENT_OWNER),
      )
      MockUserService.findUserByEmail.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )
      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn(),
      } as unknown as IPopulatedForm

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      // Messaging should have been overridden.
      expect(actualResult._unsafeUnwrapErr()).toEqual(new DatabaseError())
      expect(mockValidForm.transferOwner).not.toHaveBeenCalled()
    })

    it('should return TransferOwnershipError when new owner is same as current owner', async () => {
      // Arrange
      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(MOCK_CURRENT_OWNER),
      )
      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn(),
      } as unknown as IPopulatedForm

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        // Should trigger error since new owner email is the same as current.
        MOCK_CURRENT_OWNER.email,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new TransferOwnershipError('You are already the owner of this form'),
      )
      expect(mockValidForm.transferOwner).not.toHaveBeenCalled()
      expect(MockUserService.findUserByEmail).not.toHaveBeenCalled()
    })

    it('should return DatabaseError when database error occurs during populating the updated form', async () => {
      // Arrange
      const mockPopulateErrorStr = 'population failed!'
      const mockUpdatedForm = {
        _id: new ObjectId(),
        admin: MOCK_CURRENT_OWNER,
        emails: [MOCK_NEW_OWNER_EMAIL],
        responseMode: ResponseMode.Email,
        title: 'some mock form',
        populate: jest.fn().mockReturnValue({
          // Mock populate error.
          execPopulate: jest
            .fn()
            .mockRejectedValue(new Error(mockPopulateErrorStr)),
        }),
      } as unknown as IFormSchema

      const mockValidForm = {
        title: 'some mock form',
        admin: MOCK_CURRENT_OWNER,
        transferOwner: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm

      MockUserService.findUserById.mockReturnValueOnce(
        okAsync(MOCK_CURRENT_OWNER),
      )
      MockUserService.findUserByEmail.mockReturnValueOnce(
        okAsync(MOCK_NEW_OWNER),
      )

      // Act
      const actualResult = await transferFormOwnership(
        mockValidForm,
        MOCK_NEW_OWNER_EMAIL,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new DatabaseError(formatErrorRecoveryMessage(mockPopulateErrorStr)),
      )
      expect(mockValidForm.transferOwner).toHaveBeenCalledWith(
        MOCK_CURRENT_OWNER,
        MOCK_NEW_OWNER,
      )
      expect(mockUpdatedForm.populate).toHaveBeenCalled()
    })
  })

  describe('createForm', () => {
    it('should successfully create form', async () => {
      // Arrange
      const formParams: Parameters<typeof createForm>[0] = {
        title: 'create form title',
        admin: new ObjectId().toHexString(),
        responseMode: ResponseMode.Email,
        emails: 'example@example.com',
      }
      const expectedForm = {
        _id: new ObjectId(),
        ...formParams,
      } as IFormSchema
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockResolvedValueOnce(expectedForm as never)

      // Act
      const actualResult = await createForm(formParams)

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual(expectedForm)
      expect(createSpy).toHaveBeenCalledWith(formParams)
    })

    it('should return DatabaseValidationError on invalid form params whilst creating form', async () => {
      // Arrange
      const formParams: Parameters<typeof createForm>[0] = {
        title: 'create form title',
        admin: new ObjectId().toHexString(),
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some key',
      }
      const createSpy = jest
        .spyOn(FormModel, 'create')

        // @ts-ignore
        .mockRejectedValueOnce(new mongoose.Error.ValidationError() as never)

      // Act
      const actualResult = await createForm(formParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(
        DatabaseValidationError,
      )
      expect(createSpy).toHaveBeenCalledWith(formParams)
    })

    it('should return DatabaseConflictError on mongoose version error', async () => {
      // Arrange
      const formParams: Parameters<typeof createForm>[0] = {
        title: 'create form title',
        admin: new ObjectId().toHexString(),
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some key',
      }
      const createSpy = jest.spyOn(FormModel, 'create').mockRejectedValueOnce(
        // @ts-ignore
        new mongoose.Error.VersionError({}, 1, ['none']) as never,
      )

      // Act
      const actualResult = await createForm(formParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(
        DatabaseConflictError,
      )
      expect(createSpy).toHaveBeenCalledWith(formParams)
    })

    it('should return DatabasePayloadError on form size error', async () => {
      // Arrange
      const formParams: Parameters<typeof createForm>[0] = {
        title: 'create form title',
        admin: new ObjectId().toHexString(),
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some key',
      }
      const mockErrorString = 'some payload size error'
      const expectedError = Object.assign(new Error(mockErrorString), {
        name: 'FormSizeError',
      })
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockRejectedValueOnce(expectedError as never)

      // Act
      const actualResult = await createForm(formParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new DatabasePayloadSizeError(
          formatErrorRecoveryMessage(mockErrorString),
        ),
      )
      expect(createSpy).toHaveBeenCalledWith(formParams)
    })

    it('should return DatabaseError on database error whilst creating form', async () => {
      // Arrange
      const formParams: Parameters<typeof createForm>[0] = {
        title: 'create form title',
        admin: new ObjectId().toHexString(),
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some key',
      }
      const mockErrorString = 'no'
      const createSpy = jest
        .spyOn(FormModel, 'create')
        .mockRejectedValueOnce(new Error(mockErrorString) as never)

      // Act
      const actualResult = await createForm(formParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new DatabaseError(formatErrorRecoveryMessage(mockErrorString)),
      )
      expect(createSpy).toHaveBeenCalledWith(formParams)
    })
  })

  describe('editFormFields', () => {
    const MOCK_UPDATED_FORM = {
      _id: new ObjectId(),
      admin: new ObjectId(),
      form_fields: [
        generateDefaultField(BasicField.Email),
        generateDefaultField(BasicField.Mobile),
        generateDefaultField(BasicField.Dropdown),
      ],
    } as unknown as IPopulatedForm

    const MOCK_INTIAL_FORM = mocked({
      _id: MOCK_UPDATED_FORM._id,
      admin: MOCK_UPDATED_FORM.admin,
      form_fields: [
        generateDefaultField(BasicField.Email),
        generateDefaultField(BasicField.Mobile),
      ],
      save: jest.fn().mockResolvedValue(MOCK_UPDATED_FORM),
    } as unknown as IPopulatedForm)

    it('should return updated form', async () => {
      // Arrange
      const newField = generateDefaultField(BasicField.Dropdown)
      const mockUpdatedFields = [...MOCK_INTIAL_FORM.form_fields, newField]
      const updateSpy = jest
        .spyOn(AdminFormUtils, 'getUpdatedFormFields')
        .mockReturnValueOnce(ok(mockUpdatedFields))

      const createParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Create },
        field: newField,
      }

      // Act
      const actualResult = await editFormFields(MOCK_INTIAL_FORM, createParams)

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual(MOCK_UPDATED_FORM)
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(MOCK_INTIAL_FORM.save).toHaveBeenCalledTimes(1)
    })

    it('should return EditFieldError without updating when invalid updates are being formed on form fields', async () => {
      // Arrange
      // Update service function should return error.
      const mockError = new EditFieldError('invalid update to field')
      const updateSpy = jest
        .spyOn(AdminFormUtils, 'getUpdatedFormFields')
        .mockReturnValueOnce(err(mockError))

      const reorderParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Reorder, position: 2 },
        field: cloneDeep(MOCK_INTIAL_FORM.form_fields[1]),
      }

      // Act
      const actualResult = await editFormFields(MOCK_INTIAL_FORM, reorderParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toEqual(mockError)
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(MOCK_INTIAL_FORM.save).not.toHaveBeenCalled()
    })

    it('should return DatabaseError when error occurs during saving of form', async () => {
      // Arrange
      const [, ...mockUpdatedFields] = MOCK_INTIAL_FORM.form_fields
      const updateSpy = jest
        .spyOn(AdminFormUtils, 'getUpdatedFormFields')
        .mockReturnValueOnce(ok(mockUpdatedFields))
      // Mock database save error.

      // @ts-ignore
      const mockError = new mongoose.Error.VersionError({}, 1, ['none'])
      MOCK_INTIAL_FORM.save.mockRejectedValueOnce(mockError as never)

      const deleteParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Delete },
        field: cloneDeep(MOCK_INTIAL_FORM.form_fields[0]),
      }

      // Act
      const actualResult = await editFormFields(MOCK_INTIAL_FORM, deleteParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(
        DatabaseConflictError,
      )
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(MOCK_INTIAL_FORM.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateForm', () => {
    const MOCK_UPDATED_FORM = {
      _id: new ObjectId(),
      admin: new ObjectId(),
      status: Status.Private,
      form_fields: [
        generateDefaultField(BasicField.Mobile),
        generateDefaultField(BasicField.Dropdown),
      ],
    } as unknown as IPopulatedForm

    const MOCK_INITIAL_FORM = mocked({
      _id: MOCK_UPDATED_FORM._id,
      admin: MOCK_UPDATED_FORM.admin,
      status: Status.Public,
      form_fields: MOCK_UPDATED_FORM.form_fields,
      save: jest.fn().mockResolvedValue(MOCK_UPDATED_FORM),
    } as unknown as IPopulatedForm)

    it('should successfully update given form keys', async () => {
      // Arrange
      const formUpdateParams: Parameters<typeof updateForm>[1] = {
        status: Status.Private,
      }

      // Act
      const actualResult = await updateForm(MOCK_INITIAL_FORM, formUpdateParams)

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual(MOCK_UPDATED_FORM)
      // .save should have been called with updated form.
      expect(MOCK_INITIAL_FORM.save.mock.instances[0]).toEqual(
        assignIn(cloneDeep(MOCK_INITIAL_FORM), formUpdateParams),
      )
      expect(MOCK_INITIAL_FORM.save).toHaveBeenCalledTimes(1)
    })

    it('should return DatabaseError when error occurs whilst updating form', async () => {
      // Arrange
      const formUpdateParams: Parameters<typeof updateForm>[1] = {
        esrvcId: 'MOCK-ESRVCID',
      }
      // Mock database failure.
      MOCK_INITIAL_FORM.save.mockRejectedValueOnce(
        new Error('some error') as never,
      )

      // Act
      const actualResult = await updateForm(MOCK_INITIAL_FORM, formUpdateParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(DatabaseError)
      // .save should have been called with updated form.
      expect(MOCK_INITIAL_FORM.save.mock.instances[0]).toEqual(
        assignIn(cloneDeep(MOCK_INITIAL_FORM), formUpdateParams),
      )
      expect(MOCK_INITIAL_FORM.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateFormSettings', () => {
    const MOCK_UPDATED_SETTINGS: FormSettings = {
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

    const MOCK_UPDATED_FORM = {
      ...MOCK_UPDATED_SETTINGS,
      responseMode: ResponseMode.Encrypt,
      publicKey: 'some public key',
      getSettings: jest.fn().mockReturnValue(MOCK_UPDATED_SETTINGS),
    } as unknown as IFormDocument

    const MOCK_EMAIL_FORM = mocked({
      _id: new ObjectId(),
      status: Status.Public,
      responseMode: ResponseMode.Email,
    } as unknown as IPopulatedForm)
    const MOCK_ENCRYPT_FORM = mocked({
      _id: new ObjectId(),
      status: Status.Public,
      responseMode: ResponseMode.Encrypt,
    } as unknown as IPopulatedForm)

    const EMAIL_UPDATE_SPY = jest
      .spyOn(EmailFormModel, 'findByIdAndUpdate')

      // @ts-ignore
      .mockReturnValue({
        exec: jest.fn().mockResolvedValue(MOCK_UPDATED_FORM),
      })
    const ENCRYPT_UPDATE_SPY = jest
      .spyOn(EncryptFormModel, 'findByIdAndUpdate')

      // @ts-ignore
      .mockReturnValue({
        exec: jest.fn().mockResolvedValue(MOCK_UPDATED_FORM),
      })

    beforeEach(() => jest.clearAllMocks())

    it('should return updated form settings when successfully updating email form settings', async () => {
      // Arrange
      const settingsToUpdate: SettingsUpdateDto = {
        status: Status.Private,
        title: 'new title',
      }

      // Act
      const actualResult = await updateFormSettings(
        MOCK_EMAIL_FORM,
        settingsToUpdate,
      )

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual(MOCK_UPDATED_SETTINGS)
      expect(EMAIL_UPDATE_SPY).toHaveBeenCalledWith(
        MOCK_EMAIL_FORM._id,
        settingsToUpdate,
        { new: true, runValidators: true },
      )
      expect(MOCK_UPDATED_FORM.getSettings).toHaveBeenCalledTimes(1)
    })

    it('should return updated form settings when successfully updating encrypt form settings', async () => {
      // Arrange
      const settingsToUpdate: SettingsUpdateDto = {
        webhook: {
          url: 'https://example.com',
        },
      }
      // Act
      const actualResult = await updateFormSettings(
        MOCK_ENCRYPT_FORM,
        settingsToUpdate,
      )

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual(MOCK_UPDATED_SETTINGS)
      expect(ENCRYPT_UPDATE_SPY).toHaveBeenCalledWith(
        MOCK_ENCRYPT_FORM._id,
        // Should be dotified
        { 'webhook.url': 'https://example.com' },
        { new: true, runValidators: true },
      )
      expect(MOCK_UPDATED_FORM.getSettings).toHaveBeenCalledTimes(1)
    })

    it('should return DatabaseValidationError when validation error occurs whilst updating', async () => {
      // Arrange
      const settingsToUpdate: SettingsUpdateDto = {
        title: 'does not matter',
      }
      // Mock database error
      // @ts-ignore
      ENCRYPT_UPDATE_SPY.mockReturnValueOnce({
        exec: jest.fn().mockRejectedValue(
          // @ts-ignore
          new mongoose.Error.ValidationError({ errors: 'some error' }),
        ),
      })

      // Act
      const actualResult = await updateFormSettings(
        MOCK_ENCRYPT_FORM,
        settingsToUpdate,
      )

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(
        DatabaseValidationError,
      )
      expect(ENCRYPT_UPDATE_SPY).toHaveBeenCalledWith(
        MOCK_ENCRYPT_FORM._id,
        settingsToUpdate,
        { new: true, runValidators: true },
      )
      expect(MOCK_UPDATED_FORM.getSettings).toHaveBeenCalledTimes(0)
    })
  })

  describe('updateFormField', () => {
    it('should return updated form field', async () => {
      // Arrange
      const fieldToUpdate = generateDefaultField(BasicField.YesNo, {
        title: 'random title',
      })
      const mockNewField = {
        ...fieldToUpdate,
        title: 'new title',
      } as FieldUpdateDto

      const mockUpdatedForm = {
        title: 'some mock form',
        form_fields: [mockNewField],
      }
      const mockForm = {
        ...mockUpdatedForm,
        form_fields: [fieldToUpdate],
        updateFormFieldById: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm

      // Act
      const actual = await updateFormField(
        mockForm,
        fieldToUpdate._id,
        mockNewField,
      )

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(mockNewField)
      expect(mockForm.updateFormFieldById).toHaveBeenCalledWith(
        fieldToUpdate._id,
        mockNewField,
      )
    })

    it('should return FieldNotFoundError when field update returns null', async () => {
      // Arrange
      const mockForm = {
        title: 'another mock form',
        form_fields: [],
        updateFormFieldById: jest.fn().mockResolvedValue(null),
      } as unknown as IPopulatedForm

      const invalidFieldId = new ObjectId().toHexString()
      const mockNewField = generateDefaultField(
        BasicField.Number,
      ) as FieldUpdateDto

      // Act
      const actual = await updateFormField(
        mockForm,
        invalidFieldId,
        mockNewField,
      )

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FieldNotFoundError())
    })

    it('should return DatabaseValidationError when field model update throws a validation error', async () => {
      // Arrange
      const mockForm = {
        title: 'another another mock form',
        form_fields: [],
        updateFormFieldById: jest.fn().mockRejectedValue(
          // @ts-ignore
          new mongoose.Error.ValidationError(),
        ),
      } as unknown as IPopulatedForm

      const invalidFieldId = new ObjectId().toHexString()
      const mockNewField = generateDefaultField(
        BasicField.Number,
      ) as FieldUpdateDto

      // Act
      const actual = await updateFormField(
        mockForm,
        invalidFieldId,
        mockNewField,
      )

      // Assert
      expect(actual._unsafeUnwrapErr()).toBeInstanceOf(DatabaseValidationError)
    })
  })

  describe('createFormField', () => {
    it('should return created form field', async () => {
      // Arrange
      const initialFields = [
        generateDefaultField(BasicField.Mobile),
        generateDefaultField(BasicField.Image),
      ]
      const expectedCreatedField = generateDefaultField(BasicField.Nric, {
        title: 'some nric title',
      })
      const mockUpdatedForm = {
        title: 'some mock form',
        // Append created field to end of form_fields.
        form_fields: [...initialFields, expectedCreatedField],
      }
      const mockForm = {
        title: 'some mock form',
        form_fields: initialFields,
        insertFormField: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm
      const formCreateParams = pick(expectedCreatedField, [
        'title',
        'fieldType',
      ]) as FieldCreateDto

      // Act
      const actual = await createFormField(mockForm, formCreateParams)

      // Assert
      // Should return last element in form_field
      expect(actual._unsafeUnwrap()).toEqual(expectedCreatedField)
    })

    it('should return DatabaseValidationError when field model update throws a validation error', async () => {
      // Arrange
      const initialFields = [
        generateDefaultField(BasicField.Mobile),
        generateDefaultField(BasicField.Image),
      ]
      const mockForm = {
        title: 'some mock form',
        form_fields: initialFields,
        insertFormField: jest.fn().mockRejectedValue(
          // @ts-ignore
          new mongoose.Error.ValidationError({ errors: 'does not matter' }),
        ),
      } as unknown as IPopulatedForm
      const formCreateParams = {
        fieldType: BasicField.ShortText,
        title: 'some title',
      } as FieldCreateDto

      // Act
      const actual = await createFormField(mockForm, formCreateParams)

      // Assert
      expect(actual._unsafeUnwrapErr()).toBeInstanceOf(DatabaseValidationError)
    })
  })

  describe('deleteFormLogic', () => {
    const logicId = new ObjectId().toHexString()
    const mockFormLogic = {
      form_logics: [
        {
          _id: logicId,
          id: logicId,
        } as ILogicSchema,
      ],
    }

    const DELETE_SPY = jest.spyOn(FormModel, 'deleteFormLogic')

    let mockEmailForm: IPopulatedForm, mockEncryptForm: IPopulatedForm

    beforeEach(() => {
      mockEmailForm = {
        _id: new ObjectId(),
        status: Status.Public,
        responseMode: ResponseMode.Email,
        ...mockFormLogic,
      } as unknown as IPopulatedForm
      mockEncryptForm = {
        _id: new ObjectId(),
        status: Status.Public,
        responseMode: ResponseMode.Encrypt,
        ...mockFormLogic,
      } as unknown as IPopulatedForm
    })

    it('should return ok(form) on successful form logic delete for email mode form', async () => {
      // Arrange
      const UPDATE_SPY = jest
        .spyOn(FormModel, 'findByIdAndUpdate')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEmailForm),
        })

      // Act
      const actualResult = await deleteFormLogic(mockEmailForm, logicId)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(mockEmailForm)

      expect(UPDATE_SPY).toHaveBeenCalledWith(
        mockEmailForm._id,
        {
          $pull: { form_logics: { _id: logicId } },
        },
        {
          new: true,
          runValidators: true,
        },
      )

      expect(DELETE_SPY).toHaveBeenCalledWith(
        String(mockEmailForm._id),
        logicId,
      )
    })

    it('should return ok(form) on successful form logic delete for encrypt mode form', async () => {
      // Arrange
      const UPDATE_SPY = jest
        .spyOn(FormModel, 'findByIdAndUpdate')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEncryptForm),
        })

      // Act
      const actualResult = await deleteFormLogic(mockEncryptForm, logicId)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(mockEncryptForm)

      expect(UPDATE_SPY).toHaveBeenCalledWith(
        mockEncryptForm._id,
        {
          $pull: { form_logics: { _id: logicId } },
        },
        {
          new: true,
          runValidators: true,
        },
      )

      expect(DELETE_SPY).toHaveBeenCalledWith(
        String(mockEncryptForm._id),
        logicId,
      )
    })

    it('should return LogicNotFoundError if logic does not exist on form', async () => {
      // Act
      const wrongLogicId = new ObjectId().toHexString()
      const actualResult = await deleteFormLogic(mockEmailForm, wrongLogicId)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new LogicNotFoundError())
      expect(DELETE_SPY).not.toHaveBeenCalled()
    })
  })

  describe('duplicateFormField', () => {
    it('should return updated form when field duplication is successful', async () => {
      // Arrange
      const fieldToDuplicate = generateDefaultField(BasicField.Mobile)
      const duplicatedField = generateDefaultField(BasicField.Mobile)
      const mockUpdatedForm = {
        title: 'some mock form',
        // Append duplicated field to end of form_fields.
        form_fields: [fieldToDuplicate, duplicatedField],
      } as IFormSchema
      const mockForm = {
        title: 'some mock form',
        form_fields: [fieldToDuplicate],
        _id: new ObjectId(),
        duplicateFormFieldById: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm

      // Act
      const actual = await duplicateFormField(
        mockForm,
        String(fieldToDuplicate._id),
      )

      const actualDuplicatedField = omit(actual._unsafeUnwrap(), [
        '_id',
        'globalId',
      ])

      const expectedDuplicateFieldWithoutId = omit(duplicatedField, [
        '_id',
        'globalId',
      ])

      // Assert
      expect(actualDuplicatedField).toEqual(expectedDuplicateFieldWithoutId)
    })

    it('should return FormNotFoundError when field duplication returns null', async () => {
      // Arrange
      const fieldToDuplicate = generateDefaultField(BasicField.Mobile)
      const mockForm = {
        title: 'some mock form',
        form_fields: [fieldToDuplicate],
        _id: new ObjectId(),
        duplicateFormFieldById: jest.fn().mockResolvedValue(null),
      } as unknown as IPopulatedForm

      // Act
      const actual = await duplicateFormField(mockForm, fieldToDuplicate._id)

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FormNotFoundError())
    })

    it('should return DatabaseValidationError when field model update throws a validation error', async () => {
      // Arrange
      const initialFields = [generateDefaultField(BasicField.Mobile)]
      const mockForm = {
        title: 'some mock form',
        form_fields: initialFields,
        duplicateFormFieldById: jest.fn().mockRejectedValue(
          // @ts-ignore
          new mongoose.Error.ValidationError({ errors: 'does not matter' }),
        ),
      } as unknown as IPopulatedForm

      // Act
      const actual = await duplicateFormField(mockForm, initialFields[0]._id)

      // Assert
      expect(actual._unsafeUnwrapErr()).toBeInstanceOf(DatabaseValidationError)
    })
  })

  describe('reorderFormField', () => {
    it('should return reordered fields successfully', async () => {
      // Arrange
      const mockFormFields = [
        generateDefaultField(BasicField.YesNo),
        generateDefaultField(BasicField.Date),
      ]
      const mockUpdatedForm = {
        form_fields: [mockFormFields[1], mockFormFields[0]],
      }
      const mockForm = {
        form_fields: mockFormFields,
        reorderFormFieldById: jest.fn().mockResolvedValue(mockUpdatedForm),
      } as unknown as IPopulatedForm
      const fieldToReorder = String(mockFormFields[0]._id)
      const newPosition = 1

      // Act
      const actual = await reorderFormField(
        mockForm,
        fieldToReorder,
        newPosition,
      )

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(mockUpdatedForm.form_fields)
      expect(mockForm.reorderFormFieldById).toHaveBeenCalledWith(
        fieldToReorder,
        newPosition,
      )
    })

    it('should return FieldNotFoundError when null is returned from the model instance method', async () => {
      // Arrange
      const mockForm = {
        form_fields: [generateDefaultField(BasicField.YesNo)],
        reorderFormFieldById: jest.fn().mockResolvedValue(null),
      } as unknown as IPopulatedForm
      const fieldToReorder = new ObjectId().toHexString()
      const newPosition = 2

      // Act
      const actual = await reorderFormField(
        mockForm,
        fieldToReorder,
        newPosition,
      )

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FieldNotFoundError())
      expect(mockForm.reorderFormFieldById).toHaveBeenCalledWith(
        fieldToReorder,
        newPosition,
      )
    })

    it('should return database error when error occurs whilst reordering fields', async () => {
      // Arrange
      const mockForm = {
        form_fields: [generateDefaultField(BasicField.YesNo)],
        // Rejection
        reorderFormFieldById: jest
          .fn()
          .mockRejectedValue(new Error('some error')),
      } as unknown as IPopulatedForm
      const fieldToReorder = new ObjectId().toHexString()
      const newPosition = 2

      // Act
      const actual = await reorderFormField(
        mockForm,
        fieldToReorder,
        newPosition,
      )

      // Assert
      const actualError = actual._unsafeUnwrapErr()
      expect(actualError).toBeInstanceOf(DatabaseError)
      expect(actualError.message).toEqual(expect.stringContaining('some error'))
      expect(mockForm.reorderFormFieldById).toHaveBeenCalledWith(
        fieldToReorder,
        newPosition,
      )
    })
  })

  describe('updateFormCollaborators', () => {
    it('should return the list of collaborators when update is successful', async () => {
      // Arrange
      const newCollaborators = [
        {
          email: `fakeuser@gov.sg`,
          write: false,
        },
      ]
      const mockForm = {
        title: 'some mock form',
        updateFormCollaborators: jest
          .fn()
          .mockResolvedValue({ permissionList: newCollaborators }),
      } as unknown as IPopulatedForm

      // Act
      const actual = await updateFormCollaborators(mockForm, newCollaborators)

      // Assert
      expect(mockForm.updateFormCollaborators).toHaveBeenCalledWith(
        newCollaborators,
      )
      expect(actual._unsafeUnwrap()).toEqual(newCollaborators)
    })

    it('should return an application error when updating the form model fails', async () => {
      // Arrange
      const newCollaborators = [
        {
          email: `fakeuser@gov.sg`,
          write: false,
        },
      ]
      const mockForm = {
        title: 'some mock form',
        updateFormCollaborators: jest
          .fn()
          .mockRejectedValue(new DatabaseError()),
      } as unknown as IPopulatedForm

      // Act
      const actual = await updateFormCollaborators(mockForm, newCollaborators)

      // Assert
      expect(mockForm.updateFormCollaborators).toHaveBeenCalledWith(
        newCollaborators,
      )
      expect(actual._unsafeUnwrapErr()).toBeInstanceOf(ApplicationError)
    })
  })

  describe('createFormLogic', () => {
    const logicId1 = new ObjectId()
    const logicId2 = new ObjectId()
    const logicId3 = new ObjectId()
    const mockEmailFormId = new ObjectId()
    const mockEncryptFormId = new ObjectId()

    const mockFormLogicOld = {
      form_logics: [
        {
          _id: logicId1,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
        {
          _id: logicId2,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
      ],
    }

    const createLogicBody = {
      logicType: LogicType.PreventSubmit,
    } as ILogicSchema

    const mockFormLogicUpdated = {
      form_logics: [
        {
          _id: logicId1,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
        {
          _id: logicId2,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
        {
          _id: logicId3,
          logicType: LogicType.PreventSubmit,
        } as ILogicSchema,
      ],
    }

    const CREATE_SPY = jest.spyOn(FormModel, 'createFormLogic')

    let mockEmailForm: IPopulatedForm,
      mockEncryptForm: IPopulatedForm,
      mockEmailFormUpdated: IPopulatedForm,
      mockEncryptFormUpdated: IPopulatedForm

    beforeEach(() => {
      mockEmailForm = {
        _id: mockEmailFormId,
        status: Status.Public,
        responseMode: ResponseMode.Email,
        ...mockFormLogicOld,
      } as unknown as IPopulatedForm
      mockEncryptForm = {
        _id: mockEncryptFormId,
        status: Status.Public,
        responseMode: ResponseMode.Encrypt,
        ...mockFormLogicOld,
      } as unknown as IPopulatedForm
      mockEmailFormUpdated = {
        ...mockEmailForm,
        ...mockFormLogicUpdated,
      } as unknown as IPopulatedForm
      mockEncryptFormUpdated = {
        ...mockEncryptForm,
        ...mockFormLogicUpdated,
      } as unknown as IPopulatedForm
    })

    it('should return ok(created logic) on successful form logic create for email mode form', async () => {
      // Arrange
      CREATE_SPY.mockResolvedValue(mockEmailFormUpdated as IFormSchema)

      // Act
      const actualResult = await createFormLogic(mockEmailForm, createLogicBody)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(
        expect.objectContaining(createLogicBody),
      )

      expect(CREATE_SPY).toHaveBeenCalledWith(
        mockEmailForm._id,
        createLogicBody,
      )
    })

    it('should return ok(created logic) on successful form logic create for encrypt mode form', async () => {
      // Arrange
      CREATE_SPY.mockResolvedValue(mockEncryptFormUpdated as IFormSchema)

      // Act
      const actualResult = await createFormLogic(
        mockEncryptForm,
        createLogicBody,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(
        expect.objectContaining(createLogicBody),
      )

      expect(CREATE_SPY).toHaveBeenCalledWith(
        mockEncryptFormId,
        createLogicBody,
      )
    })

    it('should return err(FormNotFoundError) if db does not return form object', async () => {
      // Arrange
      CREATE_SPY.mockResolvedValue(undefined as unknown as IFormSchema)

      // Act
      const actualResult = await createFormLogic(
        mockEncryptForm,
        createLogicBody,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new FormNotFoundError())

      expect(CREATE_SPY).toHaveBeenCalledWith(
        mockEncryptFormId,
        createLogicBody,
      )
    })

    it('should return err(DatabaseError) if db returns form object that does not have form_logics array', async () => {
      // Arrange
      const updatedFormWithoutLogic = omit(
        mockEncryptFormUpdated,
        'form_logics',
      )
      CREATE_SPY.mockResolvedValue(updatedFormWithoutLogic as IFormSchema)

      // Act
      const actualResult = await createFormLogic(
        mockEncryptForm,
        createLogicBody,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new DatabaseError())

      expect(CREATE_SPY).toHaveBeenCalledWith(
        mockEncryptFormId,
        createLogicBody,
      )
    })

    it('should return err(DatabaseError) if db returns form object that has empty form_logics array', async () => {
      // Arrange
      const updatedFormWithEmptyLogic = {
        ...mockEncryptFormUpdated,
        form_logics: [],
      }
      CREATE_SPY.mockResolvedValue(updatedFormWithEmptyLogic as IFormSchema)

      // Act
      const actualResult = await createFormLogic(
        mockEncryptForm,
        createLogicBody,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new DatabaseError())

      expect(CREATE_SPY).toHaveBeenCalledWith(
        mockEncryptFormId,
        createLogicBody,
      )
    })
  })

  describe('deleteFormField', () => {
    let deleteSpy: jest.SpyInstance

    beforeEach(() => {
      deleteSpy = jest.spyOn(FormModel, 'deleteFormFieldById')
    })
    it('should return updated form when field deletion is successful', async () => {
      // Arrange
      const fieldToDelete = generateDefaultField(BasicField.Mobile)
      const initialFields = [
        fieldToDelete,
        generateDefaultField(BasicField.Image),
      ]
      const mockUpdatedForm = {
        title: 'some mock form',
        // Append created field to end of form_fields.
        form_fields: [initialFields[1]],
      } as IFormSchema
      const mockForm = {
        title: 'some mock form',
        form_fields: initialFields,
        _id: new ObjectId(),
      } as unknown as IPopulatedForm
      deleteSpy.mockResolvedValueOnce(mockUpdatedForm)

      // Act
      const actual = await deleteFormField(mockForm, String(fieldToDelete._id))

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(mockUpdatedForm)
      expect(deleteSpy).toHaveBeenCalledWith(
        String(mockForm._id),
        fieldToDelete._id,
      )
    })

    it("should return FieldNotFoundError when the fieldId does not exist in the form's fields", async () => {
      // Arrange
      const mockForm = {
        title: 'some mock form',
        form_fields: [generateDefaultField(BasicField.Nric)],
        _id: new ObjectId(),
      } as unknown as IPopulatedForm

      // Act
      const actual = await deleteFormField(
        mockForm,
        new ObjectId().toHexString(),
      )

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FieldNotFoundError())
      expect(deleteSpy).not.toHaveBeenCalled()
    })

    it('should return FormNotFoundError when field deletion returns null', async () => {
      // Arrange
      const fieldToDelete = generateDefaultField(BasicField.Mobile)
      const mockForm = {
        title: 'some mock form',
        form_fields: [fieldToDelete],
        _id: new ObjectId(),
      } as unknown as IPopulatedForm
      deleteSpy.mockResolvedValueOnce(null)

      // Act
      const actual = await deleteFormField(mockForm, fieldToDelete._id)

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FormNotFoundError())
      expect(deleteSpy).toHaveBeenCalledWith(
        String(mockForm._id),
        fieldToDelete._id,
      )
    })
  })

  describe('updateEndPage', () => {
    const updateSpy = jest.spyOn(FormModel, 'updateEndPageById')
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_NEW_END_PAGE: EndPage = {
      title: 'expected end page title',
      buttonLink: 'https://some-button-link.example.com',
      buttonText: 'expected button text',
      paragraph: 'some paragraph',
    }

    it('should return updated end page when update is successful', async () => {
      // Arrange
      const mockUpdatedForm = {
        endPage: MOCK_NEW_END_PAGE,
      } as IFormDocument
      updateSpy.mockResolvedValueOnce(mockUpdatedForm)

      // Act
      const actual = await updateEndPage(MOCK_FORM_ID, MOCK_NEW_END_PAGE)

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(MOCK_NEW_END_PAGE)
    })

    it('should return FormNotFoundError when form cannot be found', async () => {
      // Arrange
      updateSpy.mockResolvedValueOnce(null)

      // Act
      const actual = await updateEndPage(MOCK_FORM_ID, MOCK_NEW_END_PAGE)

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FormNotFoundError())
    })

    it('should return DatabaseError when database model update throws an error', async () => {
      // Arrange
      const expectedErrorMsg = 'some error'
      updateSpy.mockRejectedValueOnce(new Error(expectedErrorMsg))

      // Act
      const actual = await updateEndPage(MOCK_FORM_ID, MOCK_NEW_END_PAGE)

      // Assert
      const actualError = actual._unsafeUnwrapErr()
      expect(actualError).toBeInstanceOf(DatabaseError)
      expect(actualError.message).toIncludeMultiple([
        expectedErrorMsg,
        'Please refresh and try again.',
      ])
    })
  })

  describe('updateStartPage', () => {
    const updateSpy = jest.spyOn(FormModel, 'updateStartPageById')
    const MOCK_FORM_ID = new ObjectId().toHexString()
    const MOCK_NEW_START_PAGE: StartPage = {
      paragraph: 'some paragraph',
      estTimeTaken: 10000000,
    }

    it('should return updated start page when update is successful', async () => {
      // Arrange
      const mockUpdatedForm = {
        startPage: MOCK_NEW_START_PAGE,
      } as IFormDocument
      updateSpy.mockResolvedValueOnce(mockUpdatedForm)

      // Act
      const actual = await updateStartPage(MOCK_FORM_ID, MOCK_NEW_START_PAGE)

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(MOCK_NEW_START_PAGE)
    })

    it('should return FormNotFoundError when form cannot be found', async () => {
      // Arrange
      updateSpy.mockResolvedValueOnce(null)

      // Act
      const actual = await updateStartPage(MOCK_FORM_ID, MOCK_NEW_START_PAGE)

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(new FormNotFoundError())
    })

    it('should return DatabaseError when database model update throws an error', async () => {
      // Arrange
      const expectedErrorMsg = 'some error'
      updateSpy.mockRejectedValueOnce(new Error(expectedErrorMsg))

      // Act
      const actual = await updateStartPage(MOCK_FORM_ID, MOCK_NEW_START_PAGE)

      // Assert
      const actualError = actual._unsafeUnwrapErr()
      expect(actualError).toBeInstanceOf(DatabaseError)
      expect(actualError.message).toIncludeMultiple([
        expectedErrorMsg,
        'Please refresh and try again.',
      ])
    })
  })

  describe('updateFormLogic', () => {
    const logicId1 = new ObjectId()
    const logicId2 = new ObjectId()
    const mockEmailFormId = new ObjectId()
    const mockEncryptFormId = new ObjectId()

    const mockFormLogicOld = {
      form_logics: [
        {
          _id: logicId1,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
        {
          _id: logicId2,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
      ],
    }

    const updatedLogic = {
      _id: logicId1,
      logicType: LogicType.PreventSubmit,
    } as ILogicSchema

    const mockFormLogicUpdated = {
      form_logics: [
        {
          _id: logicId1,
          logicType: LogicType.PreventSubmit,
        } as ILogicSchema,
        {
          _id: logicId2,
          logicType: LogicType.ShowFields,
        } as ILogicSchema,
      ],
    }

    const UPDATE_SPY = jest.spyOn(FormModel, 'updateFormLogic')

    let mockEmailForm: IPopulatedForm,
      mockEncryptForm: IPopulatedForm,
      mockEmailFormUpdated: IPopulatedForm,
      mockEncryptFormUpdated: IPopulatedForm

    beforeEach(() => {
      mockEmailForm = {
        _id: mockEmailFormId,
        status: Status.Public,
        responseMode: ResponseMode.Email,
        ...mockFormLogicOld,
      } as unknown as IPopulatedForm
      mockEncryptForm = {
        _id: mockEncryptFormId,
        status: Status.Public,
        responseMode: ResponseMode.Encrypt,
        ...mockFormLogicOld,
      } as unknown as IPopulatedForm
      mockEmailFormUpdated = {
        ...mockEmailForm,
        ...mockFormLogicUpdated,
      } as unknown as IPopulatedForm
      mockEncryptFormUpdated = {
        ...mockEncryptForm,
        ...mockFormLogicUpdated,
      } as unknown as IPopulatedForm
    })

    it('should return ok(updated logic) on successful form logic update for email mode form', async () => {
      // Arrange
      UPDATE_SPY.mockResolvedValue(mockEmailFormUpdated as IFormSchema)

      // Act
      const actualResult = await updateFormLogic(
        mockEmailForm,
        logicId1.toHexString(),
        updatedLogic,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(updatedLogic)

      expect(UPDATE_SPY).toHaveBeenCalledWith(
        mockEmailForm._id.toHexString(),
        logicId1.toHexString(),
        updatedLogic,
      )
    })

    it('should return ok(updated logic) on successful form logic update for encrypt mode form', async () => {
      // Arrange
      UPDATE_SPY.mockResolvedValue(mockEncryptFormUpdated as IFormSchema)

      // Act
      const actualResult = await updateFormLogic(
        mockEncryptForm,
        logicId1.toHexString(),
        updatedLogic,
      )

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(updatedLogic)

      expect(UPDATE_SPY).toHaveBeenCalledWith(
        mockEncryptFormId.toHexString(),
        logicId1.toHexString(),
        updatedLogic,
      )
    })

    it('should return LogicNotFoundError if logic does not exist on form', async () => {
      // Act
      const wrongLogicId = new ObjectId().toHexString()
      const actualResult = await updateFormLogic(
        mockEmailForm,
        wrongLogicId,
        updatedLogic,
      )

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(new LogicNotFoundError())
      expect(UPDATE_SPY).not.toHaveBeenCalled()
    })
  })

  describe('getFormField', () => {
    it('should return the form field when retrieval is successful', async () => {
      // Arrange
      const MOCK_FIELD = generateDefaultField(BasicField.Image)
      const MOCK_FORM = {
        title: 'some mock form',
        // Append created field to end of form_fields.
        form_fields: [MOCK_FIELD],
        _id: new ObjectId(),
      } as IFormSchema

      // Act
      const actual = await getFormField(MOCK_FORM, String(MOCK_FIELD._id))

      // Assert
      expect(actual._unsafeUnwrap()).toEqual(MOCK_FIELD)
    })

    it("should return FieldNotFoundError when the fieldId does not exist in the form's fields", async () => {
      // Arrange
      const MOCK_ID = new ObjectId().toHexString()
      const MOCK_FORM = {
        title: 'some mock form',
        // Append created field to end of form_fields.
        form_fields: [],
        _id: new ObjectId(),
      } as unknown as IFormSchema
      const expectedError = new FieldNotFoundError(
        `Attempted to retrieve field ${MOCK_ID} from ${MOCK_FORM._id} but field was not present`,
      )

      // Act
      const actual = await getFormField(MOCK_FORM, MOCK_ID)

      // Assert
      expect(actual._unsafeUnwrapErr()).toEqual(expectedError)
    })
  })

  describe('disableSmsVerificationsForUser', () => {
    it('should return true when the forms are updated successfully', async () => {
      // Arrange
      const MOCK_ADMIN_ID = new ObjectId().toHexString()
      const disableSpy = jest.spyOn(FormModel, 'disableSmsVerificationsForUser')
      disableSpy.mockResolvedValueOnce({ n: 0, nModified: 0, ok: 0 })

      // Act
      const expected = await disableSmsVerificationsForUser(MOCK_ADMIN_ID)

      // Assert
      expect(disableSpy).toHaveBeenCalledWith(MOCK_ADMIN_ID)
      expect(expected._unsafeUnwrap()).toEqual(true)
    })

    it('should return a database error when the operation fails', async () => {
      // Arrange
      const MOCK_ADMIN_ID = new ObjectId().toHexString()
      const disableSpy = jest.spyOn(FormModel, 'disableSmsVerificationsForUser')
      disableSpy.mockRejectedValueOnce('whoops')

      // Act
      const expected = await disableSmsVerificationsForUser(MOCK_ADMIN_ID)

      // Assert
      expect(disableSpy).toHaveBeenCalledWith(MOCK_ADMIN_ID)
      expect(expected._unsafeUnwrapErr()).toBeInstanceOf(DatabaseError)
    })
  })

  describe('shouldUpdateFormField', () => {
    const MOCK_FORM = {
      admin: {
        _id: new ObjectId(),
      },
    } as unknown as IPopulatedForm

    const countSpy = jest.spyOn(SmsService, 'retrieveFreeSmsCounts')

    describe('when update form field is not a BasicField.Mobile type', () => {
      const MOCK_RATING_FIELD = generateDefaultField(BasicField.Rating)
      it('should return the form without doing anything', async () => {
        // Act
        const actual = await shouldUpdateFormField(MOCK_FORM, MOCK_RATING_FIELD)

        // Assert
        expect(actual._unsafeUnwrap()).toEqual(MOCK_FORM)
        expect(countSpy).not.toHaveBeenCalled()
      })
    })

    describe('when update form field is a BasicField.Mobile type', () => {
      const MOCK_UNVERIFIABLE_MOBILE_FIELD = generateDefaultField(
        BasicField.Mobile,
      )
      const MOCK_VERIFIABLE_MOBILE_FIELD = generateDefaultField(
        BasicField.Mobile,
        { isVerifiable: true },
      )

      it('should return the given form when the admin is under the free sms limit', async () => {
        // Arrange
        countSpy.mockReturnValueOnce(okAsync(smsConfig.smsVerificationLimit))

        // Act
        const actual = await shouldUpdateFormField(
          MOCK_FORM,
          MOCK_VERIFIABLE_MOBILE_FIELD,
        )

        // Assert
        expect(actual._unsafeUnwrap()).toBe(MOCK_FORM)
      })

      it('should return the given form when the form is onboarded with its own credentials', async () => {
        // Arrange
        const MOCK_ONBOARDED_FORM = { ...MOCK_FORM, msgSrvcName: 'form a form' }

        // Act
        const actual = await shouldUpdateFormField(
          MOCK_ONBOARDED_FORM,
          MOCK_VERIFIABLE_MOBILE_FIELD,
        )

        // Assert
        expect(countSpy).not.toHaveBeenCalled()
        expect(actual._unsafeUnwrap()).toEqual(MOCK_ONBOARDED_FORM)
      })

      it('should return the given form when mobile field is not verifiable', async () => {
        // Act
        const actual = await shouldUpdateFormField(
          MOCK_FORM,
          MOCK_UNVERIFIABLE_MOBILE_FIELD,
        )

        // Assert
        expect(countSpy).not.toHaveBeenCalled()
        expect(actual._unsafeUnwrap()).toEqual(MOCK_FORM)
      })

      it('should return sms retrieval error when sms limit exceeded and the given form has not been onboarded', async () => {
        // Arrange
        countSpy.mockReturnValueOnce(
          okAsync(smsConfig.smsVerificationLimit + 1),
        )

        // Act
        const actual = await shouldUpdateFormField(
          MOCK_FORM,
          MOCK_VERIFIABLE_MOBILE_FIELD,
        )

        // Assert
        expect(actual._unsafeUnwrapErr()).toEqual(new SmsLimitExceededError())
      })

      it('should propagate any database errors encountered during retrieval', async () => {
        // Arrange
        const MOCK_ERROR_STRING = 'something went oopsie'
        const expectedError = new DatabaseError(MOCK_ERROR_STRING)
        countSpy.mockReturnValueOnce(errAsync(expectedError))

        // Act
        const actual = await shouldUpdateFormField(
          MOCK_FORM,
          MOCK_VERIFIABLE_MOBILE_FIELD,
        )

        // Assert
        expect(actual._unsafeUnwrapErr()).toBe(expectedError)
      })
    })
  })
})
