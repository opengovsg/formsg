'use strict'

const moment = require('moment-timezone')

const {
  processDecryptedContent,
} = require('../../helpers/process-decrypted-content')
const { triggerFileDownload } = require('../../helpers/util')

const { FormSgSdk } = require('../../../../services/FormSgSdkService')

const SHOW_PROGRESS_DELAY_MS = 3000

const AdminSubmissionsService = require('../../../../services/AdminSubmissionsService')

angular
  .module('forms')
  .controller('ViewResponsesController', [
    '$q',
    '$scope',
    'Submissions',
    'NgTableParams',
    'responseModeEnum',
    'Toastr',
    '$uibModal',
    '$timeout',
    '$location',
    '$anchorScroll',
    ViewResponsesController,
  ])

function ViewResponsesController(
  $q,
  $scope,
  Submissions,
  NgTableParams,
  responseModeEnum,
  Toastr,
  $uibModal,
  $timeout,
  $location,
  $anchorScroll,
) {
  const vm = this

  // $scope inherited from Admin Form Controller
  vm.myform = $scope.myform
  vm.loading = true
  vm.isEncryptResponseMode = vm.myform.responseMode === responseModeEnum.ENCRYPT
  vm.encryptionKey = null // will be set to an instance of EncryptionKey when form is unlocked successfully
  vm.csvDownloading = false // whether CSV export is in progress
  vm.attachmentsToDownload = -1 // how many attachments will be downloaded (-1 for no attachments)

  vm.attachmentDownloadUrls = new Map()
  vm.filterBySubmissionRefId = '' // whether to filter submissions by a specific ID
  vm.filterBySubmissionRefIdTextbox = ''
  vm.filterBySubmissionRefIdMatcher = /^[0-9A-Fa-f]{24}$/
  vm.filterBySubmissionShowFilterBox = false

  // Three views:
  // 1 - Unlock view for verifying form password
  // 2 - Unlocked view with responses table
  // 3 - Unlocked view with specific response
  vm.currentView = 1

  vm.datePicker = { date: { startDate: null, endDate: null } }

  // BroadcastChannel will only broadcast the message to scripts from the same origin
  // (i.e. https://form.gov.sg in practice) so all data should be controlled by scripts
  // originating from FormSG. This does not store any data in browser-based storage
  // (e.g. cookies or localStorage) so secrets would not be retained past the user closing
  // all FormSG tabs containing the form.

  // We do not use polyfills for BroadcastChannel as they usually involve localStorage,
  // which is not safe for secret key handling.

  // BroadcastChannel is not available on Safari and IE 11, so this feature is not available
  // on those two browsers. Current behavior where users have to upload the secret key on
  // each tab will continue for users on those two browsers.
  if (typeof BroadcastChannel === 'function') {
    vm.privateKeyChannel = new BroadcastChannel('formsg_private_key_sharing')
    vm.privateKeyChannel.onmessage = function (e) {
      if (e.data.action === 'broadcastKey') {
        if (vm.encryptionKey === null && vm.myform._id === e.data.formId) {
          vm.unlock({ encryptionKey: e.data.encryptionKey })
          $scope.$digest()
        }
      }
      if (e.data.action === 'requestKey') {
        if (vm.encryptionKey !== null && vm.myform._id === e.data.formId) {
          vm.privateKeyChannel.postMessage({
            formId: vm.myform._id,
            action: 'broadcastKey',
            encryptionKey: vm.encryptionKey,
          })
        }
      }
    }

    vm.privateKeyChannel.postMessage({
      formId: vm.myform._id,
      action: 'requestKey',
    })
  }

  // Datepicker for export CSV function
  vm.exportCsvDate = {
    value: '',
    isOpen: false,
    options: {
      changeYear: true,
      changeMonth: true,
      showWeeks: false,
      formatMonth: 'MMM',
    },
  }

  // Function to use $anchorScroll to scroll to top of responses.
  vm.scrollToTop = function () {
    // set the location.hash
    $location.hash('responses-tab')

    $anchorScroll()

    // Remove hash
    $location.hash('')
    $location.replace()
  }

  // Trigger for export CSV
  vm.exportCsv = function (downloadAttachments) {
    let params = {
      formId: vm.myform._id,
      formTitle: vm.myform.title,
    }
    if (vm.datePicker.date.startDate && vm.datePicker.date.endDate) {
      params.startDate = moment(new Date(vm.datePicker.date.startDate)).format(
        'YYYY-MM-DD',
      )
      params.endDate = moment(new Date(vm.datePicker.date.endDate)).format(
        'YYYY-MM-DD',
      )
    }

    vm.csvDownloading = true

    Submissions.downloadEncryptedResponses(
      params,
      downloadAttachments, // whether to download attachments
      vm.encryptionKey.secretKey,
    )
      .then(function (result) {
        $timeout(function () {
          const { expectedCount, successCount, errorCount } = result
          if (expectedCount === 0) {
            Toastr.success('No responses found for decryption.')
          } else {
            Toastr.success(
              `Success. ${successCount}/${expectedCount} response(s) were decrypted. ${
                errorCount > 0 ? `${errorCount} failed.` : ''
              }`,
            )
          }
        })
      })
      .catch(function (error) {
        try {
          const { errorCount, errorMessage } = JSON.parse(error.message)
          Toastr.error(
            errorMessage ||
              `Error downloading. ${errorCount} response(s) could not be decrypted. Please try again later.`,
            { timeOut: 3000 },
          )
        } catch (error) {
          console.error('Unknown download encrypted responses error:\t', error)
        }
      })
      .finally(function () {
        $timeout(function () {
          vm.attachmentsToDownload = -1
          vm.csvDownloading = false
        })
      })
  }

  vm.rowOnClick = function (i) {
    // i is the index of the response in the array of metadata (varies from 0 to (length of metadata array - 1))
    // number is the index of the response among the entire set of responses (varies from 1 to total number of response)
    let submissionId = vm.tableParams.data[i].refNo
    vm.currentResponse = {
      index: i,
      number: vm.tableParams.data[i].number,
    }
    vm.updateResponseShown(submissionId, vm.currentResponse.number)
  }

  vm.backToList = function () {
    vm.currentView = 2
  }

  vm.updateResponseShown = (submissionId, responseNum) => {
    vm.loading = true
    vm.currentView = 3

    $q.when(
      AdminSubmissionsService.getEncryptedResponse({
        formId: vm.myform._id,
        submissionId,
      }),
    ).then((response) => {
      if (vm.encryptionKey !== null) {
        vm.attachmentDownloadUrls = new Map()

        const { content, verified, attachmentMetadata, version } = response
        let displayedContent

        try {
          const decrypted = FormSgSdk.crypto.decrypt(
            vm.encryptionKey.secretKey,
            {
              encryptedContent: content,
              verifiedContent: verified,
              version,
            },
          )

          // Convert decrypted content into displayable object.
          displayedContent = processDecryptedContent(decrypted)
        } catch (err) {
          const errorMessage = 'Could not decrypt the response.'
          Toastr.error(errorMessage)
          displayedContent = [{ question: errorMessage, answer: '' }]
        }

        let questionCount = 0
        displayedContent.forEach((field) => {
          // Populate question number
          if (field.fieldType !== 'section') {
            field.questionNumber = ++questionCount
          }
          // Populate S3 presigned URL for attachments
          if (attachmentMetadata[field._id]) {
            vm.attachmentDownloadUrls.set(questionCount, {
              url: attachmentMetadata[field._id],
              filename: field.answer,
            })
            field.downloadUrl = attachmentMetadata[field._id]
          }
        })

        vm.decryptedResponse = {
          ...response,
          content: displayedContent,
          responseNum,
        }
      }

      vm.loading = false
    })
  }

  vm.confirmSubmissionCountsBeforeDownload = function () {
    const { startDate, endDate } = vm.datePicker.date
    const params =
      startDate && endDate
        ? {
            formId: vm.myform._id,
            dates: {
              startDate: moment(new Date(startDate)).format('YYYY-MM-DD'),
              endDate: moment(new Date(endDate)).format('YYYY-MM-DD'),
            },
          }
        : {
            formId: vm.myform._id,
          }
    $q.when(AdminSubmissionsService.countFormSubmissions(params)).then(
      (responsesCount) => {
        vm.attachmentsToDownload = responsesCount
        $uibModal
          .open({
            backdrop: 'static',
            resolve: { responsesCount },
            controller: [
              '$scope',
              '$uibModalInstance',
              'responsesCount',
              function ($scope, $uibModalInstance, responsesCount) {
                $scope.responsesCount = responsesCount
              },
            ],
            windowClass: 'pop-up-modal-window',
            templateUrl:
              'modules/forms/admin/views/download-all-attachments.client.modal.html',
          })
          .result.then(() => vm.exportCsv(true))
      },
    )
  }

  vm.downloadAllAttachments = function () {
    $q.when(
      AdminSubmissionsService.downloadAndDecryptAttachmentsAsZip(
        vm.attachmentDownloadUrls,
        vm.encryptionKey.secretKey,
      ),
    )
      .then((blob) => {
        triggerFileDownload(
          blob,
          'RefNo ' +
            vm.tableParams.data[vm.currentResponse.index].refNo +
            '.zip',
        )
      })
      .catch((error) => {
        console.error(error)
        Toastr.error(
          'An error occurred while downloading the attachments in a ZIP file. Try downloading them separately.',
        )
      })
  }

  vm.nextRespondent = function () {
    vm.scrollToTop()
    if (vm.currentResponse.number <= 1) {
      // This is the last response
    } else if (vm.currentResponse.index >= vm.tableParams.data.length - 1) {
      // Need to get next page of results
      let currentPage = vm.tableParams.page()
      vm.tableParams.page(currentPage + 1)
      vm.loading = true
      vm.tableParams.reload().then(() => {
        vm.rowOnClick(0)
      })
    } else {
      // Grab next submission id from metadata array and pull submission info from db
      vm.currentResponse.index++
      vm.currentResponse.number--
      let submissionId = vm.tableParams.data[vm.currentResponse.index].refNo
      vm.updateResponseShown(submissionId, vm.currentResponse.number)
    }
  }

  vm.previousRespondent = function () {
    vm.scrollToTop()
    if (vm.currentResponse.number >= vm.responsesCount) {
      // This is the first response
    } else if (vm.currentResponse.index <= 0) {
      // Need to get previous page of results
      let currentPage = vm.tableParams.page()
      vm.tableParams.page(currentPage - 1)
      vm.loading = true
      vm.tableParams.reload().then(() => {
        vm.rowOnClick(9)
      })
    } else {
      // Grab next submission id from metadata array and pull submission info from db
      vm.currentResponse.index--
      vm.currentResponse.number++
      let submissionId = vm.tableParams.data[vm.currentResponse.index].refNo
      vm.updateResponseShown(submissionId, vm.currentResponse.number)
    }
  }

  // When this route is initialized, call the responses count function
  $scope.$parent.$watch('vm.activeResultsTab', (newValue) => {
    if (newValue === 'responses' && vm.loading) {
      $q.when(
        AdminSubmissionsService.countFormSubmissions({ formId: vm.myform._id }),
      )
        .then((responsesCount) => {
          vm.responsesCount = responsesCount
          $timeout(() => {
            vm.loading = false
          }, 200)
        })
        .catch((error) => {
          console.error(error)
        })
    }
  })

  vm.filterBySubmissionChanged = function () {
    // We only reload the table if the text box has changed. This prevents excessive
    // requests being sent by users clicking on the "Filter" button repeatedly.
    if (
      vm.filterBySubmissionRefIdTextbox !== '' &&
      vm.filterBySubmissionRefId !== vm.filterBySubmissionRefIdTextbox
    ) {
      vm.filterBySubmissionRefId = vm.filterBySubmissionRefIdTextbox
      vm.tableParams.reload()
    }
  }

  vm.filterBySubmissionReset = function () {
    vm.filterBySubmissionShowFilterBox = false
    vm.filterBySubmissionRefId = ''
    vm.filterBySubmissionRefIdTextbox = ''
    vm.tableParams.reload()
  }

  // Called by child directive unlockResponsesForm after key is verified to get responses
  vm.loadResponses = function () {
    vm.currentView = 2
    vm.loading = true
    vm.tableParams = new NgTableParams(
      {
        page: 1, // show first page
        count: 10, // count per page
      },
      {
        getData: (params) => {
          let { page } = params.url()
          const getMetadataPromise = vm.filterBySubmissionRefId
            ? AdminSubmissionsService.getSubmissionMetadataById({
                formId: vm.myform._id,
                submissionId: vm.filterBySubmissionRefId,
              })
            : AdminSubmissionsService.getSubmissionsMetadataByPage({
                formId: vm.myform._id,
                page,
              })
          return $q
            .when(getMetadataPromise)
            .then((data) => {
              params.total(data.count)
              vm.responsesCount = data.count
              return data.metadata
            })
            .catch((error) => {
              console.error(error)
            })
        },
        counts: [], // Remove page size options
      },
    )
    vm.loading = false

    if (typeof vm.privateKeyChannel !== 'undefined') {
      vm.privateKeyChannel.postMessage({
        formId: vm.myform._id,
        action: 'broadcastKey',
        encryptionKey: vm.encryptionKey,
      })
    }
  }

  /** * UNLOCK RESPONSES ***/
  vm.unlock = function ({ encryptionKey }) {
    if (encryptionKey !== null) {
      vm.encryptionKey = encryptionKey
      vm.loadResponses()
    }
  }

  // Triggers the download progress modal after SHOW_PROGRESS_DELAY_MS has
  // passed and is still downloading after export button click.
  let timeoutPromise
  let progressModal
  $scope.$watch('vm.csvDownloading', function (csvDownloading) {
    if (!csvDownloading) {
      if (timeoutPromise) {
        $timeout.cancel(timeoutPromise)
      }

      if (progressModal) {
        progressModal.close()
        progressModal = null
      }
    } else {
      let attachmentsToDownload = vm.attachmentsToDownload
      timeoutPromise = $timeout(function () {
        progressModal = $uibModal.open({
          animation: true,
          backdrop: 'static',
          keyboard: false,
          resolve: { attachmentsToDownload },
          controller: [
            '$scope',
            '$uibModalInstance',
            'attachmentsToDownload',
            function ($scope, $uibModalInstance, attachmentsToDownload) {
              $scope.attachmentsToDownload = attachmentsToDownload
              $scope.$on('modal.closing', function (event, reason, closed) {
                if (!closed) {
                  // If modal is dismissed, we cancel the current download
                  Submissions.cancelDownloadEncryptedResponses()
                  vm.csvDownloading = false
                  vm.attachmentsToDownload = -1
                }
              })
            },
          ],
          templateUrl:
            'modules/forms/admin/views/decrypt-progress.client.modal.html',
          windowClass: 'submit-progress-modal-window',
        })
      }, SHOW_PROGRESS_DELAY_MS)
    }
  })
}
