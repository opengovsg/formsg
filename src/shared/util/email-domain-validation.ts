import validator from 'validator'

export const validateEmailDomains = (emailDomains: string[]): boolean => {
  return (
    // Email domains to be set must:
    // 1. Have no duplicates
    new Set(emailDomains).size === emailDomains.length &&
    // 2. Be all valid email domains
    emailDomains.every(
      (emailDomain) =>
        // We need to prepend "bob" to the email domain so that it can form an
        // email address and can be validated by validator.isEmail.
        emailDomain.startsWith('@') && validator.isEmail('bob' + emailDomain),
    )
  )
}
