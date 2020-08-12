const HttpStatus = require('http-status-codes')
const { cloneDeep, times } = require('lodash')
const axios = require('axios')
const MockAdapter = require('axios-mock-adapter')
const crypto = require('crypto')
const ejs = require('ejs')
const express = require('express')
const request = require('supertest')
const mongoose = require('mongoose')

const dbHandler = require('../helpers/db-handler')
const { validSnsBody } = require('../resources/valid-sns-body')
const {
  getSnsBasestring,
} = require('../../../../dist/backend/app/services/sns.service')
const { ObjectID } = require('bson-ext')
const MailService = require('../../../../dist/backend/app/services/mail.service')
  .default

const User = dbHandler.makeModel('user.server.model', 'User')
const Agency = dbHandler.makeModel('agency.server.model', 'Agency')
const Form = dbHandler.makeModel('form.server.model', 'Form')
const EmailForm = mongoose.model('email')
const Submission = dbHandler.makeModel('submission.server.model', 'Submission')
const emailSubmission = mongoose.model('emailSubmission')

describe('Email Submissions Controller', () => {
  const SESSION_SECRET = 'secret'

  // Declare global variables
  let spyRequest
  let sendSubmissionMailSpy
  // spec out controller such that calls to request are
  // directed through a callback to the request spy,
  // which will be destroyed and re-created for every test
  const controller = spec(
    'dist/backend/app/controllers/email-submissions.server.controller',
    {
      mongoose: Object.assign(mongoose, { '@noCallThru': true }),
    },
  )
  const submissionsController = spec(
    'dist/backend/app/controllers/submissions.server.controller',
    {
      mongoose: Object.assign(mongoose, { '@noCallThru': true }),
      request: (url, callback) => spyRequest(url, callback),
      '../../config/config': {
        sessionSecret: SESSION_SECRET,
      },
    },
  )
  const spcpController = spec(
    'dist/backend/app/controllers/spcp.server.controller',
    {
      mongoose: Object.assign(mongoose, { '@noCallThru': true }),
      '../../config/ndi-config': {},
    },
  )

  beforeAll(async () => await dbHandler.connect())
  beforeEach(() => {
    spyRequest = jasmine.createSpy('request')
  })
  afterEach(async () => await dbHandler.clearDatabase())
  afterAll(async () => await dbHandler.closeDatabase())

  describe('notifyParties', () => {
    const originalConsoleError = console.error

    let fixtures

    const endpointPath = '/send-admin-email'
    const injectFixtures = (req, res, next) => {
      Object.assign(req, fixtures)
      return next()
    }

    const app = express()

    // Set EJS as the template engine
    app.engine('server.view.html', ejs.__express)

    // Set views path and view engine
    app.set('view engine', 'server.view.html')
    app.set('views', './src/app/views')

    beforeAll(() => {
      console.error = jasmine.createSpy()
      app
        .route(endpointPath)
        .get(injectFixtures, controller.sendAdminEmail, (req, res) =>
          res.status(200).send(),
        )

      sendSubmissionMailSpy = spyOn(MailService, 'sendSubmissionToAdmin')
    })

    afterAll(() => {
      console.error = originalConsoleError
    })

    afterEach(() => sendSubmissionMailSpy.calls.reset())

    beforeEach(() => {
      fixtures = {
        replyToEmails: [],
        attachments: [
          {
            filename: 'file.txt',
            content: Buffer.alloc(5),
          },
        ],
        form: {
          title: 'Form Title',
          emails: ['test@test.gov.sg'],
          responseMode: 'email',
        },
        formData: [
          {
            question: 'foo',
            answerTemplate: ['bar'],
          },
        ],
        submission: {
          id: 1,
          created: Date.now(),
        },
        jsonData: [
          {
            question: 'Reference Number',
            answer: '123',
          },
          {
            question: 'Timestamp',
            answer: '1/2/3',
          },
          {
            question: 'foo',
            answer: 'bar',
          },
        ],
      }
    })

    it('sends mail with correct parameters', (done) => {
      // Arrange
      const mockSuccessResponse = 'mockSuccessResponse'
      sendSubmissionMailSpy.and.callFake(() => mockSuccessResponse)

      request(app)
        .get(endpointPath)
        .expect(HttpStatus.OK)
        .then(() => {
          const mailOptions = sendSubmissionMailSpy.calls.mostRecent().args[0]
          expect(mailOptions).toEqual(fixtures)
        })
        .then(done)
        .catch(done)
    })

    it('errors with 400 on send failure', (done) => {
      // Arrange
      sendSubmissionMailSpy.and.callFake(() =>
        Promise.reject(new Error('mockErrorResponse')),
      )
      // Trigger error by deleting recipient list
      delete fixtures.form.emails
      request(app)
        .get(endpointPath)
        .expect(HttpStatus.BAD_REQUEST)
        .then(done)
        .catch(done)
    })
  })

  describe('verifySNS', () => {
    let req, res, next, privateKey
    let mockAxios
    beforeAll(() => {
      mockAxios = new MockAdapter(axios)
      const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      })
      privateKey = keys.privateKey
      mockAxios.onGet(validSnsBody.SigningCertURL).reply(200, keys.publicKey)
    })
    beforeEach(() => {
      req = { body: cloneDeep(validSnsBody) }
      res = jasmine.createSpyObj('res', ['sendStatus'])
      next = jasmine.createSpy()
    })
    afterAll(() => {
      mockAxios.restore()
    })
    const verifyFailure = async () => {
      await controller.verifySns(req, res, next)
      expect(res.sendStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN)
      expect(next).not.toHaveBeenCalled()
    }
    const verifySuccess = async () => {
      await controller.verifySns(req, res, next)
      expect(res.sendStatus).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    }
    it('should reject requests without valid structure', async () => {
      delete req.body.Type
      await verifyFailure()
    })
    it('should reject requests with invalid certificate URL', async () => {
      req.body.SigningCertURL = 'http://www.example.com'
      await verifyFailure()
    })
    it('should reject requests with invalid signature version', async () => {
      req.body.SignatureVersion = 'wrongSignatureVersion'
      await verifyFailure()
    })
    it('should reject requests with invalid signature', async () => {
      await verifyFailure()
    })
    it('should accept valid requests', async () => {
      const signer = crypto.createSign('RSA-SHA1')
      signer.write(getSnsBasestring(req.body))
      req.body.Signature = signer.sign(privateKey, 'base64')
      await verifySuccess()
    })
  })

  describe('confirmOnNotification', () => {
    let submission
    let content
    const bodyParser = require('body-parser')
    const app = express()
    const endpointPath = '/emailnotifications'
    const message = (json) => ({ Message: JSON.stringify(json) })

    beforeAll(() => {
      app
        .route(endpointPath)
        .post(bodyParser.json(), controller.confirmOnNotification, (req, res) =>
          res.sendStatus(HttpStatus.OK),
        )
    })

    beforeEach(async () => {
      // Clear mock db and insert test form before each test
      await dbHandler.clearDatabase()
      const { form } = await dbHandler.preloadCollections()

      submission = await emailSubmission.create({
        form: form._id,
        responseHash: 'hash',
        responseSalt: 'salt',
      })

      content = {
        notificationType: 'Bounce',
        mail: {
          headers: [
            {
              name: 'X-Formsg-Form-ID',
              value: form._id,
            },
            {
              name: 'X-Formsg-Submission-ID',
              value: submission._id,
            },
            {
              name: 'X-Formsg-Email-Type',
              value: 'Admin (response)',
            },
          ],
          commonHeaders: { subject: `Title (Ref: ${submission._id})` },
        },
        bounce: {
          bounceType: 'Transient',
          bouncedRecipients: [{ emailAddress: 'fake@email.gov.sg' }],
        },
      }
    })

    afterAll(async () => await dbHandler.clearDatabase())

    const expectNotifySubmissionHasBounced = (json, hasBounced, done) => {
      request(app)
        .post(endpointPath)
        .send(message(json))
        .expect(HttpStatus.OK)
        .then(() => Submission.findOne({ _id: submission._id }))
        .then((s) => {
          expect(s.hasBounced).toEqual(hasBounced)
        })
        .then(done)
        .catch(done)
    }

    it('fails silently on bad payload', (done) => {
      request(app).post(endpointPath).expect(HttpStatus.OK).end(done)
    })

    it('exits early on irrelevant payload', (done) => {
      expectNotifySubmissionHasBounced(
        { notificationType: 'Success' },
        false,
        done,
      )
    })

    it('exits early by malformed bounce missing mail key', (done) => {
      delete content.mail
      expectNotifySubmissionHasBounced(content, false, done)
    })

    it('exits early by malformed bounce missing headers', (done) => {
      delete content.mail.headers
      expectNotifySubmissionHasBounced(content, false, done)
    })

    it('exits early by malformed bounce missing bounce key', (done) => {
      delete content.bounce
      expectNotifySubmissionHasBounced(content, false, done)
    })

    it('exits early by malformed bounce missing submission ID', (done) => {
      content.mail.headers.splice(1, 1)
      expectNotifySubmissionHasBounced(content, false, done)
    })

    it('exits early by malformed bounce missing email type', (done) => {
      content.mail.headers.splice(2, 1)
      expectNotifySubmissionHasBounced(content, false, done)
    })

    it('marks submission has bounced', (done) => {
      expectNotifySubmissionHasBounced(content, true, done)
    })
  })

  describe('receiveEmailSubmissionUsingBusBoy', () => {
    const endpointPath = '/v2/submissions/email'
    const sendSubmissionBack = (req, res) => {
      res.status(200).send({
        body: req.body,
      })
    }

    const app = express()

    const injectForm = (req, res, next) => {
      Object.assign(req, { form: { _id: 'formId' } })
      next()
    }

    beforeAll(() => {
      app
        .route(endpointPath)
        .post(
          injectForm,
          controller.receiveEmailSubmissionUsingBusBoy,
          sendSubmissionBack,
        )
    })

    it('parses submissions without files', (done) => {
      const body = { responses: [] }
      request(app)
        .post(endpointPath)
        .field('body', JSON.stringify(body))
        .expect(HttpStatus.OK)
        .expect({ body })
        .end(done)
    })

    it('parses submissions with files', (done) => {
      const body = {
        responses: [
          {
            _id: 'receiveId',
            question: 'attachment question',
            fieldType: 'attachment',
            answer: 'govtech.jpg',
          },
        ],
      }

      const parsedBody = {
        responses: [
          {
            _id: 'receiveId',
            question: 'attachment question',
            fieldType: 'attachment',
            answer: 'govtech.jpg',
            filename: 'govtech.jpg',
            content: Buffer.alloc(1),
          },
        ],
      }
      request(app)
        .post(endpointPath)
        .field('body', JSON.stringify(body))
        .attach('govtech.jpg', Buffer.alloc(1), 'receiveId')
        .expect(HttpStatus.OK)
        .expect(JSON.stringify({ body: parsedBody }))
        .end(done)
    })

    it('returns 400 for attachments with invalid file exts', (done) => {
      const body = { responses: [] }
      request(app)
        .post(endpointPath)
        .field('body', JSON.stringify(body))
        .attach('invalid.py', Buffer.alloc(1), 'fieldId')
        .expect(HttpStatus.BAD_REQUEST)
        .end(done)
    })

    it('returns 422 for attachments beyond 7 million bytes', (done) => {
      const body = { responses: [] }
      request(app)
        .post(endpointPath)
        .field('body', JSON.stringify(body))
        .attach('valid.jpg', Buffer.alloc(3000000), 'fieldId1')
        .attach('valid2.jpg', Buffer.alloc(3000000), 'fieldId2')
        .attach('valid.jpg', Buffer.alloc(3000000), 'fieldId3')
        .expect(HttpStatus.UNPROCESSABLE_ENTITY)
        .end(done)
    })

    it('changes duplicated file names', (done) => {
      const body = {
        responses: [
          {
            _id: 'attachment1',
            question: 'question 1',
            fieldType: 'attachment',
            answer: 'attachment.jpg',
          },
          {
            _id: 'attachment2',
            question: 'question 2',
            fieldType: 'attachment',
            answer: 'attachment.jpg',
          },
        ],
      }
      const parsedBody = {
        responses: [
          {
            _id: 'attachment1',
            question: 'question 1',
            fieldType: 'attachment',
            answer: '1-attachment.jpg',
            filename: '1-attachment.jpg',
            content: Buffer.alloc(1),
          },
          {
            _id: 'attachment2',
            question: 'question 2',
            fieldType: 'attachment',
            answer: 'attachment.jpg',
            filename: 'attachment.jpg',
            content: Buffer.alloc(1),
          },
        ],
      }

      request(app)
        .post(endpointPath)
        .field('body', JSON.stringify(body))
        .attach('attachment.jpg', Buffer.alloc(1), 'attachment1')
        .attach('attachment.jpg', Buffer.alloc(1), 'attachment2')
        .expect(HttpStatus.OK)
        .expect(JSON.stringify({ body: parsedBody }))
        .end(done)
    })
  })

  describe('validateSubmission', () => {
    let fixtures

    beforeEach(() => {
      fixtures = {
        form: new Form({
          title: 'Test Form',
          authType: 'NIL',
          responseMode: 'email',
          form_fields: [],
        }),
        body: {
          responses: [],
        },
      }
    })

    const endpointPath = '/v2/submissions/email'
    const injectFixtures = (req, res, next) => {
      Object.assign(req, fixtures)
      next()
    }
    const sendSubmissionBack = (req, res) => {
      res.status(200).send({
        body: req.body,
        attachments: req.attachments,
      })
    }

    const app = express()

    beforeAll(() => {
      app
        .route(endpointPath)
        .post(
          injectFixtures,
          controller.validateEmailSubmission,
          sendSubmissionBack,
        )
    })

    it('parses submissions without files', (done) => {
      request(app)
        .post(endpointPath)
        .expect(HttpStatus.OK)
        .expect(
          JSON.stringify({
            body: {
              parsedResponses: [],
            },
            attachments: [],
          }),
        )
        .end(done)
    })

    it('parses submissions with attachments', (done) => {
      const requiredAttachmentId = new ObjectID()
      const optionalAttachmentId = new ObjectID()

      const validAttachmentName = 'valid.pdf'

      fixtures.form.form_fields.push({
        title: 'Attachment',
        required: true,
        fieldType: 'attachment',
        _id: requiredAttachmentId,
        attachmentSize: '1',
      })

      fixtures.form.form_fields.push({
        title: 'NotRequired',
        required: false,
        fieldType: 'attachment',
        _id: optionalAttachmentId,
        attachmentSize: '1',
      })

      fixtures.body.responses.push({
        _id: String(requiredAttachmentId),
        fieldType: 'attachment',
        answer: validAttachmentName,
        filename: validAttachmentName,
        content: Buffer.alloc(1),
      })

      fixtures.body.responses.push({
        _id: String(optionalAttachmentId),
        fieldType: 'attachment',
        answer: '',
      })

      const expectedResponses = []

      expectedResponses.push({
        _id: String(requiredAttachmentId),
        fieldType: 'attachment',
        answer: validAttachmentName,
        filename: validAttachmentName,
        content: Buffer.alloc(1),
        isVisible: true,
        question: 'Attachment',
      })

      expectedResponses.push({
        _id: String(optionalAttachmentId),
        fieldType: 'attachment',
        answer: '',
        isVisible: true,
        question: 'NotRequired',
      })

      request(app)
        .post(endpointPath)
        .expect(HttpStatus.OK)
        .expect(
          JSON.stringify({
            body: {
              parsedResponses: expectedResponses,
            },
            attachments: [
              { filename: validAttachmentName, content: Buffer.alloc(1) },
            ],
          }),
        )
        .end(done)
    })
  })

  // Called by saveSubmissionToDb when responseMode === 'email'
  describe('saveMetadataToDb', () => {
    const crypto = require('crypto')
    let testForm
    let testAgency
    let testUser
    let formData = []
    let attachments = []
    const app = express()
    const endpointPath = '/save-submission'

    const originalConsoleError = console.error

    beforeAll(() => {
      // Stubbing console error to prevent appearing in stdout
      console.error = jasmine.createSpy()

      app.route(endpointPath).get(
        (req, res, next) => {
          req.form = testForm
          req.formData = formData
          req.attachments = attachments
          return next()
        },
        controller.saveMetadataToDb,
        (req, res) => res.status(200).send(req.submission),
      )
    })

    beforeEach((done) => {
      // Clear mock db and insert test form before each test
      dbHandler
        .clearDatabase()
        .then(() => {
          testAgency = new Agency({
            shortName: 'test',
            fullName: 'Test Agency',
            emailDomain: 'test.gov.sg',
            logo: 'test.png',
          })
          return testAgency.save()
        })
        .then(() => {
          testUser = new User({
            email: 'user@test.gov.sg',
            agency: testAgency._id,
          })
          return testUser.save()
        })
        .then(() => {
          testForm = new EmailForm({
            title: 'Test Form',
            emails: 'test@test.gov.sg',
            admin: testUser._id,
          })
          return testForm.save()
        })
        .then(() => done())
    })

    afterAll((done) => {
      console.error = originalConsoleError
      dbHandler.clearDatabase().then(done)
    })

    /* it('saves MyInfo submissions', done => {
      const attr = 'sex'
      // Need to run populate as agency information is needed to update authType
      Form.findById(testForm._id)
        .populate({
          path: 'admin',
          populate: {
            path: 'agency',
            model: 'Agency',
          },
        })
        .then((form) => {
          form.form_fields.push({
            fieldType: 'dropdown',
            title: 'foo',
            myInfo: { attr },
          })
          form.authType = 'SP'
          return form.save()
        }).then((val) => {
          testForm = val
          return request(app)
            .get(endpointPath)
            .expect(HttpStatus.OK)
            .then(({ body: submission }) => {
              console.info()
              expect(submission.form).toEqual(testForm._id.toString())
              expect(submission.recipientEmails).toEqual(
                testForm.emails.map(e => e.toString())
              )
              expect(submission.authType).toEqual('SP')
              expect(submission.hasBounced).toEqual(false)
              expect(submission.myInfoFields).toEqual([attr])
            })
        })
        .then(done)
        .catch(err => {
          if (err) {
            console.error(err)
          }
          done(err)
        })
    }) */

    it('saves non-MyInfo submissions', (done) => {
      request(app)
        .get(endpointPath)
        .expect(HttpStatus.OK)
        .then(({ body: submission }) => {
          expect(submission.form).toEqual(testForm._id.toString())
          expect(submission.recipientEmails).toEqual(
            testForm.emails.map((e) => e.toString()),
          )
          expect(submission.authType).toEqual('NIL')
          expect(submission.hasBounced).toEqual(false)
          expect(submission.myInfoFields).toEqual([])
        })
        .then(done)
        .catch(done)
    })

    it('saves response hash with short text, checkbox and number', (done) => {
      formData = [
        {
          question: 'foo',
          answer: 'bar',
        },
        {
          question: 'checkbox',
          answer: 'option 1, option 2',
        },
        {
          question: 'number',
          answer: 1,
        },
      ]
      let concatResponse = 'foo bar; checkbox option 1, option 2; number 1; '
      request(app)
        .get(endpointPath)
        .expect(HttpStatus.OK)
        .then(({ body: submission }) => {
          expect(submission.form).toEqual(testForm._id.toString())
          expect(submission.recipientEmails).toEqual(
            testForm.emails.map((e) => e.toString()),
          )
          expect(submission.authType).toEqual('NIL')
          expect(submission.hasBounced).toEqual(false)
          expect(submission.myInfoFields).toEqual([])
          let expectedHash = crypto
            .pbkdf2Sync(
              concatResponse,
              submission.responseSalt,
              10000,
              64,
              'sha512',
            )
            .toString('base64')
          expect(submission.responseHash).toEqual(expectedHash)
        })
        .then(done)
        .catch(done)
    })

    it('saves response hash with attachments', (done) => {
      formData = [
        {
          question: 'foo',
          answer: 'bar',
        },
        {
          question: '[attachment] Text File',
          answer: 'file.text',
        },
      ]
      attachments = [
        {
          filename: 'file.txt',
          content: Buffer.alloc(5),
        },
      ]
      let concatResponse =
        'foo bar; [attachment] Text File file.text; \u0000\u0000\u0000\u0000\u0000'
      request(app)
        .get(endpointPath)
        .expect(HttpStatus.OK)
        .then(({ body: submission }) => {
          expect(submission.form).toEqual(testForm._id.toString())
          expect(submission.recipientEmails).toEqual(
            testForm.emails.map((e) => e.toString()),
          )
          expect(submission.authType).toEqual('NIL')
          expect(submission.hasBounced).toEqual(false)
          expect(submission.myInfoFields).toEqual([])
          let expectedHash = crypto
            .pbkdf2Sync(
              concatResponse,
              submission.responseSalt,
              10000,
              64,
              'sha512',
            )
            .toString('base64')
          expect(submission.responseHash).toEqual(expectedHash)
        })
        .then(done)
        .catch(done)
    })

    it('errors with 400 if submission fail', (done) => {
      const badSubmission = jasmine.createSpyObj('Submission', ['save'])
      badSubmission.save.and.callFake((callback) => callback(new Error('boom')))

      const badSubmissionModel = jasmine.createSpy()
      badSubmissionModel.and.returnValue(badSubmission)
      const mongoose = jasmine.createSpyObj('mongoose', ['model'])
      mongoose.model
        .withArgs('emailSubmission')
        .and.returnValue(badSubmissionModel)

      const badController = spec(
        'dist/backend/app/controllers/email-submissions.server.controller',
        {
          mongoose,
        },
      )

      const badApp = express()
      badApp.route(endpointPath).get(
        (req, res, next) => {
          req.form = testForm
          req.formData = formData
          req.attachments = attachments
          return next()
        },
        badController.saveMetadataToDb,
        (req, res) => res.status(200).send(),
      )

      request(badApp).get(endpointPath).expect(HttpStatus.BAD_REQUEST).end(done)
    })
  })

  describe('prepareSubmissionForEmail', () => {
    let reqFixtures
    let resLocalFixtures

    beforeEach(() => {
      reqFixtures = {
        attachments: [],
        form: new Form({
          title: 'Test Form',
          authType: 'NIL',
          responseMode: 'email',
        }),
        body: { form_fields: [], responses: [] },
      }

      resLocalFixtures = {}
    })

    const endpointPath = '/v2/submissions/email'
    const injectFixtures = (req, res, next) => {
      Object.assign(req, reqFixtures)
      if (Object.entries(resLocalFixtures).length !== 0) {
        Object.assign(res, { locals: resLocalFixtures })
      }
      next()
    }
    const sendSubmissionBack = (req, res) => {
      res.status(200).send({
        formData: req.formData,
        autoReplyData: req.autoReplyData,
        jsonData: req.jsonData,
        attachments: req.attachments.map((b) => {
          b.content = b.content.toString('base64')
          return b
        }),
        replyToEmails: req.replyToEmails,
      })
    }

    const app = express()

    beforeAll(() => {
      app
        .route(endpointPath)
        .get(
          injectFixtures,
          controller.validateEmailSubmission,
          submissionsController.injectAutoReplyInfo,
          spcpController.appendVerifiedSPCPResponses,
          controller.prepareEmailSubmission,
          sendSubmissionBack,
        )
    })

    const prepareSubmissionThenCompare = (expected, done) => {
      request(app)
        .get(endpointPath)
        .expect(HttpStatus.OK)
        .then(
          ({ body: { formData, autoReplyData, jsonData, replyToEmails } }) => {
            expect(formData).withContext('Form Data').toEqual(expected.formData)
            expect(autoReplyData)
              .withContext('autoReplyData')
              .toEqual(expected.autoReplyData)
            expect(jsonData).withContext('jsonData').toEqual(expected.jsonData)
            expect(replyToEmails)
              .withContext('replyToEmails')
              .toEqual(expected.replyToEmails)
          },
        )
        .then(done)
        .catch(done)
    }

    const expectStatusCodeError = (statusCode, done) => {
      request(app).get(endpointPath).expect(statusCode).then(done)
    }
    /**
     * Mock a field
     * @param {String} fieldId
     * @param {String} fieldType
     * @param {String} title
     * @param {Object} options  other options that can be passed to a field in the field schema
     */
    const makeField = (fieldId, fieldType, title, options) => {
      return { _id: new ObjectID(fieldId), fieldType, title, ...options }
    }
    /**
     *  Mock a response
     * @param {String} fieldId field id of the field that this response is meant for
     * @param {String} fieldType field type of the field that this response is meant for
     * @param {String} question
     * @param {String} answer
     * @param {Array} [answerArray] array of answers passed in for checkbox and table
     * @param {Boolean} [isExpectedToBeVisible] this boolean is used for computing expected output, and should match isVisible injected by server to pass the test
     */
    const makeResponse = (
      fieldId,
      fieldType,
      question,
      answer,
      answerArray = null,
      isExpectedToBeVisible = true,
    ) => {
      let response = {
        _id: String(fieldId),
        fieldType,
        question,
        answer,
        isExpectedToBeVisible,
      }
      if (answerArray) response.answerArray = answerArray
      return response
    }

    /**
     * Generate expected output for a table
     * @param {Object} field
     * @param {String} field.title
     * @param {String} field.fieldType
     * @param {Array} field.columns
     * @param {Object} response
     * @param {Array} response.answerArray
     * @param {Boolean} response.isExpectedToBeVisible
     */
    const getExpectedForTable = (field, response) => {
      const { answerArray, isExpectedToBeVisible } = response
      const { columns, title, fieldType } = field
      const columnTitles = columns.map(({ title }) => title)
      const autoReplyQuestion = `${title} (${columnTitles.join(', ')})`
      const question = `[table] ${autoReplyQuestion}`
      let expected = {
        autoReplyData: [],
        formData: [],
        jsonData: [],
        replyToEmails: [],
      }
      for (let answer of answerArray) {
        answer = String(answer)
        const answerTemplate = answer.split('\n')
        if (isExpectedToBeVisible) {
          // Auto replies only show visible data
          expected.autoReplyData.push({
            question: autoReplyQuestion,
            answerTemplate,
          })
        }
        expected.jsonData.push({
          question,
          answer,
        })
        expected.formData.push({
          question,
          answerTemplate,
          answer,
          fieldType,
        })
      }
      return expected
    }

    /**
     *  Generate expected output
     * @param {Array} fields
     * @param {Array} responses
     * @returns {Object} { autoReplyData: Array, formData: Array, jsonData: Array, replyToEmails: Array }
     */
    const getExpectedOutput = (fields, responses) => {
      let expected = {
        autoReplyData: [],
        formData: [],
        jsonData: [],
        replyToEmails: [],
      }
      for (let i = 0; i < fields.length; i++) {
        const answer = String(responses[i].answer)
        const answerTemplate = answer.split('\n')
        if (fields[i].fieldType === 'table') {
          const expectedTable = getExpectedForTable(fields[i], responses[i])
          expected.autoReplyData.push(...expectedTable.autoReplyData)
          expected.jsonData.push(...expectedTable.jsonData)
          expected.formData.push(...expectedTable.formData)
          expected.replyToEmails.push(...expectedTable.replyToEmails)
        } else {
          let question = fields[i].title
          if (responses[i].isExpectedToBeVisible) {
            // Auto replies only show visible data
            expected.autoReplyData.push({
              question,
              answerTemplate,
            })
          }
          expected.jsonData.push({
            question,
            answer,
          })
          expected.formData.push({
            question,
            answerTemplate,
            answer,
            fieldType: fields[i].fieldType,
          })
          if (fields[i].fieldType === 'email') {
            expected.replyToEmails.push(answer)
          }
        }
      }
      return expected
    }

    it('maps SingPass attributes', (done) => {
      resLocalFixtures.uinFin = 'S1234567A'
      reqFixtures.form.authType = 'SP'
      const expectedFormData = [
        {
          question: 'SingPass Validated NRIC',
          answerTemplate: [resLocalFixtures.uinFin],
          answer: resLocalFixtures.uinFin,
          fieldType: 'authenticationSp',
        },
      ]
      const expectedAutoReplyData = [
        {
          question: 'SingPass Validated NRIC',
          answerTemplate: [resLocalFixtures.uinFin],
        },
      ]
      const expectedJsonData = [
        {
          question: 'SingPass Validated NRIC',
          answer: resLocalFixtures.uinFin,
        },
      ]
      const expected = {
        formData: expectedFormData,
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('maps CorpPass attributes', (done) => {
      resLocalFixtures.uinFin = '123456789K'
      resLocalFixtures.userInfo = 'S1234567A'
      reqFixtures.form.authType = 'CP'
      const expectedFormData = [
        {
          question: 'CorpPass Validated UEN',
          answerTemplate: [resLocalFixtures.uinFin],
          answer: resLocalFixtures.uinFin,
          fieldType: 'authenticationCp',
        },
        {
          question: 'CorpPass Validated UID',
          answerTemplate: [resLocalFixtures.userInfo],
          answer: resLocalFixtures.userInfo,
          fieldType: 'authenticationCp',
        },
      ]
      const expectedAutoReplyData = [
        {
          question: 'CorpPass Validated UEN',
          answerTemplate: [resLocalFixtures.uinFin],
        },
        {
          question: 'CorpPass Validated UID',
          answerTemplate: [resLocalFixtures.userInfo],
        },
      ]
      const expectedJsonData = [
        {
          question: 'CorpPass Validated UEN',
          answer: resLocalFixtures.uinFin,
        },
        {
          question: 'CorpPass Validated UID',
          answer: resLocalFixtures.userInfo,
        },
      ]
      const expected = {
        formData: expectedFormData,
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('prefixes MyInfo fields with [MyInfo]', (done) => {
      const fieldId = new ObjectID()

      const attr = 'passportnumber'
      reqFixtures.hashedFields = {
        [attr]: 'foobar',
      }
      const responseField = {
        _id: String(fieldId),
        question: 'myinfo',
        fieldType: 'textfield',
        isHeader: false,
        answer: 'bar',
        myInfo: { attr },
      }
      reqFixtures.body.responses.push(responseField)
      reqFixtures.form.form_fields.push({
        _id: fieldId,
        title: 'myinfo',
        fieldType: 'textfield',
        required: true,
        myInfo: { attr },
      })
      const expectedJsonData = [
        {
          question: 'myinfo',
          answer: 'bar',
        },
      ]
      const expectedFormData = [
        {
          question: '[MyInfo] myinfo',
          answerTemplate: ['bar'],
          answer: 'bar',
          fieldType: 'textfield',
        },
      ]
      const expectedAutoReplyData = [
        {
          question: 'myinfo',
          answerTemplate: ['bar'],
        },
      ]
      const expected = {
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        formData: expectedFormData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('maps text if isVisible', (done) => {
      const fieldId = new ObjectID()
      reqFixtures.body.responses.push({
        _id: String(fieldId),
        question: 'regular',
        fieldType: 'textfield',
        isHeader: false,
        answer: 'foo',
      })
      reqFixtures.form.form_fields.push({
        _id: fieldId,
        title: 'regular',
        fieldType: 'textfield',
      })
      const expectedAutoReplyData = [
        {
          question: 'regular',
          answerTemplate: ['foo'],
        },
      ]
      const expectedJsonData = [
        {
          question: 'regular',
          answer: 'foo',
        },
      ]
      const expectedFormData = [
        {
          question: 'regular',
          answerTemplate: ['foo'],
          answer: 'foo',
          fieldType: 'textfield',
        },
      ]
      const expected = {
        formData: expectedFormData,
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('excludes field if isVisible is false for autoReplyData', (done) => {
      const nonVisibleField = {
        _id: new ObjectID(),
        title: 'not visible to autoReplyData',
        fieldType: 'textfield',
      }
      const yesNoField = {
        _id: new ObjectID(),
        title: 'Show textfield if this field is yes',
        fieldType: 'yes_no',
      }
      const nonVisibleResponse = {
        _id: String(nonVisibleField._id),
        question: nonVisibleField.title,
        fieldType: nonVisibleField.fieldType,
        isHeader: false,
        answer: 'abc',
      }
      const yesNoResponse = {
        _id: String(yesNoField._id),
        question: yesNoField.title,
        fieldType: yesNoField.fieldType,
        isHeader: false,
        answer: 'No',
      }

      reqFixtures.body.responses.push(nonVisibleResponse)
      reqFixtures.body.responses.push(yesNoResponse)
      reqFixtures.form.form_fields.push(nonVisibleField)
      reqFixtures.form.form_fields.push(yesNoField)
      reqFixtures.form.form_logics.push({
        show: [nonVisibleField._id],
        conditions: [
          {
            ifValueType: 'single-select',
            _id: '58169',
            field: yesNoField._id,
            state: 'is equals to',
            value: 'Yes',
          },
        ],
        _id: '5db00a15af2ffb29487d4eb1',
        logicType: 'showFields',
      })
      const expectedJsonData = [
        {
          question: nonVisibleField.title,
          answer: nonVisibleResponse.answer,
        },
        {
          question: yesNoField.title,
          answer: yesNoResponse.answer,
        },
      ]
      const expectedFormData = [
        {
          question: nonVisibleField.title,
          answerTemplate: [nonVisibleResponse.answer],
          answer: nonVisibleResponse.answer,
          fieldType: nonVisibleField.fieldType,
        },
        {
          question: yesNoField.title,
          answerTemplate: [yesNoResponse.answer],
          answer: yesNoResponse.answer,
          fieldType: yesNoField.fieldType,
        },
      ]
      const expectedAutoReplyData = [
        {
          question: yesNoField.title,
          answerTemplate: [yesNoResponse.answer],
        },
      ]
      const expected = {
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        formData: expectedFormData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('prefixes attachment fields with [attachment]', (done) => {
      const validAttachmentName = 'valid.pdf'
      const fieldId = new ObjectID()
      reqFixtures.body.responses.push({
        _id: String(fieldId),
        question: 'an attachment',
        fieldType: 'attachment',
        isHeader: false,
        answer: validAttachmentName,
        filename: validAttachmentName,
        content: Buffer.alloc(1),
      })
      reqFixtures.form.form_fields.push({
        _id: fieldId,
        title: 'an attachment',
        fieldType: 'attachment',
        attachmentSize: '1',
      })
      const expectedJsonData = [
        {
          question: '[attachment] an attachment',
          answer: validAttachmentName,
        },
      ]
      const expectedFormData = [
        {
          question: '[attachment] an attachment',
          answerTemplate: [validAttachmentName],
          answer: validAttachmentName,
          fieldType: 'attachment',
        },
      ]
      const expectedAutoReplyData = [
        {
          question: 'an attachment',
          answerTemplate: [validAttachmentName],
        },
      ]
      const expected = {
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        formData: expectedFormData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('prefixes table fields with [table]', (done) => {
      const fieldId = new ObjectID()
      reqFixtures.body.responses.push({
        _id: String(fieldId),
        question: 'a table',
        fieldType: 'table',
        isHeader: false,
        answer: '',
      })
      reqFixtures.form.form_fields.push({
        _id: fieldId,
        title: 'a table',
        fieldType: 'table',
        columns: [
          { title: 'Name', fieldType: 'textfield' },
          { title: 'Age', fieldType: 'textfield' },
        ],
      })
      const expectedJsonData = [
        {
          question: '[table] a table (Name, Age)',
          answer: '',
        },
      ]
      const expectedFormData = [
        {
          question: '[table] a table (Name, Age)',
          answerTemplate: [''],
          answer: '',
          fieldType: 'table',
        },
      ]
      const expectedAutoReplyData = [
        {
          question: 'a table (Name, Age)',
          answerTemplate: [''],
        },
      ]
      const expected = {
        autoReplyData: expectedAutoReplyData,
        jsonData: expectedJsonData,
        formData: expectedFormData,
        replyToEmails: [],
      }
      prepareSubmissionThenCompare(expected, done)
    })

    it('maps replyToEmails', (done) => {
      const emails = ['email@test.com', 'email@mymail.com']
      let expected = {
        autoReplyData: [],
        formData: [],
        jsonData: [],
        replyToEmails: [],
      }
      for (let i = 0; i < emails.length; i++) {
        const fieldId = new ObjectID()
        const field = {
          _id: fieldId,
          fieldType: 'email',
          title: `Send a reply to this email ${i}`,
          autoReplyOptions: {
            hasAutoReply: false,
            autoReplySubject: '',
            autoReplySender: '',
            autoReplyMessage: '',
            includeFormSummary: false,
          },
        }
        const response = {
          _id: String(fieldId),
          question: 'Some question',
          fieldType: 'email',
          isHeader: false,
          answer: emails[i],
        }
        reqFixtures.form.form_fields.push(field)
        reqFixtures.body.responses.push(response)
        expected.autoReplyData.push({
          question: field.title,
          answerTemplate: [emails[i]],
        })
        expected.jsonData.push({
          question: field.title,
          answer: emails[i],
        })
        expected.formData.push({
          question: field.title,
          answerTemplate: [emails[i]],
          answer: emails[i],
          fieldType: field.fieldType,
        })
        expected.replyToEmails.push(emails[i])
      }

      prepareSubmissionThenCompare(expected, done)
    })

    it('selects only first response for each form field', (done) => {
      const fieldIds = times(15, () => String(new ObjectID()))
      const responseIds = fieldIds.map((id) => String(id))

      const fields = [
        makeField(fieldIds[0], 'section', 'Title for section'),
        makeField(fieldIds[1], 'radiobutton', 'Title for radiobutton', {
          fieldOptions: ['rb1', 'rb2'],
        }),
        makeField(fieldIds[2], 'dropdown', 'Title for dropdown', {
          fieldOptions: ['db1', 'db2'],
        }),
        makeField(fieldIds[3], 'email', 'Title for email', {
          autoReplyOptions: { hasAutoReply: false },
        }),
        makeField(fieldIds[4], 'table', 'Title for table', {
          minimumRows: 2,
          addMoreRows: false,
          maximumRows: 2,
          columns: [
            {
              title: 'Some dropdown',
              required: true,
              _id: '5ca5d548ddafb6c289893537',
              columnType: 'dropdown',
              fieldOptions: ['Option 1', 'Option 2'],
            },
            {
              title: 'Some textfield',
              required: true,
              _id: '5ca5d548ddafb6c289893538',
              columnType: 'textfield',
            },
          ],
        }),
        makeField(fieldIds[5], 'number', 'Title for number'),
        makeField(fieldIds[6], 'textfield', 'Title for textfield'),
        makeField(fieldIds[7], 'textarea', 'Title for textarea'),
        makeField(fieldIds[8], 'decimal', 'Title for decimal'),
        makeField(fieldIds[9], 'nric', 'Title for nric'),
        makeField(fieldIds[10], 'yes_no', 'Title for yes_no'),
        makeField(fieldIds[11], 'mobile', 'Title for mobile'),
        makeField(fieldIds[12], 'checkbox', 'Title for checkbox', {
          fieldOptions: ['cb1', 'cb2', 'cb3'],
        }),
        makeField(fieldIds[13], 'rating', 'Title for rating', {
          ratingOptions: { steps: 5, shape: 'Heart' },
        }),
        makeField(fieldIds[14], 'date', 'Title for date'),
      ]
      const responses = [
        makeResponse(responseIds[0], 'section', 'Title for section', ''),
        makeResponse(
          responseIds[1],
          'radiobutton',
          'Title for radiobutton',
          'rb1',
        ),
        makeResponse(responseIds[2], 'dropdown', 'Title for dropdown', 'db1'),
        makeResponse(responseIds[3], 'email', 'Title for email', 'abc@abc.com'),
        makeResponse(
          responseIds[4],
          'table',
          'Title for table',
          'Option 1, text 1',
          [
            ['Option 1', 'text 1'],
            ['Option 1', 'text 2'],
          ],
        ),
        makeResponse(responseIds[5], 'number', 'Title for number', '9000'),
        makeResponse(
          responseIds[6],
          'textfield',
          'Title for textfield',
          'hola',
        ),
        makeResponse(responseIds[7], 'textarea', 'Title for textarea', 'ciao'),
        makeResponse(responseIds[8], 'decimal', 'Title for decimal', '10.1'),
        makeResponse(responseIds[9], 'nric', 'Title for nric', 'S9912345A'),
        makeResponse(responseIds[10], 'yes_no', 'Title for yes_no', 'Yes'),
        makeResponse(
          responseIds[11],
          'mobile',
          'Title for mobile',
          '+6583838383',
        ),
        makeResponse(
          responseIds[12],
          'checkbox',
          'Title for checkbox',
          'cb1, cb2, cb3',
          ['cb1', 'cb2', 'cb3'],
        ),
        makeResponse(responseIds[13], 'rating', 'Title for rating', '5'),
        makeResponse(responseIds[14], 'date', 'Title for date', '15 Nov 2019'),
      ]

      const extra = [
        // Add extra responses
        makeResponse(responseIds[0], 'section', 'Title for section', ''),
        makeResponse(
          responseIds[1],
          'radiobutton',
          'Title for radiobutton',
          'rb2',
        ),
        makeResponse(responseIds[2], 'dropdown', 'Title for dropdown', 'db2'),
        makeResponse(responseIds[3], 'email', 'Title for email', 'xyz@xyz.com'),
        makeResponse(
          responseIds[4],
          'table',
          'Title for table',
          'Option 1, text 2',
          [
            ['Option 1', 'text 1'],
            ['Option 1', 'text 2'],
          ],
        ),
        makeResponse(
          responseIds[4],
          'table',
          'Title for table',
          'Option 2, text 3',
          [
            ['Option 1', 'text 1'],
            ['Option 1', 'text 2'],
            ['Option 2', 'text 3'],
            ['Option 2', 'text 4'],
          ],
        ),
        makeResponse(
          responseIds[4],
          'table',
          'Title for table',
          'Option 2, text 4',
          [
            ['Option 1', 'text 1'],
            ['Option 1', 'text 2'],
            ['Option 2', 'text 3'],
            ['Option 2', 'text 4'],
          ],
        ),
        makeResponse(responseIds[5], 'number', 'Title for number', '9999'),
        makeResponse(
          responseIds[6],
          'textfield',
          'Title for textfield',
          'hello',
        ),
        makeResponse(
          responseIds[7],
          'textarea',
          'Title for textarea',
          'byebye',
        ),
        makeResponse(responseIds[8], 'decimal', 'Title for decimal', '202.12'),
        makeResponse(responseIds[9], 'nric', 'Title for nric', 'S9634214D'),
        makeResponse(responseIds[10], 'yes_no', 'Title for yes_no', 'No'),
        makeResponse(
          responseIds[11],
          'mobile',
          'Title for mobile',
          '+6584848484',
        ),
        makeResponse(responseIds[12], 'checkbox', 'Title for checkbox', 'cb3', [
          'cb3',
        ]),
        makeResponse(responseIds[13], 'rating', 'Title for rating', '1'),
        makeResponse(responseIds[14], 'date', 'Title for date', '15 Dec 2019'),
      ]

      const expected = getExpectedOutput(fields, responses)
      reqFixtures.form.form_fields = fields
      reqFixtures.body.responses = responses.concat(extra)
      prepareSubmissionThenCompare(expected, done)
    })

    it('ignores statement and image fields in submission', (done) => {
      const fieldIds = times(4, () => new ObjectID())
      const responseIds = fieldIds.map((id) => String(id))
      const fields = [
        { _id: fieldIds[0], fieldType: 'section', title: 'Welcome to my form' },
        { _id: fieldIds[1], fieldType: 'statement', title: 'Hello there' },
        {
          _id: fieldIds[2],
          fieldType: 'image',
          title: 'Does image even have a title?',
          url: 'http://myimage.com/image.jpg',
        },
        { _id: fieldIds[3], fieldType: 'number', title: 'Lottery number' },
      ]
      const responses = [
        {
          _id: responseIds[0],
          fieldType: 'section',
          question: 'Welcome to my form',
          answer: '',
        },
        {
          _id: responseIds[1],
          fieldType: 'statement',
          question: 'Hello there',
          answer: '',
        },
        {
          _id: responseIds[2],
          fieldType: 'image',
          question: 'Does image even have a title?',
          answer: '',
        },
        {
          _id: responseIds[3],
          fieldType: 'number',
          question: 'Lottery number',
          answer: '37',
        },
      ]
      let expected = {
        autoReplyData: [],
        formData: [],
        jsonData: [],
        replyToEmails: [],
      }
      for (let i = 0; i < fields.length; i++) {
        let { fieldType, title } = fields[i]
        let { answer } = responses[i]
        if (!['image', 'statement'].includes(fieldType)) {
          expected.autoReplyData.push({
            question: title,
            answerTemplate: String(answer).split('\n'),
          })
          expected.jsonData.push({ question: title, answer: String(answer) })
          expected.formData.push({
            question: title,
            answerTemplate: String(answer).split('\n'),
            answer,
            fieldType,
          })
        }
      }
      reqFixtures.form.form_fields = fields
      reqFixtures.body.responses = responses
      prepareSubmissionThenCompare(expected, done)
    })

    it('errors with 409 when some fields are not submitted', (done) => {
      const fields = [
        { _id: '1', fieldType: 'section', title: 'Welcome to my form' },
        { _id: '2', fieldType: 'number', title: 'Lottery number' },
      ]
      const responses = [
        {
          _id: '1',
          fieldType: 'section',
          question: 'Welcome to my form',
          answer: '',
        },
      ]
      reqFixtures.form.form_fields = fields
      reqFixtures.body.responses = responses
      request(app).get(endpointPath).expect(HttpStatus.CONFLICT).then(done)
    })

    describe('Logic', () => {
      describe('Single-select value', () => {
        const conditionField = makeField(
          new ObjectID(),
          'yes_no',
          'Show text field if yes',
        )
        const logicField = makeField(new ObjectID(), 'textfield', 'Text field')
        const visField = makeField(new ObjectID(), 'nric', 'Nric field')
        const fields = [conditionField, logicField, visField]
        const conditions = [
          {
            ifValueType: 'single-select',
            _id: '58169',
            field: conditionField._id,
            state: 'is equals to',
            value: 'Yes',
          },
        ]
        const _id = '5db00a15af2ffb29487d4eb1'
        const showFieldLogics = [
          {
            show: [logicField._id],
            conditions,
            _id,
            logicType: 'showFields',
          },
        ]
        const preventSubmitLogics = [
          {
            show: [],
            conditions,
            _id,
            preventSubmitMessage: 'test',
            logicType: 'preventSubmit',
          },
        ]
        const makeSingleSelectFixtures = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              conditionFieldVal,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              expectLogicFieldVisible,
            ),
            makeResponse(
              visField._id,
              visField.fieldType,
              visField.title,
              'S9912345A',
            ), // This field is always visible
          ]
        }

        const singleSelectSuccessTest = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
          done,
        ) => {
          makeSingleSelectFixtures(
            logics,
            conditionFieldVal,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }

        it('hides logic fields for single select value', (done) => {
          // Does not fulfill condition, hence second field hidden
          singleSelectSuccessTest(showFieldLogics, 'No', false, done)
        })

        it('shows logic fields for single select value', (done) => {
          // Fulfills condition, hence second field shown
          singleSelectSuccessTest(showFieldLogics, 'Yes', true, done)
        })

        it('allows submission when not prevented by single select value', (done) => {
          // Does not fulfill condition, hence submission goes through
          singleSelectSuccessTest(preventSubmitLogics, 'No', true, done)
        })

        it('rejects submission prevented by single select value', (done) => {
          // Fulfills condition, hence submission rejected
          makeSingleSelectFixtures(preventSubmitLogics, 'Yes', true)
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('Number value', () => {
        const conditionField = makeField(
          new ObjectID(),
          'number',
          'Show text field if less than 10',
        )
        const logicField = makeField(new ObjectID(), 'textfield', 'Text field')
        const visField = makeField(new ObjectID(), 'nric', 'Nric field')
        const fields = [conditionField, logicField, visField]
        const conditions = [
          {
            ifValueType: 'number',
            _id: '58169',
            field: conditionField._id,
            state: 'is less than or equal to',
            value: 10,
          },
        ]
        const _id = '5db00a15af2ffb29487d4eb1'
        const showFieldLogics = [
          {
            show: [logicField._id],
            conditions,
            _id,
            logicType: 'showFields',
          },
        ]
        const preventSubmitLogics = [
          {
            show: [],
            conditions,
            _id,
            preventSubmitMessage: 'test',
            logicType: 'preventSubmit',
          },
        ]
        const makeNumberValueFixtures = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              conditionFieldVal,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              expectLogicFieldVisible,
            ),
            makeResponse(
              visField._id,
              visField.fieldType,
              visField.title,
              'S9912345A',
            ), // This field is always visible
          ]
        }
        const numberValueSuccessTest = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
          done,
        ) => {
          makeNumberValueFixtures(
            logics,
            conditionFieldVal,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }
        it('hides logic fields for number value', (done) => {
          // Second field hidden
          numberValueSuccessTest(showFieldLogics, '11', false, done)
        })

        it('shows logic for number value', (done) => {
          // Second field shown
          numberValueSuccessTest(showFieldLogics, '9', true, done)
        })

        it('accepts submission not prevented by number value', (done) => {
          // Condition not fulfilled, form goes through
          numberValueSuccessTest(preventSubmitLogics, '11', true, done)
        })

        it('rejects submission prevented by number value', (done) => {
          makeNumberValueFixtures(preventSubmitLogics, '9', true)
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('Multi-select value', () => {
        const conditionField = makeField(
          new ObjectID(),
          'dropdown',
          'Show text field if value is Option 1 or Option 2',
          {
            fieldOptions: ['Option 1', 'Option 2', 'Option 3'],
          },
        )
        const logicField = makeField(new ObjectID(), 'textfield', 'Text field')
        const visField = makeField(new ObjectID(), 'nric', 'Nric field')
        const fields = [conditionField, logicField, visField]
        const conditions = [
          {
            ifValueType: 'multi-select',
            _id: '58169',
            field: conditionField._id,
            state: 'is either',
            value: ['Option 1', 'Option 2'],
          },
        ]
        const _id = '5db00a15af2ffb29487d4eb1'
        const showFieldLogics = [
          {
            show: [logicField._id],
            conditions,
            _id,
            logicType: 'showFields',
          },
        ]
        const preventSubmitLogics = [
          {
            show: [],
            conditions,
            _id,
            preventSubmitMessage: 'test',
            logicType: 'preventSubmit',
          },
        ]
        const makeMultiSelectFixtures = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              conditionFieldVal,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              expectLogicFieldVisible,
            ),
            makeResponse(
              visField._id,
              visField.fieldType,
              visField.title,
              'S9912345A',
            ), // This field is always visible
          ]
        }
        const multiSelectSuccessTest = (
          logics,
          conditionFieldVal,
          expectLogicFieldVisible,
          done,
        ) => {
          makeMultiSelectFixtures(
            logics,
            conditionFieldVal,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }

        it('hides logic fields for multi-select value', (done) => {
          multiSelectSuccessTest(showFieldLogics, 'Option 3', false, done)
        })

        it('shows logic for multi-select value', (done) => {
          multiSelectSuccessTest(showFieldLogics, 'Option 1', true, done)
        })

        it('allows submission not prevented by logic', (done) => {
          multiSelectSuccessTest(preventSubmitLogics, 'Option 3', true, done)
        })

        it('rejects submissions prevented by logic', (done) => {
          makeMultiSelectFixtures(preventSubmitLogics, 'Option 1', true)
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('supports multiple AND conditions', () => {
        const conditionField1 = makeField(
          new ObjectID(),
          'yes_no',
          'Show text field if yes',
        )
        const conditionField2 = makeField(
          new ObjectID(),
          'dropdown',
          'Show text field if dropdown says Textfield',
          {
            fieldOptions: ['Textfield', 'Radiobutton', 'Email'],
          },
        )
        const logicField = makeField(new ObjectID(), 'textfield', 'Text field')
        const fields = [conditionField1, conditionField2, logicField]
        const conditions = [
          {
            ifValueType: 'single-select',
            _id: '9577',
            field: conditionField1._id,
            state: 'is equals to',
            value: 'Yes',
          },
          {
            ifValueType: 'single-select',
            _id: '45633',
            field: conditionField2._id,
            state: 'is equals to',
            value: 'Textfield',
          },
        ]
        const _id = '5df11ee1e6b6e7108a939c8a'
        const showFieldLogics = [
          {
            show: [logicField._id],
            conditions,
            _id,
            logicType: 'showFields',
          },
        ]
        const preventSubmitLogics = [
          {
            show: [logicField._id],
            conditions,
            _id,
            preventSubmitMessage: 'test',
            logicType: 'preventSubmit',
          },
        ]
        const makeMultiAndFixtures = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              conditionField1Val,
            ),
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              conditionField2Val,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              expectLogicFieldVisible,
            ),
          ]
        }
        const multiAndSuccessTest = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectLogicFieldVisible,
          done,
        ) => {
          makeMultiAndFixtures(
            logics,
            conditionField1Val,
            conditionField2Val,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }

        it('hides logic fields if any condition is not fulfilled', (done) => {
          multiAndSuccessTest(
            showFieldLogics,
            'Yes',
            'Radiobutton',
            false,
            done,
          )
        })

        it('shows logic fields if every condition is fulfilled', (done) => {
          multiAndSuccessTest(showFieldLogics, 'Yes', 'Textfield', true, done)
        })

        it('discards invalid logic when a condition is missing', (done) => {
          reqFixtures.form.form_fields = [conditionField2, logicField] // Missing conditionField1
          reqFixtures.form.form_logics = showFieldLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              'Radiobutton',
            ), // Does not fulfill condition
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              true,
            ), // This field should be shown because logic has been discarded
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })

        it('accepts submissions not prevented by logic', (done) => {
          multiAndSuccessTest(
            preventSubmitLogics,
            'Yes',
            'Radiobutton',
            true,
            done,
          )
        })

        it('rejects submissions prevented by logic', (done) => {
          makeMultiAndFixtures(preventSubmitLogics, 'Yes', 'Textfield', true)
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('supports multiple OR conditions', () => {
        const conditionField1 = makeField(
          new ObjectID(),
          'yes_no',
          'Show text field if yes',
        )
        const conditionField2 = makeField(
          new ObjectID(),
          'dropdown',
          'Show text field if dropdown says Textfield',
          {
            fieldOptions: ['Textfield', 'Radiobutton', 'Email'],
          },
        )
        const logicField = makeField(new ObjectID(), 'textfield', 'Text field')
        const fields = [conditionField1, conditionField2, logicField]
        const conditionses = [
          [
            {
              ifValueType: 'single-select',
              _id: '9577',
              field: conditionField1._id,
              state: 'is equals to',
              value: 'Yes',
            },
          ],
          [
            {
              ifValueType: 'single-select',
              _id: '89906',
              field: conditionField2._id,
              state: 'is equals to',
              value: 'Textfield',
            },
          ],
        ]
        const _ids = ['5df11ee1e6b6e7108a939c8a', '5df127a2e6b6e7108a939c90']
        const showFieldLogics = _.zipWith(
          conditionses,
          _ids,
          (conditions, _id) => {
            return {
              show: [logicField._id],
              conditions,
              _id,
              logicType: 'showFields',
            }
          },
        )
        const preventSubmitLogics = _.zipWith(
          conditionses,
          _ids,
          (conditions, _id) => {
            return { show: [], conditions, _id, logicType: 'preventSubmit' }
          },
        )
        const makeOrFixtures = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              conditionField1Val,
            ),
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              conditionField2Val,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              'lorem',
              null,
              expectLogicFieldVisible,
            ),
          ]
        }
        const orSuccessTest = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectLogicFieldVisible,
          done,
        ) => {
          makeOrFixtures(
            logics,
            conditionField1Val,
            conditionField2Val,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }

        it('hides logic fields if every condition is not fulfilled', (done) => {
          orSuccessTest(showFieldLogics, 'No', 'Radiobutton', false, done)
        })

        it('shows logic fields if any condition is fulfilled', (done) => {
          orSuccessTest(showFieldLogics, 'Yes', 'Radiobutton', true, done)
        })

        it('accepts submission not prevented by logic', (done) => {
          orSuccessTest(preventSubmitLogics, 'No', 'Radiobutton', true, done)
        })

        it('rejects submission prevented by logic', (done) => {
          makeOrFixtures(preventSubmitLogics, 'Yes', 'Radiobutton', true)
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('supports multiple showable fields', () => {
        const conditionField = makeField(
          new ObjectID(),
          'yes_no',
          'Show text field if yes',
        )
        const logicField1 = makeField(new ObjectID(), 'textfield', 'Text field')
        const logicField2 = makeField(
          new ObjectID(),
          'textarea',
          'Long text field',
        )
        const fields = [conditionField, logicField1, logicField2]
        const formLogics = [
          {
            show: [logicField1._id, logicField2._id],
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '58169',
                field: conditionField._id,
                state: 'is equals to',
                value: 'Yes',
              },
            ],
            _id: '5db00a15af2ffb29487d4eb1',
            logicType: 'showFields',
          },
        ]
        it('hides multiple logic fields when condition is not fulfilled', (done) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              'No',
            ), // Does not fulfill condition
            makeResponse(
              logicField1._id,
              logicField1.fieldType,
              logicField1.title,
              'lorem',
              null,
              false,
            ), // This field should be hidden
            makeResponse(
              logicField2._id,
              logicField2.fieldType,
              logicField2.title,
              'ipsum',
              null,
              false,
            ), // This field should be hidden
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })

        it('shows multiple logic fields when condition is fulfilled', (done) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              'Yes',
            ), // Fulfills condition
            makeResponse(
              logicField1._id,
              logicField1.fieldType,
              logicField1.title,
              'lorem',
              null,
              true,
            ), // This field should be shown
            makeResponse(
              logicField2._id,
              logicField2.fieldType,
              logicField2.title,
              'ipsum',
              null,
              true,
            ), // This field should be shown
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })

        it('should hide unfulfilled logic field even when some of the logic fields are missing', (done) => {
          reqFixtures.form.form_fields = [conditionField, logicField1] // Missing logicField2
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              'No',
            ), //  Does not fulfill condition
            makeResponse(
              logicField1._id,
              logicField1.fieldType,
              logicField1.title,
              'lorem',
              null,
              false,
            ), // This field should be hidden
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })

        it('should show fulfilled logic field even when some of the logic fields are missing', (done) => {
          reqFixtures.form.form_fields = [conditionField, logicField1] // Missing logicField2
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField._id,
              conditionField.fieldType,
              conditionField.title,
              'Yes',
            ), // Fulfills condition
            makeResponse(
              logicField1._id,
              logicField1.fieldType,
              logicField1.title,
              'lorem',
              null,
              true,
            ), // This field should be shown
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })
      })

      describe('supports chained logic', () => {
        const conditionField1 = makeField(
          new ObjectID(),
          'rating',
          'Show radio if rating is more than or equal 2',
          {
            ratingOptions: {
              steps: 5,
              shape: 'Heart',
            },
          },
        )
        const conditionField2 = makeField(
          new ObjectID(),
          'radiobutton',
          'Show date if radio is others',
          {
            fieldOptions: ['Option 1', 'Option 2'],
            othersRadioButton: true,
          },
        )
        const logicField = makeField(new ObjectID(), 'date', 'Date field')
        const fields = [conditionField1, conditionField2, logicField]
        const showFieldLogics = [
          {
            show: [conditionField2._id],
            _id: '5df12cf8e6b6e7108a939c99',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '57184',
                field: conditionField1._id,
                state: 'is more than or equal to',
                value: 2,
              },
            ],
            logicType: 'showFields',
          },
          {
            show: [logicField._id],
            _id: '5df12d0ee6b6e7108a939c9a',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '48323',
                field: conditionField2._id,
                state: 'is equals to',
                value: 'Others',
              },
            ],
            logicType: 'showFields',
          },
        ]
        const preventSubmitLogics = [
          {
            show: [conditionField2._id],
            _id: '5df12cf8e6b6e7108a939c99',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '57184',
                field: conditionField1._id,
                state: 'is more than or equal to',
                value: 2,
              },
            ],
            logicType: 'showFields',
          },
          {
            show: [],
            _id: '5df12d0ee6b6e7108a939c9a',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '48323',
                field: conditionField2._id,
                state: 'is equals to',
                value: 'Others',
              },
            ],
            logicType: 'preventSubmit',
          },
        ]
        const makeChainedFixtures = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectedField2Visible,
          expectLogicFieldVisible,
        ) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = logics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              conditionField1Val,
            ),
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              conditionField2Val,
              null,
              expectedField2Visible,
            ),
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              '12 Dec 2019',
              null,
              expectLogicFieldVisible,
            ),
          ]
        }
        const chainedSuccessTest = (
          logics,
          conditionField1Val,
          conditionField2Val,
          expectedField2Visible,
          expectLogicFieldVisible,
          done,
        ) => {
          makeChainedFixtures(
            logics,
            conditionField1Val,
            conditionField2Val,
            expectedField2Visible,
            expectLogicFieldVisible,
          )
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        }
        it('shows chained logic', (done) => {
          chainedSuccessTest(
            showFieldLogics,
            '2',
            'Others: peas',
            true,
            true,
            done,
          )
        })

        it('hides chained logic', (done) => {
          chainedSuccessTest(
            showFieldLogics,
            '1',
            'Others: peas',
            false,
            false,
            done,
          )
        })

        it('accepts submission not prevented by chained logic', (done) => {
          chainedSuccessTest(
            preventSubmitLogics,
            '2',
            'Option 1',
            true,
            true,
            done,
          )
        })

        it('rejects submission prevented by chained logic', (done) => {
          makeChainedFixtures(
            preventSubmitLogics,
            '2',
            'Others: peas',
            true,
            true,
          )
          expectStatusCodeError(HttpStatus.BAD_REQUEST, done)
        })
      })

      describe('supports logic regardless of field order', () => {
        const conditionField1 = makeField(
          new ObjectID(),
          'rating',
          'Show radio if rating is more than or equal 2',
          {
            ratingOptions: {
              steps: 5,
              shape: 'Heart',
            },
          },
        )
        const conditionField2 = makeField(
          new ObjectID(),
          'radiobutton',
          'Show date if radio is others',
          {
            fieldOptions: ['Option 1', 'Option 2'],
            othersRadioButton: true,
          },
        )
        const logicField = makeField(new ObjectID(), 'date', 'Date field')
        const fields = [conditionField1, logicField, conditionField2]
        const formLogics = [
          {
            show: [conditionField2._id],
            _id: '5df12cf8e6b6e7108a939c99',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '57184',
                field: conditionField1._id,
                state: 'is more than or equal to',
                value: 2,
              },
            ],
            logicType: 'showFields',
          },
          {
            show: [logicField._id],
            _id: '5df12d0ee6b6e7108a939c9a',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '48323',
                field: conditionField2._id,
                state: 'is equals to',
                value: 'Others',
              },
            ],
            logicType: 'showFields',
          },
        ]
        it('shows logic regardless of field order', (done) => {
          reqFixtures.form.form_fields = fields
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              '2',
            ), // Fulfills condition
            makeResponse(
              logicField._id,
              logicField.fieldType,
              logicField.title,
              '12 Dec 2019',
              null,
              true,
            ), // This field should be shown
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              'Others: peas',
            ), // Fulfills condition
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })
      })
      describe('circular logic', () => {
        const conditionField1 = makeField(
          new ObjectID(),
          'yes_no',
          'Show field 2 if yes',
        )
        const conditionField2 = makeField(
          new ObjectID(),
          'yes_no',
          'Show field 3 if yes',
        )
        const conditionField3 = makeField(
          new ObjectID(),
          'yes_no',
          'Show field 1 if yes',
        )
        const visibleField = makeField(
          new ObjectID(),
          'textfield',
          'Text field',
        )
        const formLogics = [
          {
            show: [conditionField2._id],
            _id: '5df11ee1e6b6e7108a939c8a',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '9577',
                field: conditionField1._id,
                state: 'is equals to',
                value: 'Yes',
              },
            ],
            logicType: 'showFields',
          },
          {
            show: [conditionField3._id],
            _id: '5df11ee1e6b6e7108a939c8b',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '9577',
                field: conditionField2._id,
                state: 'is equals to',
                value: 'Yes',
              },
            ],
            logicType: 'showFields',
          },
          {
            show: [conditionField1._id],
            _id: '5df11ee1e6b6e7108a939c8c',
            conditions: [
              {
                ifValueType: 'single-select',
                _id: '9578',
                field: conditionField3._id,
                state: 'is equals to',
                value: 'Yes',
              },
            ],
            logicType: 'showFields',
          },
        ]
        it('correctly parses circular logic where all fields are hidden', (done) => {
          reqFixtures.form.form_fields = [
            conditionField1,
            conditionField2,
            conditionField3,
          ]
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
            makeResponse(
              conditionField3._id,
              conditionField3.fieldType,
              conditionField3.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })
        it('correctly parses circular logic for a mix of hidden and shown fields', (done) => {
          reqFixtures.form.form_fields = [
            conditionField1,
            conditionField2,
            conditionField3,
            visibleField,
          ]
          reqFixtures.form.form_logics = formLogics
          reqFixtures.body.responses = [
            makeResponse(
              conditionField1._id,
              conditionField1.fieldType,
              conditionField1.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
            makeResponse(
              conditionField2._id,
              conditionField2.fieldType,
              conditionField2.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
            makeResponse(
              conditionField3._id,
              conditionField3.fieldType,
              conditionField3.title,
              'Yes',
              null,
              false,
            ), // Circular, never shown
            makeResponse(
              visibleField._id,
              visibleField.fieldType,
              visibleField.title,
              'lorem',
            ), // Always shown
          ]
          const expected = getExpectedOutput(
            reqFixtures.form.form_fields,
            reqFixtures.body.responses,
          )
          prepareSubmissionThenCompare(expected, done)
        })
      })
    })
  })
})
