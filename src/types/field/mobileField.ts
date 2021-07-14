import { IField, IFieldSchema } from './baseField'

export interface IMobileField extends IField {
  allowIntlNumbers: boolean
  isVerifiable: boolean
}

export interface IVerifiableMobileField extends IMobileField {
  isVerifiable: true
}

export interface IMobileFieldSchema extends IMobileField, IFieldSchema {
  isVerifiable: boolean
}
