export enum BasicField {
  Section = 'section',
  Statement = 'statement',
  Email = 'email',
  Mobile = 'mobile',
  HomeNo = 'homeno',
  Number = 'number',
  Decimal = 'decimal',
  Image = 'image',
  ShortText = 'textfield',
  LongText = 'textarea',
  Dropdown = 'dropdown',
  YesNo = 'yes_no',
  Checkbox = 'checkbox',
  Radio = 'radiobutton',
  Attachment = 'attachment',
  Date = 'date',
  Rating = 'rating',
  Nric = 'nric',
  Table = 'table',
  Uen = 'uen',
}

export enum MyInfoAttribute {
  Name = 'name',
  PassportNumber = 'passportnumber',
  RegisteredAddress = 'regadd',
  Employment = 'employment',
  VehicleNo = 'vehno',
  MarriageCertNo = 'marriagecertno',
  Sex = 'sex',
  Race = 'race',
  Dialect = 'dialect',
  Nationality = 'nationality',
  BirthCountry = 'birthcountry',
  ResidentialStatus = 'residentialstatus',
  HousingType = 'housingtype',
  HdbType = 'hdbtype',
  Marital = 'marital',
  CountryOfMarriage = 'countryofmarriage',
  WorkpassStatus = 'workpassstatus',
  Occupation = 'occupation',
  MobileNo = 'mobileno',
  DateOfBirth = 'dob',
  PassportExpiryDate = 'passportexpirydate',
  MarriageDate = 'marriagedate',
  DivorceDate = 'divorcedate',
  WorkpassExpiryDate = 'workpassexpirydate',
}

export type AllowMyInfoBase = {
  myInfo?: {
    attr: MyInfoAttribute
  }
}
export type VerifiableFieldBase = {
  isVerifiable: boolean
}

export type FieldBase = {
  globalId?: string
  title: string
  description: string
  required: boolean
  disabled: boolean
  fieldType: BasicField
}

export type MyInfoableFieldBase = FieldBase & AllowMyInfoBase
