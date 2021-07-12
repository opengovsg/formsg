import { YESNO_THEME_KEY, YesNoField } from './Field/YesNo'
import { Banner } from './Banner'
import { Button } from './Button'
import { Form } from './Form'
import { FormError } from './FormError'
import { FormLabel } from './FormLabel'
import { Input } from './Input'
import { Link } from './Link'
import { PhoneNumberInput } from './PhoneNumberInput'
import { Textarea } from './Textarea'
import { Toast } from './Toast'

export const components = {
  Button,
  Input,
  Textarea,
  PhoneNumberInput,
  Form,
  Link,
  FormError,
  FormLabel,
  [YESNO_THEME_KEY]: YesNoField,
  Banner,
  Toast,
}
