import { z } from 'zod'
import { Opaque } from 'type-fest'

import { DateString } from './generic'
import { AgencyBase, AgencyDto, PublicAgencyDto } from './agency'

type UserId = Opaque<string, 'UserId'>

// Base used for being referenced by schema/model in the backend.
// Note the lack of typing of _id.
export const UserBase = z.object({
  email: z.string().email(),
  agency: AgencyBase.shape._id,
  betaFlags: z
    .object({
      sgid: z.boolean().optional(),
    })
    .optional(),
  created: z.date(),
  lastAccessed: z.date().optional(),
  updatedAt: z.date(),
  contact: z.string().optional(),
})
export type UserBase = z.infer<typeof UserBase>

// Convert to serialized versions.
export const UserDto = UserBase.extend({
  _id: z.string() as unknown as z.Schema<UserId>,
  agency: AgencyDto.extend({
    created: DateString,
    lastModified: DateString,
  }),
  created: DateString,
  lastAccessed: DateString.optional(),
  updatedAt: DateString,
})
export type UserDto = z.infer<typeof UserDto>

export type PublicUserDto = {
  agency: PublicAgencyDto | AgencyDto['_id']
}
