const get = require('lodash/get')

angular.module('core').component('avatarDropdownComponent', {
  templateUrl: 'modules/core/componentViews/avatar-dropdown.html',
  bindings: {},
  controller: [
    '$scope',
    '$state',
    '$uibModal',
    'Auth',
    avatarDropdownController,
  ],
  controllerAs: 'vm',
})

function avatarDropdownController($scope, $state, $uibModal, Auth) {
  const vm = this

  // Preload user with current details, redirect to signin if unable to get user
  vm.user = Auth.getUser() || $state.go('signin')
  vm.avatarText = generateAvatarText()

  vm.isDropdownHover = false
  vm.isDropdownFocused = false
  
  // Attempt to retrieve the most updated user.
  retrieveUser()

  function retrieveUser() {
    return Auth.refreshUser().then(user => {
      // Redirect to signin if unable to get user
      if (!user) {
        $state.go('signin')
      } else {
        vm.user = user
      }
    })
  }

  vm.isDropdownOpen = false

  $scope.$watchGroup(['vm.isDropdownHover', 'vm.isDropdownFocused'], function (
    newValues,
  ) {
    vm.isDropdownOpen = newValues[0] || newValues[1]
  })

  vm.signOut = () => Auth.signOut()

  vm.openContactNumberModal = () => {
    $uibModal.open({
      animation: false,
      keyboard: false,
      backdrop: 'static',
      windowClass: 'ecm-modal-window',
      templateUrl: 'modules/core/views/edit-contact-number-modal.view.html',
      controller: 'EditContactNumberModalController',
      controllerAs: 'vm',
    }).result.then((returnVal) => {
      // Update success, update user.
      if (returnVal) {
        vm.user = returnVal
        Auth.setUser(returnVal)
      }
    }).finally(angular.noop)
  }

  function generateAvatarText() {
    const userEmail = get(vm.user, 'email')
    if (userEmail) {
      // Get first two characters of name.
      return userEmail.split('@')[0].slice(0, 2) || '?'
    }

    return '?'
  }
}
