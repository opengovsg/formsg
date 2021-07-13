const PUBLIC_FORM_FIELDS = <const>[
  'admin',
  'authType',
  'endPage',
  'esrvcId',
  'form_fields',
  'form_logics',
  'hasCaptcha',
  'startPage',
  'status',
  'title',
  '_id',
  'responseMode',
]

export const EMAIL_PUBLIC_FORM_FIELDS = PUBLIC_FORM_FIELDS
export const STORAGE_PUBLIC_FORM_FIELDS = <const>[
  ...PUBLIC_FORM_FIELDS,
  'publicKey',
]

const FORM_SETTINGS_FIELDS = <const>[
  'authType',
  'esrvcId',
  'hasCaptcha',
  'inactiveMessage',
  'status',
  'submissionLimit',
  'title',
  'webhook',
]

export const EMAIL_FORM_SETTINGS_FIELDS = <const>[
  ...FORM_SETTINGS_FIELDS,
  'emails',
]
export const STORAGE_FORM_SETTINGS_FIELDS = FORM_SETTINGS_FIELDS
