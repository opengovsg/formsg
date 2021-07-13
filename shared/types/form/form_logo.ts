export enum FormLogoState {
  Default = 'DEFAULT',
  None = 'NONE',
  Custom = 'CUSTOM',
}

export interface FormLogoBase {
  state: FormLogoState
}

export interface CustomFormLogo extends FormLogoBase {
  state: FormLogoState.Custom
  fileId: string
  fileName: string
  fileSizeInBytes: number
}

export interface NoFormLogo extends FormLogoBase {
  state: FormLogoState.None
}

export interface DefaultFormLogo extends FormLogoBase {
  state: FormLogoState.Default
}

export type FormLogo = CustomFormLogo | NoFormLogo | DefaultFormLogo
