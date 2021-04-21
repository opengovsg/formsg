'use strict'

angular
  .module('forms')
  .directive('isVerifiableSaveInterceptor', [
    'Toastr',
    isVerifiableSaveInterceptor,
  ])

function isVerifiableSaveInterceptor(Toastr) {
  return {
    require: 'ngModel',
    link: (scope, elem, attr, ngModel) => {
      ngModel.$parsers.push((inputValue) => {
        if (!inputValue) {
          Toastr.error(
            'Turn on OTP verification again if you wish to restrict email domains.',
          )
          scope.vm.field.hasAllowedEmailDomains = false
          scope.vm.field.allowedEmailDomainsFromText = ''
        }
        return inputValue
      })
    },
  }
}
