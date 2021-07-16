import { Document } from 'mongoose'

import {
  CustomFormLogo,
  FormLogoBase,
  FormLogoState,
} from '../../shared/types/form/form_logo'

export { FormLogoState }

export type IFormLogo = FormLogoBase

export type IFormLogoSchema = IFormLogo & Document

export type ICustomFormLogo = CustomFormLogo

export type ICustomFormLogoSchema = ICustomFormLogo & Document
