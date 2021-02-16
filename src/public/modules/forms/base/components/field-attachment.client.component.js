'use strict'

const { FilePlatforms } = require('../../../../../shared/constants')
const { MB, KB } = require('../../../../../app/constants/filesize')

angular.module('forms').component('attachmentFieldComponent', {
  templateUrl:
    'modules/forms/base/componentViews/field-attachment.client.view.html',
  bindings: {
    field: '<',
    forms: '<',
    isadminpreview: '<',
  },
  controller: ['FileHandler', '$timeout', attachmentFieldComponentController],
  controllerAs: 'vm',
})

function attachmentFieldComponentController(FileHandler, $timeout) {
  const vm = this

  vm.isAttachmentTouched = false
  vm.touchAttachment = function () {
    vm.isAttachmentTouched = true
  }

  vm.fileAttached = false
  vm.isLoading = false
  vm.beforeResizingImages = function (_fieldId) {
    vm.isLoading = true
  }
  vm.uploadFile = function (file, errFiles, _fieldId) {
    let err
    if (errFiles.length > 0) {
      err = errFiles[0].$error
      if (err === 'maxSize') {
        const currentSize = (errFiles[0].size / MB).toFixed(2)
        showAttachmentError(
          `${currentSize} MB / ${vm.field.attachmentSize} MB: File size exceeded`,
        )
      } else if (err === 'resize') {
        showAttachmentError(`An error has occurred while resizing your image`)
      } else {
        showAttachmentError(err)
      }
      return
    }

    if (!file) return

    let fileExt = FileHandler.getFileExtension(file.name)
    if (FileHandler.isInvalidFileExtension(fileExt)) {
      showAttachmentError(
        `Your file's extension ending in *${fileExt} is not allowed`,
      )
      return
    }

    const getInvalidFileExtensionsInZip = FileHandler.getInvalidFileExtensionsInZip(
      FilePlatforms.Browser,
    )
    const invalidFilesInZip =
      fileExt === '.zip'
        ? getInvalidFileExtensionsInZip(file)
        : Promise.resolve([])
    invalidFilesInZip
      .then((invalidFiles) => {
        // Use $timeout to trigger digest cycle
        $timeout(() => {
          if (invalidFiles.length > 0) {
            const stringOfInvalidExtensions = invalidFiles.join(', ')
            showAttachmentError(
              `The following file extensions in your zip are not valid: ${stringOfInvalidExtensions}`,
            )
          } else {
            saveFileToField(file)
          }
        })
      })
      .catch(() => {
        $timeout(() => {
          showAttachmentError(
            'An error has occurred while parsing your zip file',
          )
        })
      })
  }

  vm.attachmentIsDisabled = (field) => {
    return (vm.isadminpreview && !vm.isLoading) || field.disabled
  }

  vm.removeFile = function () {
    delete vm.field.file
    vm.fileAttached = false
    vm.field.fieldValue = ''
  }

  // Context: iOS seems to clear file attachment content in attached files
  // after one minute (or more) resulting in an empty content buffer being
  // sent to the server. This results in an invalid submission if the form has
  // attachments and the user takes more than one minute to submit the form.
  // A possibly stupid solution is to convert the file reference into a blob
  // and back again to create a new reference that does not get inexplicably
  // cleared on iOS (and that is indeed what is being done here).
  const saveFileToField = (file) => {
    const reader = new FileReader()

    // Context: Android file picker gives an option to upload files directly
    // from Google Drive, but those cause errors with FileReader and
    // XMLHttpRequest.
    reader.onerror = () => {
      $timeout(() => {
        showAttachmentError(
          'Upload failed. If you are using online storage such as Google Drive, ' +
            'download your file before attaching the downloaded version',
        )
      })
    }

    reader.onload = function (e) {
      $timeout(() => {
        const blob = new Blob([new Uint8Array(e.target.result)], {
          type: file.type,
        })

        // Not using File constructor because IE11 does not support File
        blob.name = file.name
        blob.lastModifiedDate = file.lastModifiedDate

        // Assign it to the field.
        vm.field.file = blob
        vm.field.fieldValue = file.name

        vm.fileAttached = true
        vm.fileError = false
        vm.fileName = file.name
        vm.fileSize = file.size / KB
        if (file.size / KB > KB) {
          vm.fileSize = String((file.size / MB).toFixed(2)) + ' MB'
        } else {
          vm.fileSize = String((file.size / KB).toFixed(2)) + ' KB'
        }
        vm.isLoading = false
      })
    }
    reader.readAsArrayBuffer(file)
  }

  /**
   * Shows an error message and erases file.
   * @param {string} message Error message to show. Should not include period as period is hardcoded in view.
   */
  const showAttachmentError = (message) => {
    vm.fileError = message
    vm.field.fieldValue = ''
    vm.fileAttached = false
    vm.isLoading = false
  }
}
