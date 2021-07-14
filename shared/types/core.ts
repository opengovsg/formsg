export interface ErrorDto {
  message: string
}

export interface PrivateFormErrorDto extends ErrorDto {
  isPageFound: true
  formTitle: string
}
