import dedent from 'dedent-js'
import Mail from 'nodemailer/lib/mailer'
import validator from 'validator'
import { Logger } from 'winston'

import config from '../../config/config'
import { createLoggerWithLabel } from '../../config/logger'
import { HASH_EXPIRE_AFTER_SECONDS } from '../../shared/util/verification'
import { EMAIL_HEADERS, EMAIL_TYPES } from '../constants/mail'

const mailLogger = createLoggerWithLabel('mail')

type SendMailOptions = {
  mailId?: string
  formId?: string
}

type MailServiceParams = {
  appName?: string
  transporter?: Mail
  senderEmail?: string
  logger?: Logger
}

export class MailService {
  #appName: string
  #transporter: Mail
  #senderEmail: string
  #logger: Logger

  constructor({
    appName = config.app.title,
    transporter = config.mail.transporter,
    senderEmail = config.mail.mailer.from,
    logger = mailLogger,
  }: MailServiceParams = {}) {
    this.#appName = appName
    this.#senderEmail = senderEmail
    this.#transporter = transporter
    this.#logger = logger
  }

  /**
   * Sends email to SES / Direct transport to send out
   * @param mail Mail data to send with
   * @param sendOptions Extra options to better identify mail, such as form or mail id.
   */
  sendNodeMail = async (mail: Mail.Options, sendOptions?: SendMailOptions) => {
    const emailLogString = `mailId: ${sendOptions?.mailId}\t Email from:${mail?.from}\t subject:${mail?.subject}\t formId: ${sendOptions?.formId}`

    // Guard against missing mail info.
    if (!mail || !mail.to) {
      this.#logger.error(`mailError: undefined mail. ${emailLogString}`)
      return Promise.reject(new Error('Mail undefined error'))
    }

    // Guard against invalid emails.
    if (!validator.isEmail(String(mail.to))) {
      this.#logger.error(
        `mailError: ${mail.to} is not a valid email. ${emailLogString}`,
      )
      return Promise.reject(new Error('Invalid email error'))
    }

    this.#logger.info(emailLogString)
    this.#logger.profile(emailLogString)

    try {
      const response = await this.#transporter.sendMail(mail)
      this.#logger.info(`mailSuccess:\t${emailLogString}`)
      return response
    } catch (err) {
      // Pass errors to the callback
      this.#logger.error(
        `mailError ${err.responseCode}:\t${emailLogString}`,
        err,
      )
      return Promise.reject(err)
    }
  }

  /**
   * Sends an otp to a valid email
   * @param recipient the recipient email address
   * @param otp the otp to send
   * @throws error if mail fails, to be handled by verification service
   */
  sendVerificationOtp = async (recipient: string, otp: string) => {
    // TODO(#42): Remove param guards once whole backend is TypeScript.
    if (!otp) {
      throw new Error('OTP is missing.')
    }
    if (!recipient) {
      throw new Error('Recipient email is missing')
    }
    if (!validator.isEmail(recipient)) {
      throw new Error(`${recipient} is not a valid email`)
    }

    const minutesToExpiry = Math.floor(HASH_EXPIRE_AFTER_SECONDS / 60)

    const mail: Mail.Options = {
      to: recipient,
      from: this.#senderEmail,
      subject: `Your OTP for submitting a form on ${this.#appName}`,
      html: dedent`
        <p>You are currently submitting a form on ${this.#appName}.</p>
        <p>
          Your OTP is <b>${otp}</b>. 
          It will expire in ${minutesToExpiry} minutes. 
          Please use this to verify your submission.
        </p>
        <p>If your OTP does not work, please request for a new OTP.</p>
      `,
      headers: {
        [EMAIL_HEADERS.emailType]: EMAIL_TYPES.verificationOtp,
      },
    }
    // Error gets caught in getNewOtp
    return this.sendNodeMail(mail, { mailId: 'verify' })
  }
}

export default new MailService()
