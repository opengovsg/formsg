'use strict'

const FormFeedback = require('../../services/FormFeedbackService')

angular.module('forms').component('feedbackFormComponent', {
  templateUrl:
    'modules/forms/base/componentViews/feedback-form.client.view.html',
  bindings: {
    isPreview: '<',
    formId: '@',
    colorTheme: '@',
  },
  controller: ['Toastr', '$scope', feedbackController],
  controllerAs: 'vm',
})

function feedbackController(Toastr, $scope) {
  const vm = this

  vm.$onInit = () => {
    vm.isSubmitted = false
    vm.comment = ''
    vm.rating = null
  }

  vm.submitFeedback = function () {
    vm.isLoading = true

    if (vm.rating !== null) {
      const feedback = {
        rating: vm.rating,
        comment: vm.comment,
        isPreview: vm.isPreview,
      }

      FormFeedback.postFeedback(vm.formId, feedback).then(
        function (_response) {
          vm.isSubmitted = true
          vm.isLoading = false
          Toastr.success('Thank you for your submission!')
          $scope.$apply()
        },
        function (_error) {
          vm.isSubmitted = true
          vm.isLoading = false
          Toastr.error(
            "It's likely your network connectivity is down. Please try again later.",
          )
        },
      )
    }
  }
}
