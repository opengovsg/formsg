'use strict'

const { range, cloneDeep } = require('lodash')
const {
  LogicType,
  LogicIfValue,
  BasicField,
  LogicConditionState,
} = require('../../../../../types')
const FormLogic = require('../../../../../shared/util/logic')
const UpdateFormService = require('../../../../services/UpdateFormService')
const {
  transformBackendLogic,
  transformFrontendLogic,
} = require('../../services/form-logic/form-logic.client.service')
const {
  checkIfHasInvalidValues,
} = require('../../../../../shared/util/logic-utils/logic-values-checker')

angular
  .module('forms')
  .controller('EditLogicModalController', [
    '$uibModalInstance',
    'externalScope',
    'FormFields',
    '$q',
    'Toastr',
    EditLogicModalController,
  ])

function EditLogicModalController(
  $uibModalInstance,
  externalScope,
  FormFields,
  $q,
  Toastr,
) {
  const vm = this

  // Copied to prevent changes in this scope to affect the external scope
  vm.myform = angular.copy(externalScope.myform)
  vm.logic = angular.copy(externalScope.currLogic)

  vm.checkIfHasInvalidValues = checkIfHasInvalidValues

  /**
   * The current logic being edited in the modal
   * @typedef {Object} Logic
   * @property {Condition[]} conditions - Array of Condition objects
   * @property {String[]} show - Array of field ids
   */

  /**
   * Each logic contains one or more conditions
   * @typedef {Object} Condition
   * @property {String} field - String that holds field id
   * @property {Object} fieldInfo - Object with properties (title, required etc.) of field
   * @property {Array} ifStates - Array of possible values for the states in the If block
   * @property {String} ifValueType - Field type that is being used as an If
   * @property {String} state - State field of condition
   * @property {String} value - Value field of condition
   */
  vm.formLogics = vm.myform.form_logics

  vm.getFieldTitle = FormFields.getFieldTitle

  vm.ifFields = FormLogic.getApplicableIfFields(vm.myform.form_fields)
  vm.thenFields = vm.myform.form_fields

  vm.logicTypeSelection = {
    showFields:
      !externalScope.isNew && vm.logic.logicType === LogicType.ShowFields,
    preventSubmit:
      !externalScope.isNew && vm.logic.logicType === LogicType.PreventSubmit,
  }

  vm.selectLogicType = (isShowFieldsSelected) => {
    vm.logicTypeSelection.showFields = isShowFieldsSelected
    vm.logicTypeSelection.preventSubmit = !isShowFieldsSelected
  }

  vm.clearLogicTypeSelection = () => {
    vm.logicTypeSelection.showFields = false
    vm.logicTypeSelection.preventSubmit = false
  }

  /**
   * Returns true if any form element in the Show field is missing from the Form
   * @param {Logic} logic
   */
  vm.checkIfMissingHiddenFields = function (logic) {
    if (logic.logicType === LogicType.PreventSubmit) {
      return false
    }
    return logic.show.some((showField) => !externalScope.getField(showField))
  }

  /**
   * Returns a list of options for the Show input of the Then section that are not already used in Field inputs of the If section
   * @param {Logic} logic
   */
  vm.subsetThenFields = function (logic) {
    const fieldsWithoutConditions = vm.thenFields.filter((field) => {
      for (let i = 0; i < logic.conditions.length; i++) {
        if (logic.conditions[i].field === field._id) {
          return false
        }
      }
      return true
    })
    return fieldsWithoutConditions
  }

  /**
   * Returns a list of options for the Field input of the If section that are not already in the Show input of the Then section
   * @param {Logic} logic
   */
  vm.subsetIfFields = function (logic) {
    // Logic unit preventing submission does not restrict if fields
    if (logic.logicType === LogicType.PreventSubmit) {
      return vm.ifFields
    }
    return vm.ifFields.filter((field) => !logic.show.includes(field._id))
  }

  vm.isIfStateDisabled = function (condition) {
    return condition.field === undefined
  }

  vm.isIfValueDisabled = function (condition) {
    return condition.state === undefined || condition.fieldInfo === undefined
  }

  vm.isDeleteConditionDisabled = function () {
    return vm.logic.conditions.length <= 1
  }

  /**
   * Initialise the state and value dropdown when editing an existing condition
   * @param {Condition} condition
   */
  vm.initCondition = function (condition) {
    condition.fieldInfo = externalScope.getField(condition.field)
    if (condition.fieldInfo) {
      vm.loadState(condition, false)

      if (condition.state) {
        vm.loadValue(condition, false)
      }
    }
  }

  /**
   * Loads the supported state based on the field type; reset=true when editing a new condition
   * @param {Condition} condition
   * @param {Boolean} reset - flag to reset or not
   */
  vm.loadState = function (condition, reset) {
    if (reset) {
      condition.state = undefined
      condition.value = undefined
      condition.ifValueType = 'number'
    }
    condition.fieldInfo = externalScope.getField(condition.field)
    if (condition.fieldInfo) {
      condition.ifStates = FormLogic.getApplicableIfStates(
        condition.fieldInfo.fieldType,
      )
    }
  }

  /**
   * Loads the possible values based on the field type (e.g. yes/no) and field values (e.g. dropdown options, rating steps)
   * @param {Condition} condition
   * @param {Boolean} reset - flag to reset or not
   */
  vm.loadValue = function (condition, reset) {
    if (reset) {
      condition.value = undefined
    }
    let field = condition.fieldInfo

    if (!field || !field.fieldType) {
      return
    }

    if (
      field.fieldType === BasicField.Dropdown ||
      field.fieldType === BasicField.Radio
    ) {
      condition.ifValues = field.fieldOptions

      if (field.fieldType === BasicField.Radio && field.othersRadioButton) {
        // prevent duplicate 'Others' option when reload or the question is with an existing 'Others' option
        if (condition.ifValues.indexOf('Others') === -1) {
          // prevent changing the original field options
          condition.ifValues = condition.ifValues.slice()
          condition.ifValues.push('Others')
        }
      }

      if (condition.state === LogicConditionState.Equal) {
        condition.ifValueType = LogicIfValue.SingleSelect
      } else {
        condition.ifValueType = LogicIfValue.MultiSelect
      }
    } else if (field.fieldType === BasicField.Checkbox) {
      condition.ifValues = field.fieldOptions.map((option) => {
        return {
          value: option,
          other: false,
        }
      })
      if (field.fieldType === BasicField.Checkbox && field.othersRadioButton) {
        condition.ifValues.push({ value: 'Others', other: true })
      }
      condition.ifValueType = LogicIfValue.MultiValue
    } else if (field.fieldType === BasicField.Rating) {
      condition.ifValues = range(1, field.ratingOptions.steps + 1)
      condition.ifValueType = LogicIfValue.SingleSelect
    } else if (field.fieldType === BasicField.YesNo) {
      condition.ifValues = ['Yes', 'No']
      condition.ifValueType = LogicIfValue.SingleSelect
    } else {
      condition.ifValueType = LogicIfValue.Number
    }
  }

  // Helper functions for infinite scroll
  vm.infiniteScroll = {
    numToAdd: 3,
    initalItems: 30,
    currentItems: 30,
  }
  vm.filteredOptions = []

  /**
   * Filter options to show based on searchTerm
   * @param {String} searchTerm - String in the input field, used to search through all possible values
   * @param {Array} values - Possible values for the selected field
   */
  vm.filterOptions = function (searchTerm, values) {
    vm.filteredOptions = values.filter((option) => {
      return (
        option.toString().toLowerCase().indexOf(searchTerm.toLowerCase()) > -1
      )
    })
  }

  /**
   * Add more options to show as user scrolls
   */
  vm.addMoreItems = function () {
    vm.infiniteScroll.currentItems += vm.infiniteScroll.numToAdd
  }

  /**
   * Reset current items to show
   */
  vm.onDropdownOpenClose = function () {
    vm.filteredOptions = []
    vm.infiniteScroll.currentItems = vm.infiniteScroll.initalItems
  }

  vm.addCondition = function () {
    if (!vm.logic.conditions) {
      vm.logic.conditions = []
    }

    vm.logic.conditions.unshift(externalScope.getNewCondition())
  }

  vm.deleteCondition = function (condition) {
    for (let i = 0; i < vm.logic.conditions.length; i++) {
      if (vm.logic.conditions[i]._id === condition._id) {
        vm.logic.conditions.splice(i, 1)
        break
      }
    }
  }

  vm.shouldDisableSave = function () {
    const thenNotSelected =
      !vm.logicTypeSelection.showFields && !vm.logicTypeSelection.preventSubmit
    const valueNotSelected = vm.logic.conditions.some((condition) =>
      vm.hasEmptyConditionError(condition),
    )
    return vm.logicForm.$invalid || thenNotSelected || valueNotSelected
  }

  vm.hasEmptyConditionError = function (condition) {
    return !condition.value || condition.value.length === 0
  }

  vm.save = function () {
    // Clear data of unselected logic type
    if (vm.logicTypeSelection.showFields) {
      vm.logic.logicType = LogicType.ShowFields
      delete vm.logic.preventSubmitMessage
    } else {
      vm.logic.logicType = LogicType.PreventSubmit
      delete vm.logic.show
    }

    const clonedLogic = cloneDeep(vm.logic) // clone to avoid changes to existing logic

    // Decide whether to add to formLogics or replace current one
    const { isNew, logicIndex } = externalScope

    if (isNew) {
      vm.createNewLogic(clonedLogic)
    } else if (logicIndex !== -1) {
      vm.updateExistingLogic(logicIndex, clonedLogic)
    }
  }

  vm.createNewLogic = function (newLogic) {
    $q.when(
      UpdateFormService.createFormLogic(
        vm.myform._id,
        transformFrontendLogic(newLogic),
      ),
    )
      .then((createdLogic) => {
        const transformedLogic = transformBackendLogic(createdLogic)
        vm.formLogics.push(transformedLogic)
        externalScope.myform.form_logics.push(transformedLogic) // update global myform
        $uibModalInstance.close()
      })
      .catch(() => {
        Toastr.error('Failed to create logic, please refresh and try again!')
      })
  }

  vm.cancel = function () {
    $uibModalInstance.close()
  }

  vm.updateExistingLogic = function (logicIndex, updatedLogic) {
    const logicIdToUpdate = vm.formLogics[logicIndex]._id
    $q.when(
      UpdateFormService.updateFormLogic(
        vm.myform._id,
        logicIdToUpdate,
        transformFrontendLogic(updatedLogic),
      ),
    )
      .then((updatedLogic) => {
        const transformedLogic = transformBackendLogic(updatedLogic)
        vm.formLogics[logicIndex] = transformedLogic
        externalScope.myform.form_logics[logicIndex] = transformedLogic // update global myform
        $uibModalInstance.close()
      })
      .catch(() => {
        Toastr.error('Failed to update logic, please refresh and try again!')
      })
  }

  // Functions to be used for multi-valued logic fields
  vm.initValue = function (condition) {
    if (!condition.value) {
      condition.value = []
      condition.value.push([])
    }
  }

  vm.addOption = function (condition) {
    condition.value.push([])
  }

  vm.deleteOption = function (condition, option) {
    const indexToDelete = condition.value.indexOf(option)
    condition.value.splice(indexToDelete, 1)
  }
}
