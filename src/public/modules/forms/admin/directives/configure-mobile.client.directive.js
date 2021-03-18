'use strict'

angular
  .module('forms')
  .directive('configureMobileDirective', [configureMobileDirective])

function configureMobileDirective() {
  return {
    templateUrl:
      'modules/forms/admin/directiveViews/configure-mobile.client.view.html',
    restrict: 'E',
    scope: {
      field: '=',
      name: '=',
      characterLimit: '=',
    },
    controller: [
      '$uibModal',
      '$scope',
      '$translate',
      function ($uibModal, $scope, $translate) {
        // Get support form link from translation json.
        $translate('LINKS.SUPPORT_FORM_LINK').then((supportFormLink) => {
          $scope.supportFormLink = supportFormLink
        })

        $scope.openVerifiedSMSModal = function () {
          const isTogglingOnVerifiedSms = !$scope.field.isVerifiable
          $scope.verifiedSMSModal =
            isTogglingOnVerifiedSms &&
            $uibModal.open({
              animation: true,
              backdrop: 'static',
              keyboard: false,
              templateUrl: 'modules/forms/admin/views/pop-up.client.modal.html',
              windowClass: 'pop-up-modal-window',
              controller: 'PopUpModalController',
              controllerAs: 'vm',
              resolve: {
                externalScope: function () {
                  return {
                    title: 'Verified SMS charges',
                    confirmButtonText: 'OK, Noted',
                    description: `
                      Under 10,000 form responses: Free verified SMS
                      <br><br>
                      Above 10,000 form responses: <b>~US$0.0395 per SMS - <a href=${$scope.supportFormLink} target="_blank" class="">contact us</a> 
                      for billing</b>. Forms exceeding the free tier without billing will be deactivated.
                    `,
                  }
                },
              },
            })
        }
      },
    ],
  }
}
