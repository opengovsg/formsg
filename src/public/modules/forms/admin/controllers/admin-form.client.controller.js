'use strict'

const { StatusCodes } = require('http-status-codes')
const get = require('lodash/get')
const moment = require('moment-timezone')
const {
  LogicType,
  BasicField,
  LogicConditionState,
} = require('../../../../../types')
const UpdateFormService = require('../../../../services/UpdateFormService')
const UserService = require('../../../../services/UserService')
const FieldFactory = require('../../helpers/field-factory')
const { UPDATE_FORM_TYPES } = require('../constants/update-form-types')

// All viewable tabs. readOnly is true if that tab cannot be used to edit form.
const VIEW_TABS = [
  { title: 'Build', route: 'build', readOnly: false },
  { title: 'Logic', route: 'logic', readOnly: false },
  { title: 'Settings', route: 'settings', readOnly: false },
  { title: 'Share', route: 'share', readOnly: true },
  { title: 'Data', route: 'results', readOnly: true },
]

// TODO: refactor canUserEdit into its own service
function canUserEdit(form, user) {
  const { email: userEmail } = user
  const { email: adminEmail } = form.admin
  return (
    userEmail === adminEmail ||
    form.permissionList.some(
      (permissions) => permissions.write && permissions.email === userEmail,
    )
  )
}

function getViewTabs(canEdit) {
  return canEdit ? VIEW_TABS : VIEW_TABS.filter((tab) => tab.readOnly)
}

// Forms controller
angular
  .module('forms', ['ng-drag-scroll'])
  .controller('AdminFormController', [
    '$q',
    '$scope',
    '$translate',
    '$uibModal',
    'FormData',
    'FormFields',
    'Toastr',
    '$state',
    '$window',
    'FormApi',
    AdminFormController,
  ])

function AdminFormController(
  $q,
  $scope,
  $translate,
  $uibModal,
  FormData,
  FormFields,
  Toastr,
  $state,
  $window,
  FormApi,
) {
  // Banner message on form builder routes
  $scope.bannerContent = $window.siteBannerContent || $window.adminBannerContent
  $scope.myform = FormData.form

  // Redirect to signin if unable to get user
  $scope.user =
    UserService.getUserFromLocalStorage() ||
    $state.go(
      'signin',
      {
        targetState: 'viewForm',
        targetFormId: $scope.myform._id,
      },
      { location: 'replace' },
    )

  // Get support form link from translation json.
  $translate('LINKS.SUPPORT_FORM_LINK').then((supportFormLink) => {
    $scope.supportFormLink = supportFormLink
  })

  // userCanEdit is inherited by the share-form component, so avoid changing
  // the variable name
  $scope.userCanEdit = canUserEdit($scope.myform, $scope.user)
  $scope.viewTabs = getViewTabs($scope.userCanEdit)

  /* Top bar within form */
  $scope.lastModifiedString = '-'
  $scope.$watch(
    '[myform.lastModified]',
    () => {
      // Transform last modified time into readable format
      let today = moment().clone().startOf('day')
      let isToday = moment($scope.myform.lastModified).isSame(today, 'd')
      if (isToday) {
        $scope.lastModifiedString =
          moment($scope.myform.lastModified).format('h:mm A, ') + 'Today'
      } else {
        $scope.lastModifiedString = moment($scope.myform.lastModified).format(
          'h:mm A, D/M/YY',
        )
      }
    },
    true,
  )

  /* Collaborator */
  $scope.refreshFormDataFromCollab = (form) => {
    $scope.myform = form
  }

  /**
   * If the collab modal is shown, hide it, and if it is hidden, show it.
   * When showing the collab modal, the html body for mobile will be scroll locked, to prevent the ability to scroll
   * the page while edit collaborator dropdowns (which are appended to the body) are open.
   */
  $scope.toggleCollabModal = () => {
    angular.element('body').addClass('mobile-scroll-lock')
    $uibModal.open({
      animation: false,
      templateUrl: 'modules/forms/admin/views/collaborator.client.modal.html',
      windowClass: 'full-screen-modal-window',
      controller: 'CollaboratorModalController',
      resolve: {
        externalScope: () => ({
          form: $scope.myform,
          user: $scope.user,
          userCanEdit: $scope.userCanEdit,
          refreshFormDataFromCollab: $scope.refreshFormDataFromCollab,
        }),
      },
    })
  }

  const handleUpdateError = (error) => {
    if (!error) {
      return
    }
    let errorMessage
    const status = get(error, 'response.status') || get(error, 'status')
    switch (status) {
      case StatusCodes.CONFLICT:
      case StatusCodes.BAD_REQUEST:
        errorMessage =
          'This page seems outdated, and your changes could not be saved. Please refresh.'
        break
      case StatusCodes.FORBIDDEN:
      case StatusCodes.UNAUTHORIZED:
        errorMessage =
          'Your changes could not be saved as your account lacks the requisite privileges.'
        break
      case StatusCodes.UNPROCESSABLE_ENTITY:
        // Validation can fail for many reasons, so return more specific message
        errorMessage = get(
          error,
          'response.data.message',
          'Your changes contain invalid input.',
        )
        break
      case StatusCodes.REQUEST_TOO_LONG: // HTTP Payload Too Large
        errorMessage = `
                Your form is too large. Reduce the number of fields, or submit a
                <a href="${$scope.supportFormLink}" target="_blank" rel="noopener"><u>Support Form</u></a>.
              `
        break
      default:
        errorMessage = 'An error occurred while saving your changes.'
    }
    Toastr.error(errorMessage)
    return error
  }

  /**
   * Calls the update form api
   * formId is the id of the form to update
   * updatedForm is a subset of fields from scope.myform which have been edited
   *
   * @param {Object} {formId: String, updatedForm: Object}
   * @returns Promise
   */
  $scope.updateForm = (update) => {
    const updateType = get(update, 'type')
    switch (updateType) {
      case UPDATE_FORM_TYPES.CreateField: {
        const { body } = update
        return $q
          .when(
            UpdateFormService.createSingleFormField($scope.myform._id, body),
          )
          .then((updatedFormField) => {
            // !!! Convert retrieved form field objects into their class counterparts.
            const updatedFieldClass =
              FieldFactory.createFieldFromData(updatedFormField)
            FormFields.injectMyInfoFieldInfo(updatedFieldClass)

            // insert created field into form
            $scope.myform.form_fields = [
              ...$scope.myform.form_fields,
              updatedFieldClass,
            ]
          })
          .catch(handleUpdateError)
      }
      case UPDATE_FORM_TYPES.DeleteField: {
        const { fieldId } = update
        return $q
          .when(
            UpdateFormService.deleteSingleFormField($scope.myform._id, fieldId),
          )
          .then(() => {
            // Success, remove deleted form field
            const updatedFormFields = $scope.myform.form_fields.filter(
              (f) => String(f._id) !== fieldId,
            )
            $scope.myform.form_fields = updatedFormFields
          })
          .catch(handleUpdateError)
      }
      case UPDATE_FORM_TYPES.UpdateField: {
        const { fieldId, body } = update
        return $q
          .when(
            UpdateFormService.updateSingleFormField(
              $scope.myform._id,
              fieldId,
              body,
            ),
          )
          .then((updatedFormField) => {
            // !!! Convert retrieved form field objects into their class counterparts.
            const updatedFieldClass =
              FieldFactory.createFieldFromData(updatedFormField)
            FormFields.injectMyInfoFieldInfo(updatedFieldClass)

            // merge back into the form fields
            const updateIndex = $scope.myform.form_fields.findIndex(
              (f) => f._id === fieldId,
            )
            if (updateIndex !== -1) {
              $scope.myform.form_fields[updateIndex] = updatedFieldClass
            } else {
              Toastr.error('An error occurred while saving your changes.')
            }
          })
          .catch(handleUpdateError)
      }
      case UPDATE_FORM_TYPES.DuplicateField: {
        const { fieldId } = update
        return $q
          .when(
            UpdateFormService.duplicateSingleFormField(
              $scope.myform._id,
              fieldId,
            ),
          )
          .then((updatedFormField) => {
            // !!! Convert retrieved form field objects into their class counterparts.
            const updatedFieldClass =
              FieldFactory.createFieldFromData(updatedFormField)
            FormFields.injectMyInfoFieldInfo(updatedFieldClass)

            // insert created field into form
            $scope.myform.form_fields = [
              ...$scope.myform.form_fields,
              updatedFieldClass,
            ]
          })
          .catch(handleUpdateError)
      }
      case UPDATE_FORM_TYPES.ReorderField: {
        const { fieldId, newPosition } = update

        return $q
          .when(
            UpdateFormService.reorderSingleFormField(
              $scope.myform._id,
              fieldId,
              newPosition,
            ),
          )
          .then((updatedFields) => {
            // !!! Convert retrieved form field objects into their class counterparts.
            const updatedFieldClasses = updatedFields.map((f) => {
              const fieldClass = FieldFactory.createFieldFromData(f)
              FormFields.injectMyInfoFieldInfo(fieldClass)
              return fieldClass
            })
            $scope.myform.form_fields = updatedFieldClasses
          })
          .catch(handleUpdateError)
      }
      default:
        // This block should not be reached. All updateForm calls should have an update type.
        return $q
          .when(FormApi.updateForm($scope.myform._id, update))
          .then((savedForm) => {
            // Updating this form updates lastModified
            // and also updates myform if a formToUse is passed in
            $scope.myform = savedForm
          })
          .catch(handleUpdateError)
    }
  }

  $scope.updateFormEndPage = (newEndPage) => {
    return $q
      .when(UpdateFormService.updateFormEndPage($scope.myform._id, newEndPage))
      .then((updatedEndPage) => {
        $scope.myform.endPage = updatedEndPage
      })
      .catch(handleUpdateError)
  }

  $scope.updateFormStartPage = (newStartPage) => {
    return $q
      .when(
        UpdateFormService.updateFormStartPage($scope.myform._id, newStartPage),
      )
      .then((updatedStartPage) => {
        $scope.myform.startPage = updatedStartPage
      })
      .catch(handleUpdateError)
  }

  /**
   * Calls the update form settings API
   * @param {Object} settingsToUpdate the object with new values for settings.
   * @returns Promise
   */
  $scope.updateFormSettings = (settingsToUpdate) => {
    return $q
      .when(
        UpdateFormService.updateFormSettings(
          $scope.myform._id,
          settingsToUpdate,
        ),
      )
      .then((updatedSettings) => {
        // merge back into main form since updating settings only returns the changed subset.
        Object.assign($scope.myform, updatedSettings)
      })
      .catch(handleUpdateError)
  }

  /* Logic stuff with checking across Build and Logic tabs */
  $scope.$watch(
    '[myform.form_fields, myform.form_logics]',
    () => {
      $scope.checkLogicError()
    },
    true,
  )

  /**
   * Updates $scope.isLogicError based on whether form has logic units with fields
   * that no longer exist or deleted field options.
   */
  $scope.checkLogicError = () => {
    $scope.isLogicError = $scope.myform.form_logics.some((logicUnit) => {
      return (
        hasConditionError(logicUnit) ||
        hasShowError(logicUnit) ||
        hasInvalidValues(logicUnit)
      )
    })
  }

  /**
   * Checks if all fields exist in a logic unit's conditions.
   * @param {Object} logicUnit
   */
  const hasConditionError = (logicUnit) => {
    return logicUnit.conditions.some((condition) => !getField(condition.field))
  }

  /**
   * Checks if a logic unit has any errors in its fields to show.
   * @param {Object} logicUnit
   */
  const hasShowError = (logicUnit) => {
    if (logicUnit.logicType !== LogicType.ShowFields) {
      return false
    }
    return logicUnit.show.some((showField) => !getField(showField))
  }

  let getField = (fieldId) => {
    return $scope.myform.form_fields.find(function (field) {
      return field._id === fieldId
    })
  }

  /**
   * Checks if a logic unit has any errors in its field values.
   * @param {Object} logicUnit
   */
  const hasInvalidValues = (logicUnit) => {
    return logicUnit.conditions.some((condition) => {
      return $scope.checkIfHasInvalidValues(
        condition.value,
        $scope.myform.form_fields.find(
          (field) => field._id === condition.field,
        ), // must use the myform.form_fields and not condition.fieldInfo because condition.fieldInfo has not been updated
        condition.state,
      )
    })
  }

  $scope.checkIfHasInvalidValues = function (values, field, state) {
    if (
      !field ||
      !state ||
      !values ||
      ((Array.isArray(values) || String(values)) && values.length === 0)
    ) {
      // if field, state, value has not been chosen has not been chosen, no error
      return false
    }
    if (
      field.fieldType === BasicField.Dropdown ||
      field.fieldType === BasicField.Radio
    ) {
      const flattenedValues = [].concat(values).reduce((options, val) => {
        return options.concat(val)
      }, [])
      return flattenedValues.some((val) => {
        if (field.fieldOptions.includes(val)) {
          return false
        }
        return val === 'Others' ? !field.othersRadioButton : true
      })
    } else if (field.fieldType === BasicField.Checkbox) {
      const flattenedValues = [].concat(values).reduce((options, val) => {
        return options.concat(val)
      }, [])
      return flattenedValues.some((val) => {
        if (val.other) {
          return !field.othersRadioButton
        }
        return !field.fieldOptions.includes(val.value)
      })
    } else if (field.fieldType === BasicField.Rating) {
      return values > field.ratingOptions.steps
    } else if (field.fieldType === BasicField.Decimal) {
      const min = field.ValidationOptions.customMin
      const max = field.ValidationOptions.customMax
      const belowMin = min ? values < min : false
      const aboveMax = max ? max < values : false
      if (state === LogicConditionState.Lte) {
        return belowMin
      } else if (state === LogicConditionState.Gte) {
        return aboveMax
      } else {
        return belowMin || aboveMax
      }
    } else {
      return false
    }
  }
}
