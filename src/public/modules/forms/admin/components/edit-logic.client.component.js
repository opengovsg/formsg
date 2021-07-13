'use strict'

const { LogicType, BasicField } = require('../../../../../types')
const UpdateFormService = require('../../../../services/UpdateFormService')

angular.module('forms').component('editLogicComponent', {
  templateUrl: 'modules/forms/admin/componentViews/edit-logic.client.view.html',
  bindings: {
    myform: '=',
    isLogicError: '<',
    updateForm: '&',
  },
  controller: [
    '$uibModal',
    'FormFields',
    'Toastr',
    '$q',
    editLogicComponentController,
  ],
  controllerAs: 'vm',
})

function editLogicComponentController($uibModal, FormFields, Toastr, $q) {
  const vm = this
  vm.LogicType = LogicType
  const getNewCondition = function () {
    return {
      _id: Math.floor(100000 * Math.random()),
      field: undefined,
      state: undefined,
      value: undefined,
      ifValueType: 'number',
    }
  }
  /**
   * Retrieves the form field object from myform that matches the given fieldId.
   * @param {String} fieldId The ID of the field to find from myform
   * @returns {Object} The form field with the specified fieldId
   */
  const getField = function (fieldId) {
    return vm.myform.form_fields.find(function (field) {
      return field._id === fieldId
    })
  }
  vm.getField = getField

  /**
   * Maps an array of field IDs (Strings that are object IDs) to their corresponding fields in myform.
   * @param {String[]} logicIds An array of field IDs
   * @returns {Object[]} An array of form fields
   */
  vm.mapIdsToFields = function (logicIds) {
    return logicIds.map((id) => getField(id))
  }

  vm.getFieldTitle = FormFields.getFieldTitle

  /**
   * Extract the field type of a form field object.
   * @param {Object} field A form field object
   * @returns {String} The field type of the form field
   */
  vm.getFieldFieldType = function (field) {
    return field && field.fieldType
  }

  vm.formatValue = function (values, fieldType) {
    if (fieldType === BasicField.Checkbox) {
      // value has shape [[{value:..., others:...}, ...], [...], ...]
      // map each object to its value
      values = values.map((arr) => arr.map((obj) => obj.value))
    }
    if (values instanceof Array) {
      return values.join(' or ')
    }
    return values
  }

  vm.addLogic = function () {
    let newLogic = {
      conditions: [getNewCondition()],
      show: [],
    }

    vm.openEditLogicModal(newLogic, true)
  }

  vm.deleteLogic = function (logicIndex) {
    const logicIdToDelete = vm.myform.form_logics[logicIndex]._id
    $q.when(UpdateFormService.deleteFormLogic(vm.myform._id, logicIdToDelete))
      .then(() => {
        vm.myform.form_logics.splice(logicIndex, 1)
      })
      .catch((logicDeleteError) => {
        console.error(logicDeleteError)
        Toastr.error('Failed to delete logic, please refresh and try again!')
      })
  }

  vm.openEditLogicModal = function (currLogic, isNew, logicIndex = -1) {
    vm.editLogicModal = $uibModal.open({
      animation: true,
      backdrop: 'static',
      keyboard: false,
      templateUrl: 'modules/forms/admin/views/edit-logic.client.modal.html',
      windowClass: 'edit-modal-window full-page-modal',
      controller: 'EditLogicModalController',
      controllerAs: 'vm',
      resolve: {
        externalScope: () => ({
          currLogic,
          isNew,
          logicIndex,
          getField,
          getNewCondition,
          myform: vm.myform,
        }),
      },
    })
  }
}
