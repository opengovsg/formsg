import { DateString } from '../../shared/types/generic'

export type ExtractTypeFromArray<T> = T extends readonly (infer E)[] ? E : T

/**
 * Helper type to transform DTO types back to their serialized types.
 * Currently only used to cast DateStrings back to Date types.
 *
 * This is useful to transform shared DTO types back to their backend types
 * for typing express controller return types, relying on implicit
 * JSON.parse(JSON.stringify()) conversions between client and server.
 */
export type DeserializeTransform<T> = {
  [K in keyof T]: T[K] extends DateString ? Date : T[K]
}
