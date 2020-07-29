const {
  makeMongooseFixtures,
  makeModel,
  deleteDocById,
  getSubmission,
  createForm,
  expectStartPage,
  fillInForm,
  submitForm,
  expectEndPage,
  appUrl,
  getSubstringBetween,
  decodeHtmlEntities,
  expectContains,
  makeField,
  getResponseArray,
  getResponseTitle,
  expectSpcpLogin,
  getAuthFields,
} = require('../helpers/util')
const { myInfoFields } = require('../helpers/myinfo-form')
let db
let User
let Form
let Agency
let govTech
const testSpNric = 'S9912374E'
const testCpNric = 'S8979373D'
const testCpUen = '123456789A'
fixture('[Full] Email mode submissions')
  .before(async () => {
    db = await makeMongooseFixtures()
    Agency = makeModel(db, 'agency.server.model', 'Agency')
    User = makeModel(db, 'user.server.model', 'User')
    Form = makeModel(db, 'form.server.model', 'Form')
    govTech = await Agency.findOne({ shortName: 'govtech' }).exec()
  })
  .after(async () => {
    // Delete models defined by mongoose and close connection
    db.models = {}
    await db.close()
  })
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 800)
  })
  .afterEach(async (t) => {
    await deleteDocById(User, t.ctx.formData.user._id)
    await deleteDocById(Form, t.ctx.form._id)
  })

// For each of the following tests, a public form is created in the DB
// using the fields and options passed to createForm.

// The tests check that a browser is able to navigate to the form start
// page, fill in the form using the values given in formFields.val, submit
// the form and reach the end page.

// Basic form with only one field and SP authentication
test.before(async (t) => {
  const formData = await getDefaultFormOptions({
    authType: 'SP',
    status: 'PRIVATE',
    esrvcId: 'Test-eServiceId-Sp',
  })
  formData.formFields = [
    {
      title: 'short text',
      fieldType: 'textfield',
      val: 'Lorem Ipsum',
    },
  ].map(makeField)
  t.ctx.formData = formData
})('Create and submit basic form with SingPass authentication', async (t) => {
  let authData = { testSpNric }
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData, authData)
})

// Basic form with only one field and CP authentication
test.before(async (t) => {
  const formData = await getDefaultFormOptions({
    authType: 'CP',
    status: 'PRIVATE',
    esrvcId: 'Test-eServiceId-Cp',
  })
  formData.formFields = [
    {
      title: 'short text',
      fieldType: 'textfield',
      val: 'Lorem Ipsum',
    },
  ].map(makeField)
  t.ctx.formData = formData
})('Create and submit basic form with CorpPass authentication', async (t) => {
  let authData = { testCpNric, testCpUen }
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData, authData)
})

// Form with a mix of autofilled and non-autofilled MyInfo fields
test.before(async (t) => {
  const formData = await getDefaultFormOptions({
    authType: 'SP',
    esrvcId: 'Test-eServiceId-Sp',
  })
  formData.formFields = myInfoFields
  t.ctx.formData = formData
})('Create and submit basic MyInfo form', async (t) => {
  let authData = { testSpNric }
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData, authData)
})

// Checks that an attachment field's attachment is contained in the email.
const expectAttachment = async (t, field, attachments) => {
  // Attachments can only be in fields that are visible AND either required
  // or optional but filled
  if (field.isVisible && (field.required || !field.isLeftBlank)) {
    const attachment = attachments.find((att) => att.fileName === field.val)
    // Check that attachment exists
    await t.expect(attachment).ok()
    // Check that contents match
    await t.expect(attachment.content).eql(field.content)
  }
}

// Grab submission email and verify its contents
const verifySubmission = async (t, testFormData, authData) => {
  let { user, formFields, formOptions } = testFormData
  const authType = formOptions ? formOptions.authType : 'NIL'
  // Add verified authentication data (NRIC/UEN/UID) at the end
  formFields = formFields.concat(getAuthFields(authType, authData))
  formFields = formFields.filter((f) => f.fieldType !== 'section')

  const title = formOptions ? formOptions.title : ''
  const { html, subject, to, from, attachments } = await getSubmission(title)
  // Verify recipient of email
  await t.expect(to).eql(user.email)

  // Verify sender of email
  await t.expect(from).eql('FormSG <donotreply@mail.form.gov.sg>')

  // Verify subject of email
  await t.expect(subject).contains(`formsg-auto: ${title} (Ref:`)
  // Verify form content in email
  for (let field of formFields) {
    const contained = [
      getResponseTitle(field, false, 'email'),
      ...getResponseArray(field, 'email'),
    ]
    await expectContains(t, html, contained)
    if (field.fieldType === 'attachment') {
      await expectAttachment(t, field, attachments)
    }
  }

  // Verify JSON for data collation
  const emailJSONStr = getSubstringBetween(
    html,
    '<p>-- Start of JSON --</p>',
    '<p>-- End of JSON --</p>',
  )
  await t.expect(emailJSONStr).notEql(null)
  const emailJSON = JSON.parse(decodeHtmlEntities(emailJSONStr))
  const response = emailJSON.filter(
    ({ question }) => !/(Reference Number|Timestamp)/.test(question),
  )
  await t.expect(response.length).notEql(0)
  let rowIdx = 0 // A table could result in multiple rows of answers, so there might be more answers than form fields
  for (let field of formFields) {
    await t
      .expect(response[rowIdx].question)
      .eql(getResponseTitle(field, true, 'email'))
    for (let expectedAnswer of getResponseArray(field, 'email')) {
      await t.expect(response[rowIdx].answer).eql(expectedAnswer)
      rowIdx++
    }
  }
}

// Creates an object with default form options, with optional modifications.
const getDefaultFormOptions = async ({
  title = 'Submission e2e Form',
  authType = 'NIL',
  status = 'PUBLIC',
  esrvcId = '',
} = {}) => {
  title += String(Date.now())
  const user = await User.create({
    email: String(Date.now()) + '@data.gov.sg',
    agency: govTech._id,
  })
  return {
    user,
    formOptions: {
      responseMode: 'email',
      hasCaptcha: false,
      status,
      title,
      authType,
      esrvcId,
    },
  }
}

// Open form, fill it in, submit and verify submission
const verifySubmissionE2e = async (t, form, formData, authData) => {
  // Verify that form can be accessed
  await expectStartPage(t, form, formData, appUrl)
  if (authData) {
    await expectSpcpLogin(t, formData.formOptions.authType, authData)
  }
  // Fill in form=
  await fillInForm(t, form, formData)
  await submitForm(t)
  // Verify that end page is shown
  await expectEndPage(t)
  // Verify that submission is as expected
  await verifySubmission(t, formData, authData)
}
