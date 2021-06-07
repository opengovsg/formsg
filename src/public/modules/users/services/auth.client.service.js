'use strict'

angular
  .module('users')
  .factory('Auth', ['$q', '$http', '$state', '$window', Auth])

function Auth($q, $http, $state, $window) {
  /**
   * Object representing a logged-in user and agency
   * @typedef {Object} User
   * @property {String} _id - The database ID of the user
   * @property {String} email - The email of the user
   * @property {Object} betaFlags - Whether the user has beta privileges for different features
   * @property {Object} agency - The agency that the user belongs to
   * @property {String} agency.created - Date created
   * @property {Array<String>} agency.emailDomain - Email domains belonging to agency
   * @property {String} agency.fullName - The full name of the agency
   * @property {String} agency.shortName - The short name of the agency
   * @property {String} agency.logo - URI specifying location of agency logo
   * @property {String} agency._id - The database ID of the agency
   */

  let authService = {
    getUser,
  }
  return authService

  /**
   * User getter function
   * @returns {User} user
   */
  function getUser() {
    // TODO: For backwards compatibility in case user is still logged in
    // and details are still saved on window
    let user = $window.localStorage.getItem('user')
    try {
      return user && JSON.parse(user)
    } catch (error) {
      return null
    }
  }
}
