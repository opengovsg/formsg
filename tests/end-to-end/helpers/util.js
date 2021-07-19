const axios = require('axios')
const { ClientFunction, Selector } = require('testcafe')
const _ = require('lodash')
const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const fs = require('fs')

const appUrl = 'http://localhost:5000'
const mailUrl = 'http://localhost:1080'
const dbUri = 'mongodb://127.0.0.1:3000/formsg'
const DATE = 17

const {
  formList,
  signInPage,
  formPage,
  createFormModal,
  createFormTemplateModal,
  adminTabs,
  settingsTab,
  activateFormModal,
  buildTab,
  editFieldModal,
  logicTab,
  editLogicModal,
  mockpass,
} = require('./selectors')

const { types } = require('../../../dist/backend/src/shared/resources/basic')

const { SPCPFieldTitle } = require('../../../dist/backend/src/types/field')

const NON_SUBMITTED_FIELDS = types
  .filter((field) => !field.submitted)
  .map((field) => field.name)

/**
 * Utility to manage receiving of emails
 */
const mailClient = {
  getAll: () => axios.get(`${mailUrl}/email`).then((res) => res.data),

  deleteAll: () => axios.delete(`${mailUrl}/email/all`),

  deleteById: (id) => axios.delete(`${mailUrl}/email/${id}`),

  getAttachment: (id, filename) =>
    axios.get(`${mailUrl}/email/${id}/attachment/${filename}`),
}

const getDownloadsFolder = () => {
  let downloadsFolder = `${process.env.HOME}/Downloads`
  try {
    fs.statSync(downloadsFolder)
  } catch (e) {
    downloadsFolder = '/tmp'
  }
  return downloadsFolder
}

/**
 * Enters given email in sign-in page.
 * @param {Object} t Testcafe browser
 * @param {string} email Email to log in
 */
async function enterEmail(t, email) {
  await t
    .typeText(signInPage.emailInput, email, { paste: true })
    .click(signInPage.getStartedBtn)
}

/**
 * Returns whether a particular bonus feature is enabled
 * @param {string} feature
 * @returns boolean
 */
async function getFeatureState(feature) {
  const featureStates = await axios.get(`${appUrl}/api/v3/client/features`)
  return featureStates.data[feature]
}

/**
 * Retrieves an email sent by FormSG.
 * @param {string} formName Title of form
 * @returns Object containing subject, sender, recipient and html
 * content of email
 */
async function getSubmission(formName) {
  let submission
  let lastEmail
  let subject = `formsg-auto: ${formName}`
  try {
    let inbox = await mailClient.getAll()
    let emails = getEmailsWithSubject(inbox, subject)
    lastEmail = emails.pop()
    submission = {
      html: lastEmail.html,
      subject: lastEmail.subject,
      to: lastEmail.headers.to,
      from: lastEmail.headers.from,
      attachments: await getSubmissionAttachments(lastEmail),
    }
  } catch (e) {
    throw Error('Failed to get submission email')
  } finally {
    if (lastEmail) {
      await mailClient.deleteById(lastEmail.id)
    }
  }
  return submission
}

// Fetches the file contents of each attachment and adds it to email.attachments
async function getSubmissionAttachments(email) {
  if (!email.attachments) {
    return []
  }
  for (let att of email.attachments) {
    const response = await mailClient.getAttachment(email.id, att.fileName)
    att.content = response.data
  }
  return email.attachments
}

function getEmailsTo(inbox, toEmail) {
  return inbox
    .filter((e) => _.get(e, 'to[0].address') === toEmail)
    .sort((a, b) => a.time > b.time)
}

function getEmailsWithSubject(inbox, subject) {
  return inbox
    .filter((e) => _.get(e, 'subject').indexOf(subject) !== -1)
    .sort((a, b) => a.time > b.time)
}

/**
 * Retrieves an OTP from an email's inbox.
 * @param {string} email
 */
async function extractOTP(email) {
  let otp
  let lastEmail
  try {
    let inbox = await mailClient.getAll()
    let emails = getEmailsTo(inbox, email)
    lastEmail = emails.pop()
    otp = lastEmail.html.match(/\d{6}/)[0]
  } catch (e) {
    throw Error('otp was not found in email')
  } finally {
    if (lastEmail) {
      await mailClient.deleteById(lastEmail.id)
    }
  }
  return otp
}

/**
 * Tests for either valid or invalid OTP to log in to FormSG.
 * @param {Object} t Testcafe browser
 * @param {string} otp
 * @param {boolean} isValid Whether OTP is expected to be valid
 * @param {string} email Email address of user
 */
async function enterOTPAndExpect({ t, otp, isValid, email }) {
  let userName = email
    ? email
        .charAt(0)
        .toUpperCase()
        .concat(email.toLowerCase().substring(1, email.indexOf('@')))
    : ''
  await t
    .typeText(signInPage.otpInput, otp, { paste: true })
    .click(signInPage.signInBtn)
  if (isValid) {
    await t
      .expect(getPageUrl())
      .eql(appUrl + '/#!/forms')
      .expect(formList.welcomeMessage.textContent)
      .contains('Welcome ' + userName + '!')
  } else {
    await t
      .expect(signInPage.otpMsg.textContent)
      .contains('OTP is invalid. Please try again.')
  }
}

/**
 * Tests that login OTP was sent.
 * @param {Object} t Testcafe browser
 * @param {string} email User's email
 */
async function expectOtpSent(t, email) {
  await t.expect(signInPage.otpMsg.textContent).contains('OTP sent to ' + email)
}

/**
 * Tests that verification OTP was sent.
 * @param {Object} t Testcafe browser
 * @param {string} fieldId ID of verifiable field
 */
async function expectVfnOtpSent(t, fieldId) {
  await t.expect(formPage.getFieldElement(fieldId, '.vfn-section').visible).ok()
}

// Grab page url
const getPageUrl = ClientFunction(() => window.location.href)

// Get absolute path of file
function spec(path) {
  let fullPath = `${process.env.PWD}/${path}`
  return require(fullPath)
}

/**
 * Connects to mongo-memory-server instance.
 */
async function makeMongooseFixtures() {
  const connection = await mongoose.createConnection(dbUri, {
    reconnectTries: 5,
    useNewUrlParser: true,
  })
  return connection
}

/**
 * Creates Mongoose model.
 * @param {Object} db Return value of makeMongooseFixtures
 * @param {string} modelFilename Name of file which exports model in app/models
 * @param {string} modelName Name of exported model
 */
function makeModel(db, modelFilename, modelName) {
  if (modelName !== undefined && modelName !== null) {
    // check if model has already been compiled
    try {
      return db.model(modelName)
    } catch (error) {
      if (error.name !== 'MissingSchemaError') {
        console.error(error)
      }
      // else fail silently as we will create the model
    }
  }

  // Need this try catch block as some schemas may have been converted to
  // TypeScript and use default exports instead.
  try {
    return spec(`dist/backend/src/app/models/${modelFilename}`)(db)
  } catch (e) {
    return spec(`dist/backend/src/app/models/${modelFilename}`).default(db)
  }
}

/**
 * Create login credentials of user with specified email.
 * @param {string} email
 */
const logInWithEmail = async (t, email) => {
  await t.navigateTo(`${appUrl}/#!/signin`)
  await enterEmail(t, email)
  await expectOtpSent(t, email)
  const otp = await extractOTP(email)
  await enterOTP(t, otp)
}

/**
 * Clears a collection of a document with the given id.
 * Usually used in 'after' hooks in tests.
 * @param {Object} collection MongoDB collection
 * @param {Object} id Document's ID as given by its _id field.
 */
function deleteDocById(collection, id) {
  return new Promise((resolve, reject) => {
    collection.deleteOne({ _id: id }, (err, _result) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Creates a form by selecting a template
 * @param {Object} user User object from DB
 * @param {Object} formOptions Example as follows:
 * basicFormData.formOptions = {
    responseMode: 'encrypt',
    status: 'PUBLIC',
    authType: 'NIL',
    hasCaptcha: false,
    title: 'Basic Form',
    publicKey: publicKey,
 * }
 * @param {Object} Form Mongoose model of Form
 */
async function createFormFromTemplate(
  t,
  { user, formOptions },
  Form,
  captchaEnabled,
) {
  const { email } = user
  await logInWithEmail(t, email)
  await addNewFormBySelectTemplate(t, formOptions)
  await addSettings(t, formOptions, captchaEnabled)
  const formId = getFormIdFromUrl(await getPageUrl())
  return Form.findOne({ _id: formId })
}

/**
 * Creates a form with the given specifications.
 * @param {Object} user User object from DB
 * @param {Object} formOptions Example as follows:
 * basicFormData.formOptions = {
    responseMode: 'encrypt',
    status: 'PUBLIC',
    authType: 'NIL',
    hasCaptcha: false,
    title: 'Basic Form',
    publicKey: publicKey,
 * }
 * @param {Array} formFields List of fields to be created
 * @param {Object} Form Mongoose model of Form
 */
async function createForm(
  t,
  { user, formOptions, formFields, logicData },
  Form,
  captchaEnabled,
  webhookUrl,
) {
  const { email } = user
  await logInWithEmail(t, email)
  await addNewForm(t, formOptions)
  // Need to add settings first so MyInfo fields can be added
  await addSettings(t, formOptions, captchaEnabled, webhookUrl)
  await addFields(t, formFields)
  if (logicData) {
    await addLogic(t, logicData, formFields)
  }
  const formId = getFormIdFromUrl(await getPageUrl())
  return Form.findOne({ _id: formId })
}

async function addFields(t, formFields) {
  await t.click(adminTabs.build)
  for (let field of formFields) {
    await createField(t, field)
  }
}

async function addLogic(t, logicData, formFields) {
  await t.click(adminTabs.logic)
  for (let logicUnit of logicData) {
    await t.click(logicTab.addLogicBtn)
    await addLogicUnit(t, logicUnit, formFields)
  }
}

async function addLogicUnit(t, logicUnit, formFields) {
  await addLogicCondition(t, 0, logicUnit.conditions[0], formFields)
  for (let i = 1; i < logicUnit.conditions.length; i++) {
    await t.click(editLogicModal.addConditionBtn)
    await addLogicCondition(t, i, logicUnit.conditions[i], formFields)
  }
  if (logicUnit.logicType === 'showFields') {
    await t.click(editLogicModal.showFieldsBtn)
    for (let i = 0; i < logicUnit.showFieldIndices.length; i++) {
      await addLogicShowField(t, i, logicUnit.showFieldIndices[i], formFields)
    }
  } else {
    await t.click(editLogicModal.preventSubmitBtn)
    await t.typeText(
      editLogicModal.preventSubmitTextArea,
      logicUnit.preventSubmitMessage,
    )
  }
  await t.click(editLogicModal.saveBtn)
}

async function addLogicShowField(
  t,
  indexInShowFields,
  indexInForm,
  formFields,
) {
  if (indexInShowFields === 0) {
    await selectDropdownOption(
      t,
      editLogicModal.showFieldsDropdown,
      formFields[indexInForm].title,
    )
  } else {
    await selectDropdownOptionSeparate(
      t,
      editLogicModal.showFieldsSearch,
      editLogicModal.showFieldsDropdown,
      formFields[indexInForm].title,
    )
  }
}

// n is the index of the condition in the conditions array
async function addLogicCondition(t, n, condition, formFields) {
  const fieldTitle = formFields[condition.fieldIndex].title
  await selectDropdownOption(
    t,
    editLogicModal.getNthConditionField(n),
    fieldTitle,
  )
  await selectDropdownOption(
    t,
    editLogicModal.getNthConditionState(n),
    condition.state,
  )
  if (condition.ifValueType === 'number') {
    await t.typeText(editLogicModal.getNthConditionValue(n), condition.value)
  } else if (condition.ifValueType === 'single-select') {
    await selectDropdownOption(
      t,
      editLogicModal.getNthConditionValue(n),
      condition.value,
    )
  } else {
    await selectDropdownOption(
      t,
      editLogicModal.getNthConditionValue(n),
      condition.value[0],
    )
    for (let i = 1; i < condition.value.length; i++) {
      // These gymnastics are necessary because if there is already one field
      // selected, the dropdown doesn't show if you click exactly in the middle
      // of the div, as is TestCafe's default. Hence we click one div to open the
      // dropdown, and get the option to click from another div.
      await selectDropdownOptionSeparate(
        t,
        editLogicModal.getNthConditionValueMulti(n),
        editLogicModal.getNthConditionValue(n),
        condition.value[i],
      )
    }
  }
}

// Note that this assumes that you don't switch between MyInfo and Basic fields.
async function createField(t, field) {
  if (_.get(field, 'myInfo.attr')) {
    await t
      .click(buildTab.myInfoTab)
      .click(buildTab.getMyInfoPanel(field.myInfo.attr))
      .click(editFieldModal.saveBtn)
  } else {
    await createBasicField(t, field)
  }
}

async function createBasicField(t, field) {
  await t.click(buildTab.getFieldPanel(field.fieldType))
  // Enter field title
  if (!NON_SUBMITTED_FIELDS.includes(field.fieldType)) {
    await t.selectText(editFieldModal.title).pressKey('delete')
    await t.typeText(editFieldModal.title, field.title)
  }
  switch (field.fieldType) {
    case 'email':
      if (field.isVerifiable) {
        await t.click(editFieldModal.getToggle('OTP verification'))
      }
      break
    case 'radiobutton':
      await setRatingCheckboxOptions(t, 0, field.fieldOptions[0])
      for (let i = 1; i < field.fieldOptions.length; i++) {
        await t.click(editFieldModal.addOption)
        await setRatingCheckboxOptions(t, i, field.fieldOptions[i])
      }
      if (field.othersRadioButton) {
        await t.click(editFieldModal.getToggle('Others option'))
      }
      break
    case 'checkbox':
      await t.selectText(editFieldModal.optionTextArea).pressKey('delete')
      // The wait(500) is necessary because of the debounce time in reloadDropdownField
      await t
        .typeText(editFieldModal.optionTextArea, field.fieldOptions.join('\n'))
        .wait(500)
      if (field.othersRadioButton) {
        await t.click(editFieldModal.getToggle('Others option'))
      }
      break
    case 'dropdown':
      await t.selectText(editFieldModal.optionTextArea).pressKey('delete')
      // The wait(500) is necessary because of the debounce time in reloadDropdownField
      await t
        .typeText(editFieldModal.optionTextArea, field.fieldOptions.join('\n'))
        .wait(500)
      break
    case 'rating':
      await selectDropdownOption(
        t,
        editFieldModal.rating.ratingStepsDropdown,
        field.ratingOptions.steps,
      )
      await selectDropdownOption(
        t,
        editFieldModal.rating.ratingShapeDropdown,
        field.ratingOptions.shape,
      )
      break
    case 'table':
      await setTableColOptions(t, 0, field.columns[0])
      for (let i = 1; i < field.columns.length; i++) {
        await t.click(editFieldModal.table.addColumn)
        await setTableColOptions(t, i, field.columns[i])
      }
      break
    case 'decimal':
      if (field.validateByValue) {
        await t.click(editFieldModal.getToggle('Range Validation'))
        if (field.ValidationOptions.customMin) {
          await t.typeText(
            editFieldModal.minValInput,
            String(field.ValidationOptions.customMin),
          )
        }
        if (field.ValidationOptions.customMax) {
          await t.typeText(
            editFieldModal.maxValInput,
            String(field.ValidationOptions.customMax),
          )
        }
      }
      break
    case 'attachment':
      await selectDropdownOption(
        t,
        editFieldModal.attachmentSizeDropdown,
        field.attachmentSize,
      )
      break
    default:
      break
  }
  // Set field to optional. Ignore tables as the required option is
  // set for individual columns.
  if (!field.required && field.fieldType !== 'table') {
    await t.click(editFieldModal.getToggle('Required'))
  }
  await t.click(editFieldModal.saveBtn)
}

async function setRatingCheckboxOptions(t, n, option) {
  const input = editFieldModal.getOptionInput(n)
  await t.selectText(input).pressKey('delete')
  await t.typeText(input, option)
}

async function setTableColOptions(t, n, colOptions) {
  await t.selectText(editFieldModal.table.getNthColTitle(n)).pressKey('delete')
  await t.typeText(editFieldModal.table.getNthColTitle(n), colOptions.title)
  if (colOptions.columnType === 'textfield') {
    await selectDropdownOption(
      t,
      editFieldModal.table.getNthColFieldType(n),
      'Text Field',
    )
  } else {
    await selectDropdownOption(
      t,
      editFieldModal.table.getNthColFieldType(n),
      'Dropdown',
    )
    await t
      .typeText(
        editFieldModal.table.getNthColTextArea(n),
        colOptions.fieldOptions.join('\n'),
      )
      .wait(400) // necessary due to debounce time in textarea
  }
  if (!colOptions.required) {
    await t.click(editFieldModal.table.getNthColRequiredToggle(n))
  }
}

async function selectDropdownOption(t, selector, text) {
  await t.click(selector).click(getDropdownOption(selector, text))
}

// This is for the case where a separate element has to be clicked to
// open the dropdown vs select the option, e.g. in the logic modal
async function selectDropdownOptionSeparate(
  t,
  dropdownSelector,
  optionSelector,
  text,
) {
  await t.click(dropdownSelector).click(getDropdownOption(optionSelector, text))
}

function getDropdownOption(selector, text) {
  return selector.find('.ui-select-choices-row').withText(String(text))
}

function getFormIdFromUrl(url) {
  return getSubstringBetween(url, '#!/', '/admin')
}

async function addSettings(t, formOptions, captchaEnabled, webhookUrl) {
  await t.click(adminTabs.settings)

  // Expect auth type to be none by default, then change it
  await t.expect(settingsTab.getAuthRadioInput('NIL').checked).ok()
  if (formOptions.authType !== 'NIL') {
    await t.click(settingsTab.getAuthRadioLabel(formOptions.authType))
    await t.typeText(settingsTab.esrvcIdInput, formOptions.esrvcId)
  }

  // Expect form title to be correct
  await t.expect(settingsTab.formTitleInput.value).eql(formOptions.title)

  if (captchaEnabled) {
    // Expect captcha to be active, then set it
    await t.expect(settingsTab.captchaToggleInput.checked).ok()
    if (!formOptions.hasCaptcha) {
      await t.click(settingsTab.captchaToggleLabel)
    }
  }

  if (webhookUrl) {
    await t.typeText(settingsTab.webhookUrlInput, webhookUrl)
  }

  // Expect form to be inactive, then activate it
  await t
    .expect(settingsTab.formStatus.textContent)
    .contains('Your form is inactive')
  await t.click(settingsTab.activateBtn)
  if (formOptions.responseMode === 'encrypt') {
    await t
      .typeText(activateFormModal.secretKeyInput, formOptions.secretKey)
      .typeText(
        activateFormModal.acknowledgementInput,
        'I have shared my secret key with a colleague',
      )
      .click(activateFormModal.activateFormBtn)
  } else if (formOptions.authType !== 'NIL') {
    await t.click(activateFormModal.closeModalBtn)
  }
  await t
    .expect(settingsTab.formStatus.textContent)
    .contains('Your form is active')
}

async function addNewFormBySelectTemplate(t, formOptions) {
  await t
    .click(formList.createFormBtn)
    .click(createFormModal.templateCard) // temperature taking template
    .click(createFormTemplateModal.useTemplateBtn)
  if (formOptions.responseMode === 'email') {
    await addNewEmailForm(t, formOptions)
  } else {
    await addNewEncryptForm(t, formOptions)
  }
}

async function addNewForm(t, formOptions) {
  await t
    .click(formList.createFormBtn)
    .click(createFormModal.startFromScratchBtn)
  if (formOptions.responseMode === 'email') {
    await addNewEmailForm(t, formOptions)
  } else {
    await addNewEncryptForm(t, formOptions)
  }
}

async function addNewEmailForm(t, formOptions) {
  await t
    .typeText(createFormModal.formTitleInput, formOptions.title, {
      paste: true,
    })
    .click(createFormModal.emailModeRadio)
    .click(createFormModal.startBtn)
}

async function addNewEncryptForm(t, formOptions) {
  await t
    .typeText(createFormModal.formTitleInput, formOptions.title, {
      paste: true,
    })
    .click(createFormModal.encryptModeRadio)
    .click(createFormModal.startBtn)
  formOptions.secretKey = await createFormModal.secretKeyDiv.innerText
  await t
    .click(createFormModal.downloadKeyBtn)
    .click(createFormModal.encryptModeContinueBtn)
}

/**
 * Expect start page to be shown with form title.
 * @param {Object} t Testcafe browser
 * @param {Object} testForm Form object from DB
 * @param {Object} testFormData.formOptions Object specifying form options as per createForm
 * @param {string} appUrl URL of app
 */
async function expectStartPage(t, testForm, testFormData, appUrl) {
  let { _id } = testForm
  let { formOptions } = testFormData
  // Client side redirect from /123 to /#!/123 should work
  await t
    .navigateTo(`${appUrl}/${_id}`)
    .expect(getPageUrl())
    .contains(_id)
    .expect(formPage.startTitle.textContent)
    .contains(formOptions.title)
}

/**
 * Fill in form based in field type.
 * @param {Object} t Testcafe browser
 * @param {Object} testForm Form object from DB
 * @param {Object} testFormData.formFields Object specifying responses to each field
 * @param {string} appUrl URL of app
 */
async function fillInForm(t, testForm, testFormData) {
  let { formFields } = testFormData
  for (let i in formFields) {
    const field = formFields[i]
    const fieldId = testForm.form_fields[i]._id
    if (field.isLeftBlank || !field.isVisible || field.disabled) {
      continue
    }
    switch (field.fieldType) {
      case 'textarea':
        await t.typeText(
          formPage.getFieldElement(fieldId, 'textarea'),
          field.val,
          {
            paste: true,
          },
        )
        break
      case 'nric':
      case 'number':
      case 'email':
      case 'textfield':
      case 'decimal':
      case 'mobile':
        await t.typeText(
          formPage.getFieldElement(fieldId, 'input'),
          field.val,
          {
            paste: true,
          },
        )
        if (field.isVerifiable) {
          await verifyField(t, fieldId, field.val)
        }
        break
      case 'radiobutton': {
        let radioLabels = formPage.getFieldElement(fieldId, 'label')
        let radio = radioLabels.withText(field.val)
        let radioExists = await radio.exists
        if (radioExists) {
          await t.click(radio.child('.radiomark'))
        } else {
          radio = radioLabels.withText('Others')
          await t
            .click(radio)
            .typeText(
              formPage.getFieldElement(fieldId, 'input[type="text"]'),
              field.val,
              { paste: true },
            )
        }
        break
      }
      case 'yes_no': {
        let yesNo = formPage.getFieldElement(fieldId)
        let toggle = yesNo.find('label').withText(field.val.toUpperCase())
        await t.click(toggle)
        break
      }
      case 'checkbox': {
        let checkboxLabels = formPage.getFieldElement(fieldId, 'label')
        for (let option of field.val) {
          let checkbox = checkboxLabels.withText(option)
          let checkboxExists = await checkbox.exists
          if (checkboxExists) {
            await t.click(checkbox)
          } else {
            checkbox = checkboxLabels.withText('Others')
            await t
              .click(checkbox)
              .typeText(
                formPage.getFieldElement(fieldId, 'input[type="text"]'),
                option,
                {
                  paste: true,
                },
              )
          }
        }
        break
      }
      case 'dropdown': {
        await selectDropdownOption(
          t,
          formPage.getFieldElement(fieldId),
          field.val,
        )
        break
      }
      case 'date': {
        let datePicker = formPage.getFieldElement(fieldId, 'input')
        let today = datePicker
          .nextSibling(0)
          .find('button')
          .withText(new RegExp(`^(${DATE})$`))
        await t.click(datePicker).click(today)
        break
      }
      case 'rating': {
        let rating = formPage.getFieldElement(fieldId, 'ul')
        let star = rating.child(parseInt(field.val) - 1)
        await t.click(star)
        break
      }
      case 'table': {
        const tableData = field
        const table = testForm.form_fields[i]

        for (let col = 0; col < table.columns.length; col++) {
          for (let row = 0; row < table.minimumRows; row++) {
            let valueToFillIn = tableData.val[row][col]
            switch (table.columns[col].columnType) {
              case 'textfield':
                await t.typeText(
                  formPage.getTableCell(fieldId, row, col),
                  valueToFillIn,
                  {
                    paste: true,
                  },
                )
                break
              case 'dropdown': {
                await selectDropdownOption(
                  t,
                  formPage.getTableCell(fieldId, row, col),
                  valueToFillIn,
                )
              }
            }
          }
        }
        break
      }
      case 'attachment':
        // Note that the given path must be relative to the file containing the test
        await t.setFilesToUpload(
          formPage.getFieldElement(fieldId, 'input'),
          field.path,
        )
        break
      default:
        continue
    }
  }
}

/**
 * Verifies a verifiable field.
 * @param {Object} t Testcafe browser
 * @param {string} fieldId ID of field to verify
 * @param {string} email Email used in field response
 */
async function verifyField(t, fieldId, email) {
  await t.click(formPage.getFieldElement(fieldId, '.vfn-btn'))
  await expectVfnOtpSent(t, fieldId)
  const otp = await extractOTP(email)
  await t.typeText(formPage.getFieldElement(fieldId, '.vfn-section input'), otp)
  await t.click(formPage.getFieldElement(fieldId, '.vfn-section button'))
}

/**
 * Expect end page to be shown with thank you message.
 * @param {Object} t Testcafe browser
 */
async function expectEndPage(t) {
  let endPageTitle
  if (_.isUndefined(t.ctx.endPageTitle)) {
    endPageTitle = 'Thank you for filling out the form.'
  } else {
    endPageTitle = t.ctx.endPageTitle
  }

  await t.expect(formPage.endTitle.textContent).contains(endPageTitle)
}

/**
 * Clicks the submit button.
 * @param {Object} t Testcafe browser
 */
async function submitForm(t) {
  await t.click(formPage.submitBtn)
}

/**
 * Types an OTP into the sign-in text box.
 * @param {Object} t Testcafe browser
 * @param {string} otp
 */
async function enterOTP(t, otp) {
  await t
    .typeText(signInPage.otpInput, otp, { paste: true })
    .click(signInPage.signInBtn)
}

// Fills nested arrays with given value.
function fillRecursive(obj, value) {
  if (Array.isArray(obj)) {
    return obj.map((elt) => fillRecursive(elt, value))
  }
  return value
}

/**
 * Returns an optional version of a field.
 * @param {Object} field
 */
function getOptionalVersion(field) {
  const optionalField = _.cloneDeep(field)
  optionalField.required = false
  if (optionalField.fieldType === 'table') {
    optionalField.columns.forEach((column) => {
      column.required = false
    })
  }
  return optionalField
}

/**
 * Returns a field with a blank response.
 * @param {Object} field
 */
function getBlankVersion(field) {
  const blankField = _.cloneDeep(field)
  blankField.isLeftBlank = true
  blankField.val =
    blankField.fieldType === 'table' ? fillRecursive(blankField.val, '') : ''
  return blankField
}

/**
 * Returns a hidden version of a field.
 * @param {Object} field
 */
function getHiddenVersion(field) {
  const hiddenField = _.cloneDeep(field)
  hiddenField.isVisible = false
  return hiddenField
}

/**
 * Creates a field for e2e tests with default options (visible, required, not blank).
 * @param {Object} fieldObj Custom options of the field.
 * @param {string} fieldObj.title Mandatory title of field
 * @param {string} fieldObj.fieldType Type of field. Mandatory unless makeField is
 * being called to create an artificial field for verified SingPass/CorpPass data.
 * @param {string} fieldObj.val Mandatory answer to field
 */
function makeField(fieldObj) {
  return Object.assign(
    {
      required: true,
      isVisible: true,
      isLeftBlank: false,
    },
    fieldObj,
  )
}

/**
 * Fetches a substring of text between two string markers.
 * @param {string} text Text to substring
 * @param {string} markerStart String after which result starts
 * @param {string} markerEnd String before which result ends
 */
const getSubstringBetween = (text, markerStart, markerEnd) => {
  const start = text.indexOf(markerStart)
  if (start === -1) {
    return null
  } else {
    const end = text.indexOf(markerEnd, start)
    return end === -1 ? null : text.substring(start + markerStart.length, end)
  }
}

/**
 * Converts given string from encoded HTML to plain text.
 * @param {string} html
 */
const decodeHtmlEntities = (html) =>
  html.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))

/**
 * Tests that container contains all the values in contained.
 * @param {Object} t Testcafe browser
 * @param {string} container String in which to search
 * @param {Array[string]} containedArray Array of values to search for
 */
const expectContains = async (t, container, containedArray) => {
  for (let contained of containedArray) {
    await t.expect(container).contains(contained)
  }
}

/**
 * Creates a list of integers, inclusive of the parameters.
 * @param {number} from starting index (inclusive)
 * @param {number} to ending index (inclusive)
 */
const listIntsInclusive = (from, to) => {
  const result = []
  for (let i = from; i <= to; i++) {
    result.push(i)
  }
  return result
}

// Utility for getting responses for table
const tableHandler = {
  getName: (tableField, formMode) => {
    const { title, columns } = tableField
    let tableTitle = `${title} (${columns.map((x) => x.title).join(', ')})`
    if (formMode === 'email') {
      tableTitle = '[table] ' + tableTitle
    }
    return tableTitle
  },
  getValues: (tableField, formMode) => {
    if (formMode === 'email') {
      return tableField.val.map((row) => row.join(','))
    } else {
      // storage mode has a space
      return tableField.val.map((row) => row.join(', '))
    }
  },
}

/**
 * Gets answers for a field as displayed in response email or decrypted submission.
 * Always returns an array, so caller must always loop through result.
 * @param {Object} field Field as created by makeField
 * @param {string} formMode 'email' or 'encrypt'
 */
const getResponseArray = (field, formMode) => {
  // Deal with table first to avoid special cases later
  if (field.fieldType === 'table') {
    return tableHandler.getValues(field, formMode)
  }
  // Only allow blanks if field is not visible or optional
  if (!field.isVisible || (!field.required && field.isLeftBlank)) {
    return ['']
  }
  switch (field.fieldType) {
    case 'checkbox':
      return [
        field.val
          .map((selected) => {
            return field.fieldOptions.includes(selected)
              ? selected
              : `Others: ${selected}`
          })
          .join(', '),
      ]
    case 'radiobutton':
      return [
        field.fieldOptions.includes(field.val)
          ? field.val
          : `Others: ${field.val}`,
      ]
    default:
      return [
        field.val instanceof Array ? field.val.join(', ') : String(field.val),
      ]
  }
}

/**
 * Gets the title of a field as it is displayed in a response.
 * @param {Object} field Field as created by makeField
 * @param {boolean} isInJson Whether the title is within the
 * JSON data for email submissions
 * @param {string} formMode 'email' or 'encrypt'
 */
const getResponseTitle = (field, isInJson, formMode) => {
  if (field.fieldType === 'table') {
    return tableHandler.getName(field, formMode)
  } else if (field.fieldType === 'attachment') {
    let title = field.title
    if (formMode === 'email') {
      title = `[attachment] ${title}`
    }
    return title
  } else {
    if (isInJson) {
      if (field.title.startsWith('[verified] ')) {
        return field.title.substr(11)
      } else if (field.title.startsWith('[MyInfo] ')) {
        return field.title.substr(9)
      }
    }
    return field.title
  }
}

/**
 * Tests for the SP/CP login page and logs in.
 * @param {Object} t Testcafe browser
 * @param {string} authType SP, CP or NIL
 * @param {Object} authData Must contain a testSpNric or (testCpNric and testCpUen)
 */
const expectSpcpLogin = async (t, authType, authData) => {
  const { testSpNric, testCpNric, testCpUen } = authData
  switch (authType) {
    case 'MyInfo':
      await t
        .expect(formPage.spcpLoginBtn.textContent)
        .contains(`Login with Singpass`)
        .click(formPage.spcpLoginBtn)
        .click(mockpass.loginBtn)
        .click(mockpass.nricDropdownBtn)
        .click(mockpass.getNricOption(testSpNric))
        .click(mockpass.consentBtn)
        .expect(formPage.spcpLogoutBtn.textContent)
        .contains(`${testSpNric} - Log out`)
      break
    case 'SP':
      await t
        .expect(formPage.spcpLoginBtn.textContent)
        .contains(`Login with Singpass`)
        .click(formPage.spcpLoginBtn)
        .click(mockpass.loginBtn)
        .click(mockpass.nricDropdownBtn)
        .click(mockpass.getNricOption(testSpNric))
        .expect(formPage.spcpLogoutBtn.textContent)
        .contains(`${testSpNric} - Log out`)
      break
    case 'CP':
      await t
        .expect(formPage.spcpLoginBtn.textContent)
        .contains(`Login with Singpass (Corporate)`)
        .click(formPage.spcpLoginBtn)
        .click(mockpass.loginBtn)
        .click(mockpass.nricDropdownBtn)
        .click(mockpass.getNricUenOption(testCpNric, testCpUen))
        .expect(formPage.spcpLogoutBtn.textContent)
        .contains(`${testCpUen} - Log out`)
      break
    default:
      throw new Error('Invalid authentication type!')
  }
}

/**
 * Creates a field to imitate the verified NRIC for SingPass or verified
 * UEN or UID for CorpPass. Used to validate submissions for SP/CP
 * authenticated forms.
 * @param {string} authType one of 'NIL', 'SP' or 'CP'
 * @param {Object} authData Contains testSpNric for authType === 'SP' and
 * both testCpNric and testCpUen for authType === 'CP'
 * @returns {Array} Array of new artificial authenticated fields
 */
const getAuthFields = (authType, authData) => {
  switch (authType) {
    case 'NIL':
      return []
    case 'MyInfo':
    case 'SP':
      return [
        makeField({
          title: SPCPFieldTitle.SpNric,
          val: authData.testSpNric,
        }),
      ]
    case 'CP':
      return [
        { title: SPCPFieldTitle.CpUen, val: authData.testCpUen },
        {
          title: SPCPFieldTitle.CpUid,
          val: authData.testCpNric,
        },
      ].map(makeField)
    default:
      throw new Error('Invalid authentication type!')
  }
}

/**
 * Expects form submisision to be disabled and toast message to be shown.
 * @param {Object} browser Testcafe browser
 * @param {string} toastMessage message to be shown in toast when form is disabled
 */
async function expectFormDisabled(browser, toastMessage) {
  await browser.expect(formPage.submitBtn.getAttribute('disabled')).ok()
  await browser.expect(Selector('.toast-message').textContent).eql(toastMessage)
}

/**
 * Opens a form and verifies that submission is disabled when the given answers are filled.
 * @param {Object} browser Testcafe browser
 * @param {Object} form Form object from DB
 * @param {Object} formData Data based on which to fill in form
 * @param {Object} formData.formOptions Object specifying form options as per createForm
 * @param {string} disabledMessage Message to show in toaster when form is disabled
 * @param {Object} [authData] Authentication data for SingPass/CorpPass if form is authenticated
 * @param {string} [authData.testSpNric] NRIC for SingPass login
 * @param {string} [authData.testCpNric] NRIC for CorpPass login
 * @param {string} [authData.testCpUen] UEN for CorpPass login
 */
const verifySubmissionDisabled = async (
  browser,
  form,
  formData,
  disabledMessage,
  authData,
) => {
  // Verify that form can be accessed
  await expectStartPage(browser, form, formData, appUrl)
  if (authData) {
    await expectSpcpLogin(browser, formData.formOptions.authType, authData)
  }
  // Fill in form
  await fillInForm(browser, form, formData)
  // Expect form to be disabled with message
  await expectFormDisabled(browser, disabledMessage)
}

module.exports = {
  mailClient,
  enterEmail,
  extractOTP,
  enterOTPAndExpect,
  expectOtpSent,
  getPageUrl,
  makeMongooseFixtures,
  makeModel,
  logInWithEmail,
  appUrl,
  deleteDocById,
  getSubmission,
  emptyMailServer: mailClient.deleteAll,
  createFormFromTemplate,
  createForm,
  expectStartPage,
  fillInForm,
  submitForm,
  expectEndPage,
  enterOTP,
  addLogic,
  getOptionalVersion,
  getBlankVersion,
  getHiddenVersion,
  makeField,
  getSubstringBetween,
  decodeHtmlEntities,
  expectContains,
  listIntsInclusive,
  getResponseArray,
  getResponseTitle,
  expectSpcpLogin,
  getAuthFields,
  verifySubmissionDisabled,
  getDownloadsFolder,
  getFeatureState,
}
