import { ObjectId } from 'bson-ext'
import { cloneDeep, omit, tail } from 'lodash'

import { EditFieldActions } from 'src/shared/constants'
import {
  BasicField,
  FormFieldSchema,
  IEmailFieldSchema,
  IPopulatedForm,
  IPopulatedUser,
  Permission,
  ResponseMode,
  Status,
} from 'src/types'
import { DuplicateFormBodyDto, EditFormFieldParams } from 'src/types/api'

import { generateDefaultField } from 'tests/unit/backend/helpers/generate-form-data'

import { ForbiddenFormError } from '../../form.errors'
import { EditFieldError } from '../admin-form.errors'
import { OverrideProps } from '../admin-form.types'
import {
  assertHasDeletePermissions,
  assertHasReadPermissions,
  assertHasWritePermissions,
  getUpdatedFormFields,
  processDuplicateOverrideProps,
} from '../admin-form.utils'

describe('admin-form.utils', () => {
  const MOCK_VALID_ADMIN_ID = new ObjectId()
  const MOCK_VALID_ADMIN_EMAIL = 'test@example.com'
  const MOCK_USER = {
    _id: MOCK_VALID_ADMIN_ID,
    email: MOCK_VALID_ADMIN_EMAIL,
  } as IPopulatedUser

  describe('assertHasReadPermissions', () => {
    it('should return true when user is form admin', async () => {
      // Arrange
      const mockForm = {
        title: 'mockForm',
        status: Status.Private,
        _id: new ObjectId(),
        // User is form admin.
        admin: MOCK_USER,
      } as IPopulatedForm

      // Act
      const actualResult = assertHasReadPermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(true)
    })

    it('should return true when user has read permissions', async () => {
      // Arrange
      // Form is owned by another admin, but MOCK_USER has permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        // But MOCK_USER has permissions..
        permissionList: [{ email: MOCK_USER.email }],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasReadPermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(true)
    })

    it('should return ForbiddenFormError when user does not have read permissions', async () => {
      // Arrange
      // Form is owned by another admin, and MOCK_USER does not have
      // permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin, no permissionsList.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        permissionList: [] as Permission[],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasReadPermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new ForbiddenFormError(
          `User ${MOCK_USER.email} not authorized to perform read operation on Form ${mockForm._id} with title: ${mockForm.title}.`,
        ),
      )
    })
  })

  describe('assertHasWritePermissions', () => {
    it('should return true when user is form admin', async () => {
      // Arrange
      const mockForm = {
        title: 'mockForm',
        status: Status.Private,
        _id: new ObjectId(),
        // User is form admin.
        admin: MOCK_USER,
      } as IPopulatedForm

      // Act
      const actualResult = assertHasWritePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(true)
    })

    it('should return true when user has write permissions', async () => {
      // Arrange
      // Form is owned by another admin, but MOCK_USER has permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        // But MOCK_USER has write permissions.
        permissionList: [{ email: MOCK_USER.email, write: true }],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasWritePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(true)
    })

    it('should return ForbiddenFormError when user has read but not write permissions', async () => {
      // Arrange
      // Form is owned by another admin, and MOCK_USER does not have
      // permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin, no permissionsList.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        // Only read permissions.
        permissionList: [{ email: MOCK_USER.email }],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasWritePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new ForbiddenFormError(
          `User ${MOCK_USER.email} not authorized to perform write operation on Form ${mockForm._id} with title: ${mockForm.title}.`,
        ),
      )
    })

    it('should return ForbiddenFormError when user does not exist in permission list', async () => {
      // Arrange
      // Form is owned by another admin, and MOCK_USER does not have
      // permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin, no permissionsList.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        permissionList: [] as Permission[],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasWritePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new ForbiddenFormError(
          `User ${MOCK_USER.email} not authorized to perform write operation on Form ${mockForm._id} with title: ${mockForm.title}.`,
        ),
      )
    })
  })

  describe('assertHasDeletePermissions', () => {
    it('should return true when user is form admin', async () => {
      // Arrange
      const mockForm = {
        title: 'mockForm',
        status: Status.Private,
        _id: new ObjectId(),
        // User is form admin.
        admin: MOCK_USER,
      } as IPopulatedForm

      // Act
      const actualResult = assertHasDeletePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isOk()).toEqual(true)
      expect(actualResult._unsafeUnwrap()).toEqual(true)
    })

    it('should return ForbiddenFormError when user is not admin even with read permissions', async () => {
      // Arrange
      // Form is owned by another admin, but MOCK_USER has permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        // But MOCK_USER has permissions..
        permissionList: [{ email: MOCK_USER.email }],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasDeletePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new ForbiddenFormError(
          `User ${MOCK_USER.email} not authorized to perform delete operation on Form ${mockForm._id} with title: ${mockForm.title}.`,
        ),
      )
    })

    it('should return ForbiddenFormError when user is not admin even with write permissions', async () => {
      // Arrange
      // Form is owned by another admin, but MOCK_USER has permissions.
      const mockForm = {
        title: 'mockForm',
        status: Status.Public,
        _id: new ObjectId(),
        // New admin.
        admin: {
          _id: new ObjectId(),
        } as IPopulatedUser,
        // But MOCK_USER has permissions.
        permissionList: [{ email: MOCK_USER.email, write: true }],
      } as IPopulatedForm

      // Act
      const actualResult = assertHasDeletePermissions(MOCK_USER, mockForm)

      // Assert
      expect(actualResult.isErr()).toEqual(true)
      expect(actualResult._unsafeUnwrapErr()).toEqual(
        new ForbiddenFormError(
          `User ${MOCK_USER.email} not authorized to perform delete operation on Form ${mockForm._id} with title: ${mockForm.title}.`,
        ),
      )
    })
  })

  describe('processDuplicateOverrideProps', () => {
    it('should return processed props for ResponseMode.Encrypt', async () => {
      // Arrange
      const newAdminId = new ObjectId().toHexString()
      const params: DuplicateFormBodyDto = {
        responseMode: ResponseMode.Encrypt,
        publicKey: 'some public key',
        title: 'some title',
      }

      // Act
      const actual = processDuplicateOverrideProps(params, newAdminId)

      // Assert
      const expected: OverrideProps = {
        responseMode: params.responseMode,
        title: params.title,
        admin: newAdminId,
        publicKey: params.publicKey,
      }
      expect(actual).toEqual(expected)
    })

    it('should return processed props for ResponseMode.Email', async () => {
      // Arrange
      const newAdminId = new ObjectId().toHexString()
      const params: DuplicateFormBodyDto = {
        responseMode: ResponseMode.Email,
        emails: ['some@example.com', 'another@example.com'],
        title: 'some title',
      }

      // Act
      const actual = processDuplicateOverrideProps(params, newAdminId)

      // Assert
      const expected: OverrideProps = {
        responseMode: params.responseMode,
        title: params.title,
        admin: newAdminId,
        emails: params.emails,
      }
      expect(actual).toEqual(expected)
    })
  })

  describe('getUpdatedFormFields', () => {
    const INITIAL_FIELDS = [
      generateDefaultField(BasicField.Mobile),
      generateDefaultField(BasicField.Checkbox),
      generateDefaultField(BasicField.Table),
    ]

    it('should return updated fields successfully on create action', async () => {
      // Arrange
      const newField = generateDefaultField(BasicField.Decimal)
      const newFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Create },
        field: newField,
      }

      // Act
      const actualResult = getUpdatedFormFields(INITIAL_FIELDS, newFieldParams)

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual([
        ...INITIAL_FIELDS,
        newField,
      ])
    })

    it('should return updated fields successfully on delete action', async () => {
      // Arrange
      const fieldToDelete = cloneDeep(INITIAL_FIELDS[0])
      const deleteFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Delete },
        field: fieldToDelete,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        deleteFieldParams,
      )

      // Assert
      // First item should be removed.
      expect(actualResult._unsafeUnwrap()).toEqual(INITIAL_FIELDS.slice(1))
    })

    it('should return updated fields successfully on duplicate action', async () => {
      // Arrange
      // Remove globalId from duplicate.
      const duplicateField = omit(cloneDeep(INITIAL_FIELDS[1]), [
        'globalId',
      ]) as FormFieldSchema
      const dupeFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Duplicate },
        field: duplicateField,
      }

      // Act
      const actualResult = getUpdatedFormFields(INITIAL_FIELDS, dupeFieldParams)

      // Assert
      expect(actualResult._unsafeUnwrap()).toEqual([
        ...INITIAL_FIELDS,
        duplicateField,
      ])
    })

    it('should return updated fields successfully on reorder action', async () => {
      // Arrange
      const firstField = cloneDeep(INITIAL_FIELDS[0])
      const reorderFieldParams: EditFormFieldParams = {
        action: {
          name: EditFieldActions.Reorder,
          position: INITIAL_FIELDS.length - 1,
        },
        field: firstField,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        reorderFieldParams,
      )

      // Assert
      // First element should be reordered to the last element.
      expect(actualResult._unsafeUnwrap()).toEqual([
        ...tail(INITIAL_FIELDS),
        firstField,
      ])
    })

    it('should return updated fields successfully on update action', async () => {
      // Arrange
      const fieldToUpdate = {
        ...INITIAL_FIELDS[0],
        title: 'some new title!!!',
      } as FormFieldSchema

      const updateFieldParams: EditFormFieldParams = {
        action: {
          name: EditFieldActions.Update,
        },
        field: fieldToUpdate,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        updateFieldParams,
      )

      // Assert
      // First element should be updated.
      expect(actualResult._unsafeUnwrap()).toEqual([
        fieldToUpdate,
        ...tail(INITIAL_FIELDS),
      ])
    })

    it('should return synced email field when updating with desynced email field', async () => {
      // Arrange
      const initialField = generateDefaultField(BasicField.Email, {
        title: 'some old title',
      })
      const desyncedEmailField = {
        ...initialField,
        title: 'new title',
        hasAllowedEmailDomains: true,
        // true but empty array
        allowedEmailDomains: [],
      } as unknown as IEmailFieldSchema

      const updateFieldParams: EditFormFieldParams = {
        action: {
          name: EditFieldActions.Update,
        },
        field: desyncedEmailField,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        [initialField],
        updateFieldParams,
      )

      // Assert
      // Email field should be updated but synced
      expect(actualResult._unsafeUnwrap()).toEqual([
        // hasAllowedEmailDomains should be false since allowedEmailDomains is empty
        {
          ...desyncedEmailField,
          hasAllowedEmailDomains: false,
          allowedEmailDomains: [],
        },
      ])
    })

    it('should return synced email field when creating with desynced email field', async () => {
      // Arrange
      const desyncedEmailField = {
        ...generateDefaultField(BasicField.Email),
        hasAllowedEmailDomains: false,
        // False but contains domains.
        allowedEmailDomains: ['@example.com'],
      } as unknown as IEmailFieldSchema

      const createFieldParams: EditFormFieldParams = {
        action: {
          name: EditFieldActions.Create,
        },
        field: desyncedEmailField,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        createFieldParams,
      )

      // Assert
      // Email field should be updated but synced
      expect(actualResult._unsafeUnwrap()).toEqual([
        ...INITIAL_FIELDS,
        // allowedEmailDomains should be empty since hasAllowedEmailDomains is false
        {
          ...desyncedEmailField,
          hasAllowedEmailDomains: false,
          allowedEmailDomains: [],
        },
      ])
    })

    it('should return EditFieldError when field to be created already exists', async () => {
      // Arrange
      const existingField = cloneDeep(INITIAL_FIELDS[0])
      const newFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Create },
        field: existingField,
      }

      // Act
      const actualResult = getUpdatedFormFields(INITIAL_FIELDS, newFieldParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(EditFieldError)
    })

    it('should return EditFieldError when field to be duplicated already exists', async () => {
      // Arrange
      const existingField = cloneDeep(INITIAL_FIELDS[1])
      const dupeFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Duplicate },
        field: existingField,
      }

      // Act
      const actualResult = getUpdatedFormFields(INITIAL_FIELDS, dupeFieldParams)

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(EditFieldError)
    })

    it('should return EditFieldError when field to be deleted does not exist', async () => {
      // Arrange
      const newFieldToDelete = generateDefaultField(BasicField.Decimal)
      const deleteFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Delete },
        field: newFieldToDelete,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        deleteFieldParams,
      )

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(EditFieldError)
    })

    it('should return EditFieldError when field to be reordered does not exist', async () => {
      // Arrange
      const newFieldToReorder = generateDefaultField(BasicField.Dropdown)
      const reorderFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Reorder, position: 2 },
        field: newFieldToReorder,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        reorderFieldParams,
      )

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(EditFieldError)
    })

    it('should return EditFieldError when field to be updated does not exist', async () => {
      // Arrange
      const newFieldToUpdate = generateDefaultField(BasicField.Email)
      const updateFieldParams: EditFormFieldParams = {
        action: { name: EditFieldActions.Update },
        field: newFieldToUpdate,
      }

      // Act
      const actualResult = getUpdatedFormFields(
        INITIAL_FIELDS,
        updateFieldParams,
      )

      // Assert
      expect(actualResult._unsafeUnwrapErr()).toBeInstanceOf(EditFieldError)
    })
  })
})
