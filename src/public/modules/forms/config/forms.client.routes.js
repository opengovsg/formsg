'use strict'

const ExamplesService = require('../../../services/ExamplesService')
const UserService = require('../../../services/UserService')

// Setting up route
angular.module('forms').config([
  '$stateProvider',
  function ($stateProvider) {
    // Forms state routing
    $stateProvider
      .state('listForms', {
        url: '/forms',
        templateUrl: 'modules/forms/admin/views/list-forms.client.view.html',
        controller: 'ListFormsController',
        controllerAs: 'vm',
      })
      .state('submitForm', {
        url: '/{formId:[0-9a-fA-F]{24}}',
        templateUrl: 'modules/forms/base/views/submit-form.client.view.html',
        resolve: {
          FormData: [
            'FormApi',
            '$transition$',
            function (FormApi, $transition$) {
              return FormApi.getPublicForm($transition$.params().formId)
            },
          ],
        },
        controller: 'SubmitFormController',
        controllerAs: 'vm',
      })
      .state('previewForm', {
        url: '/{formId:[0-9a-fA-F]{24}}/preview',
        templateUrl: 'modules/forms/base/views/submit-form.client.view.html',
        resolve: {
          FormData: [
            'FormApi',
            '$transition$',
            function (FormApi, $transition$) {
              return FormApi.previewForm($transition$.params().formId).then(
                (FormData) => {
                  FormData.isTemplate = true
                  FormData.isPreview = true
                  return FormData
                },
              )
            },
          ],
        },
        controller: 'SubmitFormController',
        controllerAs: 'vm',
      })
      .state('templateForm', {
        url: '/{formId:[0-9a-fA-F]{24}}/template',
        templateUrl: 'modules/forms/base/views/submit-form.client.view.html',
        resolve: {
          FormData: [
            'FormApi',
            '$transition$',
            function (FormApi, $transition$) {
              return FormApi.queryTemplate($transition$.params().formId).then(
                (FormData) => {
                  FormData.isTemplate = true
                  return FormData
                },
              )
            },
          ],
        },
        controller: 'SubmitFormController',
        controllerAs: 'vm',
      })
      .state('useTemplate', {
        url: '/{formId:[0-9a-fA-F]{24}}/use-template',
        templateUrl: 'modules/users/views/examples.client.view.html',
        resolve: {
          FormErrorService: 'FormErrorService',
          // If the user is logged in, this field will contain the form data of the provided formId,
          // otherwise it will only contain the formId itself.
          FormData: [
            'FormErrorService',
            '$stateParams',
            function (FormErrorService, $stateParams) {
              if (!UserService.getUserFromLocalStorage()) {
                return $stateParams.formId
              }

              return ExamplesService.getSingleExampleForm($stateParams.formId)
                .then(function (response) {
                  response.form.isTemplate = true
                  return response.form
                })
                .catch((response) => {
                  return FormErrorService.redirect({
                    response,
                    targetState: 'useTemplate',
                    targetFormId: $stateParams.formId,
                  })
                })
            },
          ],
        },
        controller: 'ExamplesController',
        controllerAs: 'vm',
      })
      .state('viewForm', {
        url: '/{formId:[0-9a-fA-F]{24}}/admin',
        resolve: {
          FormData: [
            'FormApi',
            '$stateParams',
            function (FormApi, $stateParams) {
              return FormApi.getAdminForm($stateParams.formId)
            },
          ],
        },
        views: {
          '': {
            templateUrl:
              'modules/forms/admin/views/admin-form.client.view.html',
            controller: 'AdminFormController',
          },
          'settings@viewForm': {
            template: `<settings-form-directive
              myform="myform"
              update-form-settings="updateFormSettings(settingsToUpdate)"
              </settings-form-directive>`,
          },
          'build@viewForm': {
            template: `<edit-form-directive
              myform="myform"
              update-form="updateForm(update)"
              update-form-start-page="updateFormStartPage(newStartPage)"
              update-form-end-page="updateFormEndPage(newEndPage)">
              </edit-form-directive>`,
          },
          'logic@viewForm': {
            template: `<edit-logic-component 
                myform="myform"
                update-form="updateForm(update)"
                is-logic-error="isLogicError"
              </edit-logic-component>`,
          },
          'share@viewForm': {
            template: `<share-form-component 
                form-id="myform._id"
                is-logic-error="isLogicError"
                user-can-edit="userCanEdit"
                status="myform.status">
              </share-form-component>`,
          },
          'results@viewForm': {
            templateUrl:
              'modules/forms/admin/views/results-panel.client.view.html',
            controller: 'ResultsPanelController',
            controllerAs: 'vm',
          },
          'responses@viewForm': {
            templateUrl:
              'modules/forms/admin/views/view-responses.client.view.html',
            controller: 'ViewResponsesController',
            controllerAs: 'vm',
            resolve: {},
          },
          'feedback@viewForm': {
            template:
              '<view-feedback-directive myform="myform"></view-feedback-directive>',
          },
        },
      })
      .state('error', {
        url: '/error/:errorType',
        templateUrl: 'modules/forms/base/views/error-page.client.view.html',
        controller: 'ErrorPageController',
        controllerAs: 'vm',
        params: {
          errorType: null,
          // The text to be shown on the error page. The default here is that of 404 pages.
          errorMessage: "Oops! We can't find the page you're looking for.",
          // This flag is used to override the default 404 message ("please check link") in the
          // case that 404 is returned, but the form actually exists
          isPageFound: false,
          targetFormId: null,
          // This should be present if isPageFound
          targetFormTitle: null,
        },
      })
  },
])
