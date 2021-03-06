'use strict'

const cloneDeep = require('lodash/cloneDeep')
const { UPDATE_FORM_TYPES } = require('../constants/update-form-types')

angular
  .module('forms')
  .controller('EditMyInfoFieldController', [
    '$uibModalInstance',
    'FormFields',
    'externalScope',
    'updateField',
    EditMyInfoFieldController,
  ])

function EditMyInfoFieldController(
  $uibModalInstance,
  FormFields,
  externalScope,
  updateField,
) {
  const vm = this
  vm.field = externalScope.currField
  vm.myform = externalScope.myform

  // Whether field is being used for logic fields
  vm.isConditionField = externalScope.isConditionField

  // Whether field is verified for Singaporeans/PR/Foreigners
  vm.verifiedForSG = externalScope.currField.myInfo.verified.includes('SG')
  vm.verifiedForPR = externalScope.currField.myInfo.verified.includes('PR')
  vm.verifiedForF = externalScope.currField.myInfo.verified.includes('F')

  vm.saveMyInfoField = function () {
    // No id, creation
    let updateFieldPromise
    const field = cloneDeep(externalScope.currField)

    // Mutate and remove MyInfo data
    FormFields.removeMyInfoFieldInfo(field)

    // Field creation
    if (!field._id) {
      updateFieldPromise = updateField({
        body: field,
        type: UPDATE_FORM_TYPES.CreateField,
      })
    } else {
      // Update field
      updateFieldPromise = updateField({
        fieldId: field._id,
        body: field,
        type: UPDATE_FORM_TYPES.UpdateField,
      })
    }

    return updateFieldPromise.then((error) => {
      if (!error) {
        $uibModalInstance.close()
        externalScope.closeMobileFields()
      }
    })
  }

  vm.cancelMyInfoField = function () {
    $uibModalInstance.close()
  }
}
