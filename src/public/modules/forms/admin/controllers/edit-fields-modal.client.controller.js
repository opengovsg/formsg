'use strict'

const axios = require('axios').default
const values = require('lodash/values')
const cloneDeep = require('lodash/cloneDeep')

const {
  EditFieldActions,
  VALID_UPLOAD_FILE_TYPES,
  MAX_UPLOAD_FILE_SIZE,
} = require('shared/constants')
const { UPDATE_FORM_TYPES } = require('../constants/update-form-types')
const { uploadImage } = require('../../../../services/FileHandlerService')

const CancelToken = axios.CancelToken

const DATE_VALIDATION_OPTIONS = {
  disallowPast: 'Disallow past dates',
  disallowFuture: 'Disallow future dates',
  custom: 'Custom date range',
}

const EMAIL_MODE_ALLOWED_SIZES = ['1', '2', '3', '7']

angular
  .module('forms')
  .controller('EditFieldsModalController', [
    '$scope',
    '$uibModalInstance',
    'externalScope',
    'responseModeEnum',
    'Rating',
    'Attachment',
    'FormFields',
    '$q',
    'Betas',
    'Auth',
    '$state',
    EditFieldsModalController,
  ])

function EditFieldsModalController(
  $scope,
  $uibModalInstance,
  externalScope,
  responseModeEnum,
  Rating,
  Attachment,
  FormFields,
  $q,
  Betas,
  Auth,
  $state,
) {
  let source
  const vm = this

  // Copy so as to not touch the original
  vm.field = angular.copy(externalScope.currField)
  vm.responseModeEnum = responseModeEnum
  vm.isConditionField = externalScope.isConditionField
  vm.myform = externalScope.myform
  vm.attachmentsMax = externalScope.attachmentsMax

  if (
    ['dropdown', 'checkbox'].includes(vm.field.fieldType) &&
    vm.field.fieldOptions.length > 0
  ) {
    vm.field.fieldOptionsFromText = vm.field.fieldOptions.join('\n')
  } else if (['radiobutton'].includes(vm.field.fieldType)) {
    vm.field.manualOptions = vm.field.fieldOptions
  }

  // Serialize allowed email domains
  vm.user = Auth.getUser() || $state.go('signin')
  if (vm.field.fieldType === 'email') {
    const userEmailDomain = '@' + vm.user.email.split('@').pop()
    vm.field.hasAllowedEmailDomains = vm.field.allowedEmailDomains.length > 0
    vm.field.allowedEmailDomainsPlaceholder = `${userEmailDomain}\n@agency.gov.sg`
    if (vm.field.hasAllowedEmailDomains) {
      vm.field.allowedEmailDomainsFromText = vm.field.allowedEmailDomains.join(
        '\n',
      )
    }
    $scope.$watch('vm.field.allowedEmailDomainsFromText', (newValue) => {
      if (newValue) {
        vm.tooltipHtml = 'e.g. @mom.gov.sg, @moe.gov.sg'
      } else {
        vm.tooltipHtml =
          'e.g. @mom.gov.sg, @moe.gov.sg<br>OTP verification needs to be activated first.'
      }
    })
  }

  // Set Validation Options on older paragraph fields - This ensures backward compatibility
  // TODO: Is this safe to remove?
  vm.enforceCompatibility = function (field) {
    if (
      FormFields.isCustomValField(field.fieldType) &&
      !field.ValidationOptions
    ) {
      vm.clearCustomValidation(field)
    }
  }

  // decides whether field options block will be shown
  vm.showAddOptions = function (field) {
    return (
      field.fieldType === 'dropdown' ||
      field.fieldType === 'checkbox' ||
      field.fieldType === 'radiobutton'
    )
  }

  // add new option to the field
  vm.addOption = function (currField) {
    if (['dropdown', 'checkbox', 'radiobutton'].includes(currField.fieldType)) {
      currField.manualOptions = currField.manualOptions
        ? currField.manualOptions
        : []
      const currNumOfOptions = currField.manualOptions.length
      currField.manualOptions.push(`Option ${currNumOfOptions + 1}`)
      if (currField.fieldType === 'checkbox') {
        currField.fieldValue.splice(currNumOfOptions, 0, false)
      }
    }
  }

  // delete particular option
  vm.deleteOption = function (currField, option) {
    if (['checkbox', 'radiobutton'].includes(currField.fieldType)) {
      const indexToDelete = currField.manualOptions.indexOf(option)
      currField.manualOptions.splice(indexToDelete, 1)
      if (currField.fieldType === 'checkbox') {
        currField.fieldValue.splice(indexToDelete, 1)
      }
    }
  }

  // Updates field.fieldOptions array for dropdown fields when the
  // admin user types into the <textarea>
  vm.reloadFieldOptions = function (field) {
    if (field.fieldOptionsFromText) {
      field.fieldOptions = field.fieldOptionsFromText.split('\n')
    } else {
      field.fieldOptions = []
    }
  }

  vm.handleRestrictEmailDomainsToggle = function () {
    const field = vm.field
    if (field.hasAllowedEmailDomains === false) {
      // Reset email domains.
      field.allowedEmailDomainsFromText = ''
    }
  }

  vm.ratingSteps = Rating.steps
  vm.ratingShapes = Rating.shapes

  vm.showDuplicateOptionsError = function (field) {
    // This function assumes that the txt file option for dropdown automatically removes duplicates
    if (!field.fieldOptions) return false
    let myDict = {}
    for (let i = 0; i < field.fieldOptions.length; i++) {
      myDict[field.fieldOptions[i]] = true
    }
    return Object.keys(myDict).length !== field.fieldOptions.length
  }

  vm.showEmptyOptionsError = function (field) {
    // Empty options should only appear on fields that have options to choose from
    // A blank option is considered to be a non-empty option
    if (!['dropdown', 'radiobutton', 'checkbox'].includes(field.fieldType)) {
      return
    }

    return field.fieldOptions && field.fieldOptions.length === 0
  }

  vm.showBlankOptionsError = function (field) {
    // Blank options should only appear on fields that have options to choose from
    if (!['dropdown', 'radiobutton', 'checkbox'].includes(field.fieldType)) {
      return false
    }
    return field.fieldOptions.some((element) => !element.length)
  }

  vm.showEmptyDateRangeError = function () {
    // Error only applies to date field type
    const { dateValidation, fieldType } = vm.field
    if (fieldType !== 'date' || !dateValidation) {
      return false
    }

    const {
      selectedDateValidation,
      customMinDate,
      customMaxDate,
    } = dateValidation

    if (selectedDateValidation !== DATE_VALIDATION_OPTIONS.custom) {
      return false
    }
    return !customMinDate && !customMaxDate
  }

  vm.showProblemDateRangeError = function () {
    const { dateValidation, fieldType } = vm.field
    if (fieldType !== 'date' || !dateValidation) {
      return false
    }

    const { customMinDate, customMaxDate } = dateValidation

    if (customMinDate && customMaxDate) {
      return customMaxDate < customMinDate
    }
    return false
  }

  vm.showCustomValidationOptions = function (field) {
    return FormFields.isCustomValField(field.fieldType)
  }

  // Controls for custom validation
  vm.customValidationOptions = ['Maximum', 'Minimum', 'Exact']
  vm.clearCustomValidation = function (field) {
    field.ValidationOptions = {
      selectedValidation: null,
      customMax: null,
      customMin: null,
      customVal: null,
    }
  }
  vm.resetCustomValidationParams = function (field) {
    let temp = field.ValidationOptions.selectedValidation
    // Reset all custom validation params to null, keep selected validation option
    field.ValidationOptions = {
      customMax: null,
      customMin: null,
      customVal: null,
      selectedValidation: temp,
    }
  }

  vm.changeFxn = function (field) {
    let selected = field.ValidationOptions.selectedValidation
    let val = field.ValidationOptions.customVal
    field.ValidationOptions.customMax =
      selected === 'Maximum' || selected === 'Exact' ? val : null
    field.ValidationOptions.customMin =
      selected === 'Minimum' || selected === 'Exact' ? val : null
  }

  vm.setFocus = function () {
    angular.element('#customValInputBox').focus()
  }

  // Controls for date validation

  vm.dateValidationOptions = values(DATE_VALIDATION_OPTIONS)

  // Make DATE_VALIDATION_OPTIONS accessible to view
  vm.DATE_VALIDATION_OPTIONS = DATE_VALIDATION_OPTIONS

  vm.clearDateValidation = function () {
    const field = vm.field
    field.dateValidation = {
      customMinDate: null,
      customMaxDate: null,
      selectedDateValidation: null,
    }
  }

  vm.changeDateValidation = function () {
    const field = vm.field
    if (field.fieldType !== 'date') {
      throw new Error('Cannot call changeDateValidation on non-date field')
    }

    let temp = field.dateValidation.selectedDateValidation
    // Reset all date validation params to null, keep selected date validation option
    field.dateValidation = {
      customMinDate: null,
      customMaxDate: null,
      selectedDateValidation: temp,
    }
  }

  vm.triggerDateChangeTracker = function () {
    const field = vm.field
    field.isValidateDate = !field.isValidateDate
  }
  vm.handleDateValidationChange = function () {
    vm.changeDateValidation()
    vm.triggerDateChangeTracker()
  }

  vm.handleClearDateValidation = function () {
    vm.clearDateValidation()
    vm.triggerDateChangeTracker()
  }

  vm.reformatDateRange = function () {
    const field = vm.field
    // This converts the date range back to a Date object as valid input for datepicker
    if (field.dateValidation.customMinDate) {
      field.dateValidation.customMinDate = new Date(
        field.dateValidation.customMinDate,
      )
    }
    if (field.dateValidation.customMaxDate) {
      field.dateValidation.customMaxDate = new Date(
        field.dateValidation.customMaxDate,
      )
    }
  }

  // Controls for range validation
  vm.resetRangeValidationParams = function (field) {
    field.ValidationOptions.customMax = null
    field.ValidationOptions.customMin = null
  }

  // For email mode, show only up to 7MB for dropdown
  vm.attachmentSizes =
    vm.myform.responseMode === responseModeEnum.EMAIL
      ? Attachment.dropdown.filter((option) =>
          EMAIL_MODE_ALLOWED_SIZES.includes(option.value),
        )
      : Attachment.dropdown

  // Modify tooltip to match email or encrypt mode options
  vm.attachmentTooltipText =
    vm.myform.responseMode === responseModeEnum.EMAIL
      ? 'Guideline: Images & PDFs - 1-3 MB, Slides & Videos - 7 MB. Include up to 7 MB of attachments in a submission (Email mode).'
      : 'Guideline: Images & PDFs - 1-3 MB, Slides - 7 MB, Videos - 10-20 MB. Include up to 20 MB of attachments in a submission (Storage mode).'

  let previousAttachmentSize = 0

  if (vm.field.fieldType === 'attachment') {
    if (vm.field.attachmentSize == null) {
      vm.attachmentSize = Attachment.attachmentsTotal
      vm.field.attachmentSize = Attachment.sizes[0] // set as lowest: 2mb
    } else {
      vm.attachmentSize =
        Attachment.attachmentsTotal + parseInt(vm.field.attachmentSize)
      previousAttachmentSize = parseInt(vm.field.attachmentSize)
    }
  }

  // Dict of all valid table column types
  vm.tableColumnNames = {
    textfield: 'Text Field',
    dropdown: 'Dropdown',
  }
  vm.tableColumnTypes = Object.keys(vm.tableColumnNames)

  // Add a new column to table field
  vm.addTableColumn = function () {
    vm.field.addColumn()
  }

  // Delete a particular column from table field
  vm.deleteTableColumn = function (index) {
    vm.field.deleteColumn(index)
  }

  // Delete column id so that discriminator key can be updated
  // Changing discriminator key allows text field to be changed to dropdown and vice versa
  vm.updateColumnType = function (index) {
    vm.field.changeColumnType(index)
  }

  // Update field options of column at index. This is necessary in order to update
  // dropdown options based on what is typed in the textarea, as well as to update
  // the admin preview.
  vm.updateColumnOptions = function (index) {
    vm.reloadFieldOptions(vm.field.columns[index])
    vm.field.updateColumnOptions(index)
  }

  vm.updateMaxTableRows = function () {
    const field = vm.field
    if (field.fieldType === 'table') {
      if (field.addMoreRows === true) {
        field.maximumRows = field.minimumRows + 1
        field.additionalRowCount = 0
      } else {
        // Since maximumRows input field is no longer visible when addMoreRows is switched off,
        // we clear maximumRows to prevent the invalid case of the user unknowingly setting minimumRows = maximumRows
        field.maximumRows = undefined
      }
    }
  }

  vm.disableSave = function () {
    if (
      vm.field.fieldType === 'attachment' ||
      vm.field.fieldType === 'dropdown' ||
      vm.field.fieldType === 'radiobutton' ||
      vm.field.fieldType === 'checkbox' ||
      vm.field.fieldType === 'table' ||
      vm.field.fieldType === 'image' ||
      vm.field.fieldType === 'date'
    ) {
      // check if selected attachment size < 0
      if (
        vm.field.fieldType === 'attachment' &&
        vm.attachmentSize - vm.field.attachmentSize < 0
      ) {
        return true
      } else if (
        (vm.field.fieldType === 'radiobutton' ||
          vm.field.fieldType === 'checkbox') &&
        vm.field.fieldOptions.length === 0
      ) {
        // check if radiobutton or checkbox has at least 1 option
        return true
      } else if (
        vm.field.fieldType === 'dropdown' &&
        vm.field.fieldOptions.length === 0
      ) {
        return true
      } else if (
        vm.field.fieldType === 'table' &&
        (!vm.field.minimumRows ||
          (vm.field.addMoreRows &&
            vm.field.maximumRows !== null &&
            vm.field.maximumRows <= vm.field.minimumRows) ||
          (vm.field.addMoreRows &&
            vm.field.maximumRows !== null &&
            vm.field.maximumRows <
              vm.field.minimumRows + vm.field.additionalRowCount) ||
          vm.field.columns.length === 0 ||
          vm.forms.tableColumns.$invalid)
      ) {
        return true
      } else if (
        vm.showDuplicateOptionsError(vm.field) ||
        vm.showEmptyOptionsError(vm.field) ||
        vm.showBlankOptionsError(vm.field)
      ) {
        return true
      } else if (
        vm.field.fieldType === 'image' &&
        !(vm.field.url && vm.field.name && vm.field.size)
      ) {
        return true
      } else if (
        vm.field.fieldType === 'date' &&
        (vm.showEmptyDateRangeError(vm.field) ||
          vm.showProblemDateRangeError(vm.field))
      ) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  vm.saveField = function (isValid) {
    if (!isValid) {
      return
    }

    const field = cloneDeep(vm.field)
    if (field.fieldOptionsFromText) {
      field.fieldOptions = field.fieldOptionsFromText.split('\n')
      delete field.fieldOptionsFromText
    } else {
      field.fieldOptions = field.manualOptions
    }

    // Deserialize allowed email domains
    if (field.fieldType === 'email') {
      if (!field.allowedEmailDomainsFromText) {
        field.allowedEmailDomains = []
      } else {
        field.allowedEmailDomains = field.allowedEmailDomainsFromText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s)
      }
      delete field.allowedEmailDomainsFromText
      delete field.allowedEmailDomainsPlaceholder
    }

    // set total attachment size left
    if (field.fieldType === 'attachment') {
      Attachment.attachmentsTotal =
        Attachment.attachmentsTotal -
        parseInt(field.attachmentSize) +
        previousAttachmentSize
    }

    vm.saveInProgress = true
    // No id, creation
    let updateFieldPromise
    if (!field._id) {
      updateFieldPromise = externalScope.updateField({
        editFormField: {
          action: {
            name: EditFieldActions.Create,
          },
          field,
        },
      })
    } else {
      // Update field
      updateFieldPromise = externalScope.updateField({
        fieldId: field._id,
        body: field,
        type: UPDATE_FORM_TYPES.UpdateField,
      })
    }

    return updateFieldPromise
      .then((error) => {
        if (!error) {
          $uibModalInstance.close()
          externalScope.closeMobileFields()
        }
      })
      .finally(() => {
        vm.saveInProgress = false
      })
  }

  vm.cancel = function () {
    $uibModalInstance.close()
  }

  // Shared image upload parameters between frontend and backend
  vm.maxImageSize = MAX_UPLOAD_FILE_SIZE
  vm.validImageExtensions = VALID_UPLOAD_FILE_TYPES

  vm.beforeResizing = () => {
    vm.uploading = true
    vm.cancelUpload()
  }

  vm.cancelUpload = () => {
    if (source) {
      source.cancel()
    }
  }

  /**
   * Upload Image to persistent storage
   * @param {File} image - Uploaded by user
   * @param {Object} error - Generated by ng file upload
   * @param {Object} field
   */
  vm.uploadImage = function (image, ngfError, field) {
    if (ngfError) {
      vm.uploading = false
      // This is a reference to the ng-model of the upload button, which points to the uploaded file
      // On error, we explicitly clear the files stored in the model, as the library does not always automatically do this
      field.uploadedFile = ''
      switch (ngfError.$error) {
        case 'maxSize':
          vm.uploadError = `${(ngfError.size / 1000000).toFixed(2)} MB / ${
            vm.maxImageSize / 1000000
          } MB: File size exceeded`
          break
        case 'resize':
          vm.uploadError = `An error has occurred while resizing your image`
          break
        default:
          vm.uploadError = 'Oops something went wrong. Please try again!'
      }
    } else if (image) {
      vm.uploadError = null
      source = CancelToken.source()

      return $q
        .when(
          uploadImage({
            image,
            formId: vm.myform._id,
            cancelToken: source.token,
          }),
        )
        .then((result) => {
          field.url = result.url
          field.fileMd5Hash = result.fileMd5Hash
          field.name = result.name
          field.size = `${(result.size / 1000000).toFixed(2)} MB`
        })
        .catch((uploadError) => {
          // This is a reference to the ng-model of the upload button, which points to the uploaded file
          // On error, we explicitly clear the files stored in the model, as the library does not always automatically do this
          field.uploadedFile = ''

          if (axios.isCancel(uploadError)) {
            vm.uploadError = `Upload cancelled. Please try again!`
          } else {
            console.error(uploadError)
            vm.uploadError = 'Upload error. Please try again!'
          }
        })
        .finally(() => {
          vm.uploading = false
        })
    }
  }

  /**
   * Clear field
   * @param {Object} field
   */
  vm.removeImage = function (field) {
    /**
     * Note: When the ng-src attribute is empty, Angular will not empty the src attribute.
     * Instead, set a default image src when the image is empty
     * TODO: upon update to boxicons 2.0.3, delete the .svg file and use the boxicons library directly
     * Note: bx-image-add is not available in boxicons 1.8.0
     */
    field.url = '/public/modules/core/img/bx-image-add.svg'
    field.fileMd5Hash = ''
    field.name = ''
    field.size = ''

    // This is a reference to the ng-model of the upload button, which points to the uploaded file
    // On error, we explicitly clear the files stored in the model, as the library does not always automatically do this
    field.uploadedFile = ''
  }
}
