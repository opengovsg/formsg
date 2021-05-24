import axios from 'axios'
import jwtDecode from 'jwt-decode'
import { z } from 'zod'

import { AuthType } from '../../types'
import {
  PublicFormAuthRedirectDto,
  PublicFormAuthValidateEsrvcIdDto,
} from '../../types/api'
import { CookieBuilderOptions, deleteCookie, getCookie } from '../utils/cookie'

enum PublicFormAuthCookieName {
  SP = 'jwtSp',
  CP = 'jwtCp',
}

const SpcpAuth = z.object({
  userName: z.string(),
  rememberMe: z.boolean(),
  iat: z.number(),
  exp: z.number(),
})
type SpcpAuth = z.infer<typeof SpcpAuth>

// Exported for testing
export const PUBLIC_FORMS_ENDPOINT = '/api/v3/forms'

export const createRedirectURL = async (
  formId: string,
  isPersistentLogin = false,
): Promise<PublicFormAuthRedirectDto> => {
  return axios
    .get<PublicFormAuthRedirectDto>(
      `${PUBLIC_FORMS_ENDPOINT}/${formId}/auth/redirect`,
      {
        params: { isPersistentLogin },
      },
    )
    .then(({ data }) => data)
}

export const validateEsrvcId = async (
  formId: string,
): Promise<PublicFormAuthValidateEsrvcIdDto> => {
  return axios
    .get<PublicFormAuthValidateEsrvcIdDto>(
      `${PUBLIC_FORMS_ENDPOINT}/${formId}/auth/validate`,
    )
    .then(({ data }) => data)
}

/**
 * Returns the name of the cookie that corresponds to the auth type provided.
 * @param authType the auth type to retrieve the mapped cookie name for
 * @returns cookie name if mapping exists, null otherwise
 */
export const mapAuthTypeToCookieName = (
  authType: AuthType,
): PublicFormAuthCookieName | null => {
  switch (authType) {
    case AuthType.SP:
      return PublicFormAuthCookieName.SP
    case AuthType.CP:
      return PublicFormAuthCookieName.CP
    default:
      return null
  }
}

/**
 * Get stored public form auth cookie of given authType, if available.
 * @param authType the type of cookie to retrieve
 * @returns cookie string related to authType if available, else return null
 */
export const getStoredJwt = (authType: AuthType): string | null => {
  const cookieName = mapAuthTypeToCookieName(authType)
  if (!cookieName) return null
  return getCookie(cookieName)
}

/**
 * Decodes and returns decoded jwt of auth type, if any.
 * @param authType the authType to retrieve mapped JWT from for decoding
 * @returns decoded JWT object if cookie was available, null otherwise
 * @throws jwt-decode#InvalidTokenError if retrieved jwt is malformed
 * @throws Error if retrieved jwt shape does not match expected
 */
export const getDecodedJwt = (authType: AuthType): SpcpAuth | null => {
  const jwt = getStoredJwt(authType)
  if (!jwt) return null
  return SpcpAuth.parse(jwtDecode(jwt))
}

/**
 * Logs out of public form by removing stored cookie based on auth type provided.
 * Note: if
 * @param authType the auth type for deleting cookie mapped to that auth type
 */
export const logout = (
  authType: AuthType,
  options: CookieBuilderOptions = {},
): void => {
  const cookieToRemove = mapAuthTypeToCookieName(authType)
  // Only remove if there is a valid mapping and there is a stored jwt already.
  if (cookieToRemove && getStoredJwt(authType)) {
    deleteCookie(cookieToRemove, options)
  }
}
