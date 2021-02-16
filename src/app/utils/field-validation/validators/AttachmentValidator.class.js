const { MB } = require('../../../constants/filesize')
const BaseFieldValidator = require('./BaseFieldValidator.class')

class AttachmentValidator extends BaseFieldValidator {
  _generateByteLengthLimit() {
    const num = parseInt(this.formField.attachmentSize)
    return num * MB
  }

  _isSizeValid() {
    // Check if size of the content is more than the limit
    const isValid =
      this.response.content.byteLength < this._generateByteLengthLimit()
    this.logIfInvalid(
      isValid,
      'AttachmentValidator, file size more than limit.',
    )
    return isValid
  }

  _isFilledAnswerValid() {
    const { content } = this.response
    const noAttachment = content === undefined

    if (noAttachment) {
      this.logIfInvalid(false, 'Required but no attachment content')
      return false
    }

    return this._isSizeValid()
  }
}

module.exports = AttachmentValidator
