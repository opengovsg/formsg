'use strict'

const get = require('lodash/get')

const { types: basicTypes } = require('../../../../shared/resources/basic')
const { types: myInfoTypes } = require('../../../../shared/resources/myinfo')

angular.module('forms').service('FormFields', [FormFields])

function FormFields() {
  this.basicTypes = basicTypes
  this.myInfoTypes = myInfoTypes
  this.customValFields = ['textarea', 'textfield']

  /**
   * Whether a field uses custom validation options.
   * @param {string} fieldType
   */
  this.isCustomValField = (fieldType) => {
    return this.customValFields.includes(fieldType)
  }

  /**
   * Whether a field uses number validation options.
   * @param {string} fieldType
   */
  this.isNumberField = (fieldType) => {
    return fieldType === 'number'
  }

  /**
   * Extract the representative "title" of a form field object. For statement fields (write-ups),
   * the "title" is the "description", but for all other fields, the "title" is "title".
   * @param {Object} field A form field object
   * @returns {String} The "title" of the form field
   */
  this.getFieldTitle = (field) => {
    if (field && field.fieldType) {
      switch (field.fieldType) {
        case 'statement':
          return field.description
        case 'image':
          return field.name
        default:
          return field.title
      }
    }
    return null
  }

  /**
   * Create a new MyInfo field object of the specified type (attribute)
   * @param  {String} myInfoAttr Type (attribute) of MyInfo field to
   * create
   * @return {Object} A MyInfo field object
   */
  this.createMyInfoField = (myInfoAttr) => {
    let newMyInfoField = {
      myInfo: {
        attr: myInfoAttr,
      },
      fieldValue: '',
      required: true,
      disabled: false,
      ValidationOptions: {
        customMax: null,
        customMin: null,
        customVal: null,
        selectedValidation: null,
      },
    }
    this.injectMyInfoFieldInfo(newMyInfoField)
    return newMyInfoField
  }

  /**
   * Injects MyInfo details into a single field.
   * @param  {Object} field An element in form.form_fields array
   * @return {undefined}       Update is done in-place.
   */
  this.injectMyInfoFieldInfo = (field) => {
    if (field.myInfo && field.myInfo.attr) {
      let [myInfoField] = this.myInfoTypes.filter(
        (x) => x.name === field.myInfo.attr,
      )

      // Common information for all MyInfo fields
      field.title = myInfoField.value
      field.fieldName = myInfoField.value
      field.fieldType = myInfoField.fieldType
      field.ValidationOptions = myInfoField.ValidationOptions
      field.myInfo.source = myInfoField.source
      field.myInfo.description = myInfoField.description
      field.myInfo.verified = myInfoField.verified

      // fieldOptions for categorical fields
      if (['dropdown', 'checkbox', 'radiobutton'].includes(field.fieldType)) {
        field.fieldOptions = myInfoField.fieldOptions
        field.loadProgress = 0
      }
    }
  }

  /**
   * Remove MyInfo details from a single field.
   * @param  {Object} field An element in form.form_fields array
   * @return {undefined}    Update is done in-place.
   */
  this.removeMyInfoFieldInfo = (field) => {
    if (field.myInfo && field.myInfo.attr) {
      // Note: fieldType not removed as there is a verification check on
      // backend, ensuring myInfo attribute is the correct fieldType
      // Title is also not removed so that user does not see it go missing
      // when the update is made.
      field.fieldName = ''
      field.fieldValue = ''
      field.myInfo.source = ''
      field.myInfo.description = ''
      field.myInfo.verified = []

      if (['dropdown', 'checkbox', 'radiobutton'].includes(field.fieldType)) {
        field.fieldOptions = []
      }
    }
  }
  /**
   * Updates a form object in-place with MyInfo details injected.
   * Does not affect non-MyInfo fields.
   * @param  {Object} form Form object
   * @return {undefined}
   */
  this.injectMyInfoIntoForm = (form) => {
    if (form.form_fields) form.form_fields.map(this.injectMyInfoFieldInfo)
    if ((form.editFormField || {}).field)
      this.injectMyInfoFieldInfo(form.editFormField.field)
  }

  /**
   * Updates a form object in-place with MyInfo details removed. Does not
   * affect non-MyInfo fields.
   * @param  {Object} form Form object
   * @return {undefined}
   */
  this.removeMyInfoFromForm = (form) => {
    if (form.form_fields) form.form_fields.map(this.removeMyInfoFieldInfo)
    if ((form.editFormField || {}).field)
      this.removeMyInfoFieldInfo(form.editFormField.field)
  }

  /**
   * Checks if the form contains MyInfo fields.
   * @param {Object} form Form object
   * @return {Boolean}
   */
  this.containsMyInfoFields = (form) => {
    return (form.form_fields || []).some((field) => field.myInfo)
  }

  /**
   * Determines whether a form should be prevented from being duplicated
   * for Storage Mode.
   * @param {Object} form Form object
   * @return {Boolean}
   */
  this.preventStorageModeDuplication = (form) => {
    if (!form) {
      return false
    }
    return form.form_fields.some((field) => get(field, 'myInfo.attr'))
  }

  /**
   * Retrieves the MyInfo value shown on preview given a MyInfo attribute.
   * The running gag is that this returns the MyInfo profile of Phua Chu Kang.
   * @param {string} myInfoAttr A MyInfo attribute
   */
  this.getMyInfoPreviewValue = (myInfoAttr) => {
    switch (myInfoAttr) {
      case 'name':
        return 'PHUA CHU KANG'
      case 'sex':
        return 'MALE'
      case 'race':
        return 'CHINESE'
      case 'nationality':
        return 'SINGAPORE CITIZEN'
      case 'birthcountry':
        return 'SINGAPORE'
      case 'passportnumber':
        return 'E1234567X'
      case 'regadd':
        return '411 CHUA CHU KANG AVE 3, #12-3, SINGAPORE 238823'
      case 'mobileno':
        return '+65 98765432'
      case 'occupation':
        return 'MANAGING DIRECTOR/CHIEF EXECUTIVE OFFICER'
      case 'employment':
        return 'PCK PTE LTD'
      case 'marital':
        return 'MARRIED'
      case 'dob':
        return new Date(1965, 2, 23)
      case 'passportexpirydate':
        return new Date()
      case 'marriagedate':
        return new Date(1999, 2, 2)
      case 'divorcedate':
        return new Date(2007, 1, 10)
      case 'residentialstatus':
        return 'CITIZEN'
      case 'dialect':
        return 'HOKKIEN'
      case 'vehno':
        return 'SHA1234X'
      case 'marriagecertno':
        return '123456789012345'
      case 'countryofmarriage':
        return 'SINGAPORE'
      case 'housingtype':
        return 'DETACHED HOUSE'
      default:
        return ''
    }
  }
}
