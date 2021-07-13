export enum FormLogoState {
  Default = 'DEFAULT',
  None = 'NONE',
  Custom = 'CUSTOM',
}

interface FormLogoBase {
  state: FormLogoState
}

interface CustomFormLogo extends FormLogoBase {
  state: FormLogoState.Custom
  fileId: string
  fileName: string
  fileSizeInBytes: number
}

interface NoFormLogo extends FormLogoBase {
  state: FormLogoState.None
}

interface DefaultFormLogo extends FormLogoBase {
  state: FormLogoState.Default
}

export type FormLogo = CustomFormLogo | NoFormLogo | DefaultFormLogo
