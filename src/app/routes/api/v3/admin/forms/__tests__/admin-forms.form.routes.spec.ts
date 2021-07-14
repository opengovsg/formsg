/* eslint-disable @typescript-eslint/ban-ts-comment */
import { ObjectId } from 'bson-ext'
import { omit } from 'lodash'
import mongoose from 'mongoose'
import { err, errAsync, okAsync } from 'neverthrow'
import supertest, { Session } from 'supertest-session'

import getFormModel, {
  getEmailFormModel,
  getEncryptedFormModel,
} from 'src/app/models/form.server.model'
import getUserModel from 'src/app/models/user.server.model'
import * as AuthService from 'src/app/modules/auth/auth.service'
import {
  DatabaseError,
  DatabasePayloadSizeError,
} from 'src/app/modules/core/core.errors'
import {
  BasicField,
  Colors,
  FormLogoState,
  IPopulatedForm,
  IUserSchema,
  ResponseMode,
  StartPage,
  Status,
} from 'src/types'

import {
  createAuthedSession,
  logoutSession,
} from 'tests/integration/helpers/express-auth'
import { setupApp } from 'tests/integration/helpers/express-setup'
import { buildCelebrateError } from 'tests/unit/backend/helpers/celebrate'
import { generateDefaultField } from 'tests/unit/backend/helpers/generate-form-data'
import dbHandler from 'tests/unit/backend/helpers/jest-db'
import { jsonParseStringify } from 'tests/unit/backend/helpers/serialize-data'

import * as AdminFormService from '../../../../../../modules/form/admin-form/admin-form.service'
import { AdminFormsRouter } from '../admin-forms.routes'

// Prevent rate limiting.
jest.mock('src/app/utils/limit-rate')
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}))

const UserModel = getUserModel(mongoose)
const FormModel = getFormModel(mongoose)
const EmailFormModel = getEmailFormModel(mongoose)
const EncryptFormModel = getEncryptedFormModel(mongoose)

const app = setupApp('/admin/forms', AdminFormsRouter, {
  setupWithAuth: true,
})

describe('admin-form.form.routes', () => {
  let request: Session
  let defaultUser: IUserSchema

  beforeAll(async () => await dbHandler.connect())
  beforeEach(async () => {
    request = supertest(app)
    const { user } = await dbHandler.insertFormCollectionReqs()
    // Default all requests to come from authenticated user.
    request = await createAuthedSession(user.email, request)
    defaultUser = user
  })
  afterEach(async () => {
    await dbHandler.clearDatabase()
    jest.restoreAllMocks()
  })
  afterAll(async () => await dbHandler.closeDatabase())

  describe('GET /admin/forms', () => {
    it('should return 200 with empty array when user has no forms', async () => {
      // Act
      const response = await request.get('/admin/forms')

      // Assert
      expect(response.status).toEqual(200)
      expect(response.body).toEqual([])
    })

    it('should return 200 with a list of forms managed by the user', async () => {
      // Arrange
      // Create separate user
      const collabUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'collab-user',
          shortName: 'collabUser',
        })
      ).user

      const ownForm = await EmailFormModel.create({
        title: 'Own form',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      const collabForm = await EncryptFormModel.create({
        title: 'Collab form',
        publicKey: 'some public key',
        admin: collabUser._id,
        permissionList: [{ email: defaultUser.email }],
      })
      // Create already archived form, should not be fetched even though
      // owner is defaultUser
      await EmailFormModel.create({
        title: 'Archived form',
        emails: defaultUser.email,
        admin: defaultUser._id,
        status: Status.Archived,
      })
      // Create form that user is not collaborator/admin of. Should not be
      // fetched.
      await EncryptFormModel.create({
        title: 'Does not matter',
        publicKey: 'abracadabra',
        admin: collabUser._id,
        // No permissions for anyone else.
      })

      // Act
      const response = await request.get('/admin/forms')

      // Assert
      // Should only receive ownForm and collabForm
      const expected = await FormModel.find({
        _id: {
          $in: [ownForm._id, collabForm._id],
        },
      })
        .select('_id title admin lastModified status responseMode')
        .sort('-lastModified')
        .populate({
          path: 'admin',
          populate: {
            path: 'agency',
          },
        })
        .lean()
      expect(response.body).toEqual(jsonParseStringify(expected))
      expect(response.status).toEqual(200)
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)

      // Act
      const response = await request.get('/admin/forms')

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 422 when user of given id cannot be found in the database', async () => {
      // Arrange
      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request.get('/admin/forms')

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database errors occur', async () => {
      // Arrange
      // Mock database error.
      jest
        .spyOn(FormModel, 'getMetaByUserIdOrEmail')
        .mockRejectedValueOnce(new Error('something went wrong'))

      // Act
      const response = await request.get('/admin/forms')

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: 'Something went wrong. Please try again.',
      })
    })
  })

  describe('POST /admin/forms', () => {
    it('should return 200 with newly created email mode form', async () => {
      // Arrange
      const createEmailParams = {
        form: {
          emails: defaultUser.email,
          responseMode: 'email',
          title: 'email mode form test',
          // Extra keys should be fine.
          someExtraKey: 'extra value that will be ignored.',
        },
      }

      // Act
      const response = await request
        .post('/admin/forms')
        .send(createEmailParams)

      // Assert
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(
        expect.objectContaining({
          admin: String(defaultUser._id),
          emails: [defaultUser.email],
          responseMode: ResponseMode.Email,
          status: Status.Private,
          title: createEmailParams.form.title,
          form_fields: [],
          form_logics: [],
        }),
      )
    })

    it('should return 200 with newly created storage mode form', async () => {
      // Arrange
      const createStorageParams = {
        form: {
          responseMode: 'encrypt',
          title: 'storage mode form test',
          publicKey: 'some random public key',
        },
      }

      // Act
      const response = await request
        .post('/admin/forms')
        .send(createStorageParams)

      // Assert
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(
        expect.objectContaining({
          admin: String(defaultUser._id),
          publicKey: createStorageParams.form.publicKey,
          responseMode: ResponseMode.Encrypt,
          status: Status.Private,
          title: createStorageParams.form.title,
          form_fields: [],
          form_logics: [],
        }),
      )
    })

    it('should return 400 when body.form.publicKey is missing', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          responseMode: 'encrypt',
          title: 'storage mode form test',
          // Missing publicKey value.
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({ body: { key: 'form.publicKey' } }),
      )
    })

    it('should return 400 when body.form.responseMode is missing', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          // responseMode missing.
          title: 'storage mode form test',
          emails: 'some@example.com',
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({ body: { key: 'form.responseMode' } }),
      )
    })

    it('should return 400 when body.form.title is missing', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          // title is missing.
          responseMode: ResponseMode.Email,
          emails: 'some@example.com',
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({ body: { key: 'form.title' } }),
      )
    })

    it('should return 400 when body.form.emails is missing when creating an email form', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          title: 'new email form',
          responseMode: ResponseMode.Email,
          // body.emails missing.
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'form.emails' },
        }),
      )
    })

    it('should return 400 when body.form.emails is an empty string when creating an email form', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          title: 'new email form',
          responseMode: ResponseMode.Email,
          emails: '',
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'form.emails',
            message: '"form.emails" is not allowed to be empty',
          },
        }),
      )
    })

    it('should return 400 when body.form.emails is an empty array when creating an email form', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          title: 'new email form',
          responseMode: ResponseMode.Email,
          emails: [],
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'form.emails',
            message: '"form.emails" must contain at least 1 items',
          },
        }),
      )
    })

    it('should return 400 when body.form.publicKey is missing when creating a storage mode form', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          title: 'new storage mode form',
          responseMode: ResponseMode.Encrypt,
          // publicKey missing.
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'form.publicKey',
          },
        }),
      )
    })

    it('should return 400 when body.form.publicKey is an empty string when creating a storage mode form', async () => {
      // Act
      const response = await request.post('/admin/forms').send({
        form: {
          title: 'new storage mode form',
          responseMode: ResponseMode.Encrypt,
          publicKey: '',
        },
      })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'form.publicKey',
            message: '"form.publicKey" contains an invalid value',
          },
        }),
      )
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)

      // Act
      const response = await request
        .post('/admin/forms')
        .send('does not matter')

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 413 when a payload for created form exceeds the size limit', async () => {
      // Arrange
      const createStorageParams = {
        form: {
          responseMode: 'encrypt',
          title: 'storage mode form test',
          publicKey: 'some random public key',
        },
      }

      const payloadSizeError = new DatabasePayloadSizeError(
        'Creating a real > 16MB file in tests did not seem like a good idea',
      )
      jest
        .spyOn(AdminFormService, 'createForm')
        .mockReturnValueOnce(errAsync(payloadSizeError))

      // Act
      const response = await request
        .post('/admin/forms')
        .send(createStorageParams)

      // Assert
      expect(response.status).toEqual(413)
      expect(response.body).toEqual({ message: payloadSizeError.message })
    })

    it('should return 422 when user cannot be found in the database', async () => {
      // Arrange
      const createEmailParams = {
        form: {
          emails: defaultUser.email,
          responseMode: 'email',
          title: 'email mode form test',
        },
      }
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request
        .post('/admin/forms')
        .send(createEmailParams)

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 422 when form creation results in a database validation error', async () => {
      // Arrange
      const emailParamsWithInvalidDomain = {
        form: {
          emails: defaultUser.email,
          responseMode: 'email',
          title: 'email mode form test should fail',
          permissionList: [{ email: 'invalidEmailDomain@example.com' }],
        },
      }

      // Act
      const response = await request
        .post('/admin/forms')
        .send(emailParamsWithInvalidDomain)

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({
        message:
          'Error: [Failed to update collaborators list.]. Please refresh and try again. If you still need help, email us at form@open.gov.sg.',
      })
    })

    it('should return 500 when database error occurs whilst creating a form', async () => {
      // Arrange
      const createStorageParams = {
        form: {
          responseMode: 'encrypt',
          title: 'storage mode form test',
          publicKey: 'some random public key',
        },
      }

      const databaseError = new DatabaseError('something went wrong')
      jest
        .spyOn(AdminFormService, 'createForm')
        .mockReturnValueOnce(errAsync(databaseError))

      // Act
      const response = await request
        .post('/admin/forms')
        .send(createStorageParams)

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: databaseError.message,
      })
    })
  })

  describe('GET /admin/forms/:formId', () => {
    it('should return 200 with retrieved form when user is admin', async () => {
      // Arrange
      const ownForm = await EmailFormModel.create({
        title: 'Own form',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })

      const response = await request.get(`/admin/forms/${ownForm._id}`)
      // Act

      // Assert
      const expected = await FormModel.findById(ownForm._id)
        .populate({
          path: 'admin',
          populate: {
            path: 'agency',
          },
        })
        .lean()
      expect(response.status).toEqual(200)
      expect(response.body).not.toBeNull()
      expect(response.body).toEqual({
        form: jsonParseStringify(expected),
      })
    })

    it('should return 200 with retrieved form when user has read permissions', async () => {
      // Arrange
      // Create separate user
      const collabUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'collab-user',
          shortName: 'collabUser',
        })
      ).user

      const collabForm = await EncryptFormModel.create({
        title: 'Collab form',
        publicKey: 'some public key',
        admin: collabUser._id,
        permissionList: [{ email: defaultUser.email, write: false }],
      })

      // Act
      const response = await request.get(`/admin/forms/${collabForm._id}`)

      // Assert
      const expected = await FormModel.findById(collabForm._id)
        .populate({
          path: 'admin',
          populate: {
            path: 'agency',
          },
        })
        .lean()
      expect(response.status).toEqual(200)
      expect(response.body).not.toBeNull()
      expect(response.body).toEqual({
        form: jsonParseStringify(expected),
      })
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)

      // Act
      const response = await request.get(`/admin/forms/${new ObjectId()}`)

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 403 when user does not have read permissions to form', async () => {
      // Arrange
      const anotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user
      // Form that defaultUser has no access to.
      const inaccessibleForm = await EncryptFormModel.create({
        title: 'Collab form',
        publicKey: 'some public key',
        admin: anotherUser._id,
        permissionList: [],
      })

      // Act
      const response = await request.get(`/admin/forms/${inaccessibleForm._id}`)

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: expect.stringContaining(
          'not authorized to perform read operation',
        ),
      })
    })

    it('should return 404 when form cannot be found', async () => {
      // Arrange
      const invalidFormId = new ObjectId().toHexString()

      // Act
      const response = await request.get(`/admin/forms/${invalidFormId}`)

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({ message: 'Form not found' })
    })

    it('should return 410 when form to retrieve is archived', async () => {
      // Arrange
      const archivedForm = await EncryptFormModel.create({
        title: 'archived form',
        status: Status.Archived,
        responseMode: ResponseMode.Encrypt,
        publicKey: 'does not matter',
        admin: defaultUser._id,
      })

      // Act
      const response = await request.get(`/admin/forms/${archivedForm._id}`)

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when user in session cannot be retrieved from the database', async () => {
      // Arrange
      // Clear user collection
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request.get(`/admin/forms/${new ObjectId()}`)

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database error occurs whilst retrieving form', async () => {
      // Arrange
      jest
        .spyOn(FormModel, 'getFullFormById')
        .mockRejectedValueOnce(new Error('some error'))

      // Act
      const response = await request.get(`/admin/forms/${new ObjectId()}`)

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: 'Something went wrong. Please try again.',
      })
    })
  })

  describe('DELETE /admin/forms/:formId', () => {
    it('should return 200 with success message when form is successfully archived', async () => {
      // Arrange
      const formToArchive = await EmailFormModel.create({
        title: 'Form to archive',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      expect(formToArchive.status).toEqual(Status.Private)

      // Act
      const response = await request.delete(`/admin/forms/${formToArchive._id}`)

      // Assert
      const form = await EmailFormModel.findById(formToArchive._id)
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: 'Form has been archived' })
      expect(form?.status).toEqual(Status.Archived)
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)
      const formToArchive = await EmailFormModel.create({
        title: 'Form to archive',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })

      // Act
      const response = await request.delete(`/admin/forms/${formToArchive._id}`)

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 403 when user does not have permissions to archive form', async () => {
      // Arrange
      // Create separate user
      const collabUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'collab-user',
          shortName: 'collabUser',
        })
      ).user
      const randomForm = await EncryptFormModel.create({
        title: 'form that user has no delete access to',
        admin: collabUser._id,
        publicKey: 'some random key',
        // Current user only has write access but not admin.
        permissionList: [{ email: defaultUser.email, write: true }],
      })

      // Act
      const response = await request.delete(`/admin/forms/${randomForm._id}`)

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: `User ${defaultUser.email} not authorized to perform delete operation on Form ${randomForm._id} with title: ${randomForm.title}.`,
      })
    })

    it('should return 404 when form to archive cannot be found', async () => {
      // Arrange
      const invalidFormId = new ObjectId()

      // Act
      const response = await request.delete(`/admin/forms/${invalidFormId}`)

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({ message: 'Form not found' })
    })

    it('should return 410 when form is already archived', async () => {
      // Arrange
      // Create archived form.
      const archivedForm = await EmailFormModel.create({
        title: 'Form already archived',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        status: Status.Archived,
      })

      // Act
      const response = await request.delete(`/admin/forms/${archivedForm._id}`)

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when user in session cannot be found in the database', async () => {
      // Arrange
      const formToArchive = await EmailFormModel.create({
        title: 'Form to archive',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request.delete(`/admin/forms/${formToArchive._id}`)

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database error occurs whilst archiving form', async () => {
      // Arrange
      const formToArchive = await EmailFormModel.create({
        title: 'Form to archive',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      // Mock database error during archival.
      jest
        .spyOn(AdminFormService, 'archiveForm')
        .mockReturnValueOnce(errAsync(new DatabaseError()))

      // Act
      const response = await request.delete(`/admin/forms/${formToArchive._id}`)

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: 'Something went wrong. Please try again.',
      })
    })
  })

  describe('POST /admin/forms/:formId/duplicate', () => {
    it('should return 200 with the duplicated form dashboard view', async () => {
      // Arrange
      // Create form.
      const formToDupe = await EmailFormModel.create({
        title: 'Original form title',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })

      const dupeParams = {
        responseMode: ResponseMode.Encrypt,
        title: 'new duplicated form title',
        publicKey: 'some public key',
      }

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send(dupeParams)

      // Assert
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(
        expect.objectContaining({
          _id: expect.any(String),
          admin: expect.objectContaining({
            _id: String(defaultUser._id),
          }),
          responseMode: dupeParams.responseMode,
          title: dupeParams.title,
          status: Status.Private,
        }),
      )
    })

    it('should return 400 when body.emails is missing when duplicating to an email form', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'new email form',
          responseMode: ResponseMode.Email,
          // body.emails missing.
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'emails' },
        }),
      )
    })

    it('should return 400 when body.emails is an empty string when duplicating to an email form', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'new email form',
          responseMode: ResponseMode.Email,
          emails: '',
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'emails',
            message: '"emails" is not allowed to be empty',
          },
        }),
      )
    })

    it('should return 400 when body.emails is an empty array when duplicating to an email form', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'new email form',
          responseMode: ResponseMode.Email,
          emails: [],
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'emails',
            message: '"emails" must contain at least 1 items',
          },
        }),
      )
    })

    it('should return 400 when body.publicKey is missing when duplicating to a storage mode form', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'new storage mode form',
          responseMode: ResponseMode.Encrypt,
          // publicKey missing.
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'publicKey',
          },
        }),
      )
    })

    it('should return 400 when body.publicKey is an empty string when duplicating to a storage mode form', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'new storage mode form',
          responseMode: ResponseMode.Encrypt,
          publicKey: '',
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: {
            key: 'publicKey',
            message: '"publicKey" contains an invalid value',
          },
        }),
      )
    })

    it('should return 400 when body.title is missing', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          // title is missing.
          responseMode: ResponseMode.Email,
          emails: 'test@example.com',
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'title' },
        }),
      )
    })

    it('should return 400 when body.responseMode is missing', async () => {
      // Arrange
      const formToDupe = await EncryptFormModel.create({
        title: 'some form',
        admin: defaultUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send({
          title: 'something',
          // responseMode missing.
          emails: 'test@example.com',
        })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'responseMode' },
        }),
      )
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)
      // Create form.
      const formToDupe = await EmailFormModel.create({
        title: 'Original form title',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send('does not matter')

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 403 when user does not have read permissions to form', async () => {
      // Arrange
      // Create separate user
      const someUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user
      const randomForm = await EncryptFormModel.create({
        title: 'form that user has no delete access to',
        admin: someUser._id,
        publicKey: 'some random key',
        // Current user has no access to this form,
        permissionList: [],
      })

      // Act
      const response = await request
        .post(`/admin/forms/${randomForm._id}/duplicate`)
        .send({
          responseMode: ResponseMode.Encrypt,
          title: 'new duplicated form title',
          publicKey: 'some public key',
        })

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: `User ${defaultUser.email} not authorized to perform read operation on Form ${randomForm._id} with title: ${randomForm.title}.`,
      })
    })

    it('should return 404 when form to duplicate cannot be found', async () => {
      // Arrange
      const invalidFormId = new ObjectId()

      // Act
      const response = await request
        .post(`/admin/forms/${invalidFormId}/duplicate`)
        .send({
          responseMode: ResponseMode.Encrypt,
          title: 'new duplicated form title',
          publicKey: 'some public key',
        })

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({ message: 'Form not found' })
    })

    it('should return 410 when form is already archived', async () => {
      // Arrange
      // Create archived form.
      const archivedForm = await EmailFormModel.create({
        title: 'Form already archived',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        status: Status.Archived,
      })

      // Act
      const response = await request
        .post(`/admin/forms/${archivedForm._id}/duplicate`)
        .send({
          responseMode: ResponseMode.Email,
          emails: 'anyrandomEmail@example.com',
          title: 'cool new title',
        })

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when user in session cannot be found in the database', async () => {
      // Arrange
      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request
        .post(`/admin/forms/${new ObjectId()}/duplicate`)
        .send({
          responseMode: ResponseMode.Encrypt,
          title: 'does not matter',
          publicKey: 'some public key',
        })

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database error occurs whilst duplicating form', async () => {
      // Arrange
      // Create form.
      const formToDupe = await EmailFormModel.create({
        title: 'Original form title',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })

      // Force validation error that will be returned as database error
      // TODO(#614): Return transformMongoError instead of DatabaseError for better mongoose error handling.
      const invalidEmailDupeParams = {
        responseMode: ResponseMode.Email,
        emails: 'notAnEmail, should return error',
        title: 'cool new title',
      }

      // Act
      const response = await request
        .post(`/admin/forms/${formToDupe._id}/duplicate`)
        .send(invalidEmailDupeParams)

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: expect.stringContaining(
          'Please provide valid email addresses',
        ),
      })
    })
  })

  describe('POST /admin/forms/:formId/collaborators/transfer-owner', () => {
    it('should return 200 with updated form and owner transferred', async () => {
      // Arrange
      const formToTransfer = await EmailFormModel.create({
        title: 'Original form title',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      const newOwner = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'new-owner',
          shortName: 'newOwner',
        })
      ).user

      // Act
      const response = await request
        .post(`/admin/forms/${formToTransfer._id}/collaborators/transfer-owner`)
        .send({
          email: newOwner.email,
        })

      // Assert
      const expected = {
        form: expect.objectContaining({
          _id: String(formToTransfer._id),
          // Admin should be new owner.
          admin: expect.objectContaining({
            _id: String(newOwner._id),
          }),
          // Original owner should still have write permissions.
          permissionList: [
            expect.objectContaining({
              email: defaultUser.email,
              write: true,
            }),
          ],
        }),
      }
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(expected)
    })

    it('should return 400 when body.email is missing', async () => {
      // Arrange
      const someFormId = new ObjectId().toHexString()

      // Act
      const response = await request
        .post(`/admin/forms/${someFormId}/collaborators/transfer-owner`)
        // Missing email.
        .send({})

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({ body: { key: 'email' } }),
      )
    })

    it('should return 400 when body.email is an invalid email', async () => {
      // Arrange
      const someFormId = new ObjectId().toHexString()

      // Act
      const response = await request
        .post(`/admin/forms/${someFormId}/collaborators/transfer-owner`)
        .send({ email: 'not an email' })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'email', message: 'Please enter a valid email' },
        }),
      )
    })

    it('should return 400 when body.email contains multiple emails', async () => {
      // Arrange
      const someFormId = new ObjectId().toHexString()

      // Act
      const response = await request
        .post(`/admin/forms/${someFormId}/collaborators/transfer-owner`)
        .send({ email: 'first@example.com,second@example.com' })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual(
        buildCelebrateError({
          body: { key: 'email', message: 'Please enter a valid email' },
        }),
      )
    })

    it('should return 400 when the new owner is not in the database', async () => {
      // Arrange
      const emailNotInDb = 'notInDb@example.com'
      const formToTransfer = await EncryptFormModel.create({
        title: 'Original form title',
        admin: defaultUser._id,
        publicKey: 'some public key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToTransfer._id}/collaborators/transfer-owner`)
        .send({ email: emailNotInDb })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual({
        message: `${emailNotInDb} must have logged in once before being added as Owner`,
      })
    })

    it('should return 400 when the new owner is already the current owner', async () => {
      // Arrange
      const formToTransfer = await EncryptFormModel.create({
        title: 'Original form title',
        admin: defaultUser._id,
        publicKey: 'some public key',
      })

      // Act
      const response = await request
        .post(`/admin/forms/${formToTransfer._id}/collaborators/transfer-owner`)
        .send({ email: defaultUser.email })

      // Assert
      expect(response.status).toEqual(400)
      expect(response.body).toEqual({
        message: 'You are already the owner of this form',
      })
    })

    it('should return 403 when current user is not the owner of the form', async () => {
      // Arrange
      const anotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user
      const yetAnotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'anotheranother-user',
          shortName: 'someOtherUser',
        })
      ).user
      const notOwnerForm = await EmailFormModel.create({
        title: 'Original form title',
        emails: [anotherUser.email],
        admin: anotherUser._id,
      })

      // Act
      const response = await request
        .post(`/admin/forms/${notOwnerForm._id}/collaborators/transfer-owner`)
        .send({ email: yetAnotherUser.email })

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: expect.stringContaining(
          'not authorized to perform delete operation',
        ),
      })
    })

    it('should return 404 when form to transfer cannot be found', async () => {
      // Arrange
      const invalidFormId = new ObjectId().toHexString()
      const anotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user

      // Act
      const response = await request
        .post(`/admin/forms/${invalidFormId}/collaborators/transfer-owner`)
        .send({ email: anotherUser.email })

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({
        message: 'Form not found',
      })
    })

    it('should return 410 when the form to transfer is already archived', async () => {
      // Arrange
      const archivedForm = await EncryptFormModel.create({
        title: 'Original form title',
        admin: defaultUser._id,
        publicKey: 'some public key',
        // Already deleted.
        status: Status.Archived,
      })
      const anotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user

      // Act
      const response = await request
        .post(`/admin/forms/${archivedForm._id}/collaborators/transfer-owner`)
        .send({ email: anotherUser.email })

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when the user in session cannot be retrieved from the database', async () => {
      // Arrange
      const anotherUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'some-user',
          shortName: 'someUser',
        })
      ).user
      const formToTransfer = await EncryptFormModel.create({
        title: 'Original form title',
        admin: defaultUser._id,
        publicKey: 'some public key',
      })
      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request
        .post(`/admin/forms/${formToTransfer._id}/collaborators/transfer-owner`)
        .send({ email: anotherUser.email })

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })
  })

  describe('GET /admin/forms/:formId/fields/', () => {
    it('should return 200 with success message when form field is successfully retrieved', async () => {
      // Arrange
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      const MOCK_FORM = await EmailFormModel.create({
        title: 'Form to retrieve',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [MOCK_FIELD],
      })

      // Act
      const response = await request.get(
        `/admin/forms/${MOCK_FORM._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(jsonParseStringify(MOCK_FIELD))
    })

    it('should return 403 when user does not have permissions to retrieve form field', async () => {
      // Arrange
      // Create separate user
      const collabUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'collab-user',
          shortName: 'collabUser',
        })
      ).user
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      const MOCK_FORM = await EncryptFormModel.create({
        title: 'form that user has no read access to',
        admin: collabUser._id,
        publicKey: 'some random key',
      })

      // Act
      const response = await request.get(
        `/admin/forms/${MOCK_FORM._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: `User ${defaultUser.email} not authorized to perform read operation on Form ${MOCK_FORM._id} with title: ${MOCK_FORM.title}.`,
      })
    })

    it('should return 404 when form to retrieve cannot be found', async () => {
      // Arrange
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      const invalidFormId = new ObjectId().toHexString()

      // Act
      const response = await request.get(
        `/admin/forms/${invalidFormId}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({ message: 'Form not found' })
    })

    it('should return 404 when form field to retrieve cannot be found', async () => {
      // Arrange
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      const MOCK_FORM = await EmailFormModel.create({
        title: 'Form to retrieve',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [],
      })

      // Act
      const response = await request.get(
        `/admin/forms/${MOCK_FORM._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({
        message: `Attempted to retrieve field ${MOCK_FIELD._id} from ${MOCK_FORM._id} but field was not present`,
      })
    })

    it('should return 410 when form is already archived', async () => {
      // Arrange
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      const archivedForm = await EmailFormModel.create({
        title: 'Form already archived',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        status: Status.Archived,
      })

      // Act
      const response = await request.get(
        `/admin/forms/${archivedForm._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when user in session cannot be found in the database', async () => {
      // Arrange
      const MOCK_FORM = await EmailFormModel.create({
        title: 'Form to retrieve',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request.get(
        `/admin/forms/${MOCK_FORM._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database error occurs whilst archiving form', async () => {
      // Arrange
      const MOCK_FORM = await EmailFormModel.create({
        title: 'Form to retrieve',
        emails: [defaultUser.email],
        admin: defaultUser._id,
      })
      const MOCK_FIELD = generateDefaultField(BasicField.Rating)
      // Mock database error during retrieval.
      jest
        .spyOn(AdminFormService, 'getFormField')
        .mockReturnValueOnce(err(new DatabaseError()))

      // Act
      const response = await request.get(
        `/admin/forms/${MOCK_FORM._id}/fields/${MOCK_FIELD._id}`,
      )

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message: 'Something went wrong. Please try again.',
      })
    })
  })

  describe('POST /:formId/fields/:fieldId/duplicate', () => {
    it('should return 200 with updated form with duplicated field', async () => {
      // Arrange
      const fieldToDuplicate = generateDefaultField(BasicField.Date)
      const formToUpdate = (await EmailFormModel.create({
        title: 'Form to update',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [fieldToDuplicate],
      })) as IPopulatedForm

      const expectedOriginalField = {
        ...omit(fieldToDuplicate, ['getQuestion']),
        _id: new ObjectId(fieldToDuplicate._id),
      }
      const expectedDuplicatedField = {
        ...omit(fieldToDuplicate, ['_id', 'globalId', 'getQuestion']), // do not compare _id and globalId
      }

      // Act
      const response = await request.post(
        `/admin/forms/${formToUpdate._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      const actual = await EmailFormModel.findById(formToUpdate._id).lean()

      const actualOriginalField = omit(actual?.form_fields![0], [
        'dateValidation',
      ])

      const actualDuplicatedField = omit(actual?.form_fields![1], [
        '_id',
        'globalId',
        'dateValidation',
      ])

      expect(response.status).toEqual(200)
      expect(actualOriginalField).toEqual(expectedOriginalField)
      expect(actualDuplicatedField).toEqual(expectedDuplicatedField)
      expect(actual?.__v).toEqual(1) // mongoose version key should be incremented by one upon save()
      expect({
        ...response.body,
        _id: new ObjectId(response.body._id),
      }).toEqual(actual?.form_fields![1])
    })

    it('should return 401 when user is not logged in', async () => {
      // Arrange
      await logoutSession(request)

      const formToUpdate = (await EmailFormModel.create({
        title: 'Form to update',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [generateDefaultField(BasicField.Date)],
      })) as IPopulatedForm

      const fieldToDuplicate = formToUpdate.form_fields[0]

      // Act
      const response = await request.post(
        `/admin/forms/${formToUpdate._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(401)
      expect(response.body).toEqual({ message: 'User is unauthorized.' })
    })

    it('should return 403 when user does not have permissions to update form', async () => {
      // Arrange
      // Create separate user
      const collabUser = (
        await dbHandler.insertFormCollectionReqs({
          userId: new ObjectId(),
          mailName: 'collab-user',
          shortName: 'collabUser',
        })
      ).user

      const randomForm = (await EncryptFormModel.create({
        title: 'form that user has no write access to',
        admin: collabUser._id,
        publicKey: 'some random key',
        permissionList: [{ email: defaultUser.email }],
        form_fields: [generateDefaultField(BasicField.Date)],
      })) as IPopulatedForm

      const fieldToDuplicate = randomForm.form_fields[0]

      // Act
      const response = await request.post(
        `/admin/forms/${randomForm._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(403)
      expect(response.body).toEqual({
        message: `User ${defaultUser.email} not authorized to perform write operation on Form ${randomForm._id} with title: ${randomForm.title}.`,
      })
    })

    it('should return 404 when form to update cannot be found', async () => {
      // Arrange
      const invalidFormId = new ObjectId()
      const randomFieldId = new ObjectId()

      // Act
      const response = await request.post(
        `/admin/forms/${invalidFormId}/fields/${randomFieldId}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({ message: 'Form not found' })
    })

    it('should return 404 when field to duplicate cannot be found', async () => {
      // Arrange
      const formToUpdate = (await EmailFormModel.create({
        title: 'Form to update',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [generateDefaultField(BasicField.Date)],
      })) as IPopulatedForm

      const randomFieldId = new ObjectId()

      // Act
      const response = await request.post(
        `/admin/forms/${formToUpdate._id}/fields/${randomFieldId}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(404)
      expect(response.body).toEqual({
        message: `Attempted to retrieve field ${randomFieldId} from ${formToUpdate._id} but field was not present`,
      })
    })

    it('should return 410 when form is already archived', async () => {
      // Arrange
      // Create archived form.
      const archivedForm = (await EmailFormModel.create({
        title: 'Form already archived',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [generateDefaultField(BasicField.Date)],
        status: Status.Archived,
      })) as IPopulatedForm

      const fieldToDuplicate = archivedForm.form_fields[0]

      // Act
      const response = await request.post(
        `/admin/forms/${archivedForm._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(410)
      expect(response.body).toEqual({ message: 'Form has been archived' })
    })

    it('should return 422 when user in session cannot be found in the database', async () => {
      // Arrange
      const formToUpdate = (await EmailFormModel.create({
        title: 'Form to archive',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [generateDefaultField(BasicField.Date)],
      })) as IPopulatedForm

      const fieldToDuplicate = formToUpdate.form_fields[0]

      // Delete user after login.
      await dbHandler.clearCollection(UserModel.collection.name)

      // Act
      const response = await request.post(
        `/admin/forms/${formToUpdate._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(422)
      expect(response.body).toEqual({ message: 'User not found' })
    })

    it('should return 500 when database error occurs whilst updating form', async () => {
      // Arrange
      const formToUpdate = (await EmailFormModel.create({
        title: 'Form to update',
        emails: [defaultUser.email],
        admin: defaultUser._id,
        form_fields: [generateDefaultField(BasicField.Date)],
      })) as IPopulatedForm

      const fieldToDuplicate = formToUpdate.form_fields[0]

      formToUpdate.save = jest
        .fn()
        .mockRejectedValue(new Error('something happened'))

      jest
        .spyOn(AuthService, 'getFormAfterPermissionChecks')
        .mockReturnValue(okAsync(formToUpdate))

      // Act
      const response = await request.post(
        `/admin/forms/${formToUpdate._id}/fields/${fieldToDuplicate._id}/duplicate`,
      )

      // Assert
      expect(response.status).toEqual(500)
      expect(response.body).toEqual({
        message:
          'Error: [something happened]. Please refresh and try again. If you still need help, email us at form@open.gov.sg.',
      })
    })
  })

  describe('PUT /admin/forms/:formId/start-page', () => {
    const MOCK_START_PAGE: StartPage = {
      paragraph: 'old end page',
    }

    const MOCK_UPDATED_START_PAGE: StartPage = {
      paragraph: 'new mock start page title',
      colorTheme: Colors.Blue,
      logo: {
        state: FormLogoState.None,
      },
      estTimeTaken: 10,
    }

    it('should return 200 when the request is successful', async () => {
      // Arrange
      const form = await EmailFormModel.create({
        emails: [defaultUser.email],
        title: 'email me',
        admin: defaultUser._id,
        startPage: MOCK_START_PAGE,
      })

      // Act
      const resp = await request
        .put(`/admin/forms/${form._id}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)

      // Assert
      expect(resp.status).toBe(200)
      expect(resp.body).toEqual(
        jsonParseStringify({ colorTheme: 'blue', ...MOCK_UPDATED_START_PAGE }),
      )
    })

    it('should return 403 when the user does not have permission to update the start page', async () => {
      // Arrange
      // Create separate user
      const { user: formOwner } = await dbHandler.insertFormCollectionReqs({
        userId: new ObjectId(),
        mailName: 'collab-user',
        shortName: 'collabUser',
      })
      const form = await EmailFormModel.create({
        emails: [formOwner.email],
        title: 'email me',
        admin: formOwner._id,
        startPage: MOCK_START_PAGE,
      })
      const expectedResponse = {
        message: `User ${defaultUser.email} not authorized to perform write operation on Form ${form._id} with title: ${form.title}.`,
      }
      // Act
      const resp = await request
        .put(`/admin/forms/${form._id}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)

      // Assert
      expect(resp.status).toBe(403)
      expect(resp.body).toEqual(jsonParseStringify(expectedResponse))
    })

    it('should  return 404 when the form cannot be found', async () => {
      // Act
      const resp = await request
        .put(`/admin/forms/${new ObjectId().toHexString()}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)
      const expectedResponse = { message: 'Form not found' }

      // Assert
      expect(resp.status).toBe(404)
      expect(resp.body).toEqual(jsonParseStringify(expectedResponse))
    })

    it('should return 410 when updating the start page for a form that has been archived', async () => {
      // Arrange
      const form = await EmailFormModel.create({
        emails: [defaultUser.email],
        title: 'email me',
        admin: defaultUser._id,
        startPage: MOCK_START_PAGE,
        status: Status.Archived,
      })
      const expectedResponse = { message: 'Form has been archived' }

      // Act
      const resp = await request
        .put(`/admin/forms/${form._id}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)

      // Assert
      expect(resp.status).toBe(410)
      expect(resp.body).toEqual(expectedResponse)
    })

    it('should return 422 when the user cannot be retrieved from the database', async () => {
      // Arrange
      const form = await EmailFormModel.create({
        emails: [defaultUser.email],
        title: 'email me',
        admin: defaultUser._id,
        startPage: MOCK_START_PAGE,
      })
      // Remove all users so that user will not be found
      await dbHandler.clearCollection(UserModel.collection.name)
      const expectedResponse = { message: 'User not found' }

      // Act
      const resp = await request
        .put(`/admin/forms/${form._id}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)

      // Assert
      expect(resp.status).toBe(422)
      expect(resp.body).toEqual(expectedResponse)
    })

    it('should return 500 when a database error occurs', async () => {
      // Arrange
      const form = await EmailFormModel.create({
        emails: [defaultUser.email],
        title: 'email me',
        admin: defaultUser._id,
        startPage: MOCK_START_PAGE,
      })
      jest
        .spyOn(AdminFormService, 'updateStartPage')
        .mockReturnValueOnce(errAsync(new DatabaseError('whoops')))
      const expectedResponse = { message: 'whoops' }

      // Act
      const resp = await request
        .put(`/admin/forms/${form._id}/start-page`)
        .send(MOCK_UPDATED_START_PAGE)

      // Assert
      expect(resp.status).toBe(500)
      expect(resp.body).toEqual(expectedResponse)
    })
  })
})
