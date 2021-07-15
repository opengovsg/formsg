import { Document, Model } from 'mongoose'

import { FormBillingStatistic, LoginBase } from '../../shared/types/billing'

import { IAgencySchema } from './agency'
import { IFormSchema, IPopulatedForm } from './form'
import { IUserSchema } from './user'

export interface ILogin extends LoginBase {
  admin: IUserSchema['_id']
  form: IFormSchema['_id']
  agency: IAgencySchema['_id']
}

export interface ILoginSchema extends ILogin, Document {
  created?: Date
}

export type LoginStatistic = FormBillingStatistic

export interface ILoginModel extends Model<ILoginSchema> {
  aggregateLoginStats: (
    esrvcId: string,
    gte: Date,
    lte: Date,
  ) => Promise<LoginStatistic[]>
  addLoginFromForm: (form: IPopulatedForm) => Promise<ILoginSchema>
}
