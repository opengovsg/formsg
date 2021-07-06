import { YESNO_THEME_KEY, YesNoField } from './Field/YesNo'
import { Button } from './Button'
import { Form } from './Form'
import { FormError } from './FormError'
import { FormLabel } from './FormLabel'
import { Input } from './Input'
import { Tabs } from './Tabs'
import { Link } from './Link'

export const components = {
  Button,
  Input,
  Form,
  Link,
  FormError,
  FormLabel,
  Tabs,
  [YESNO_THEME_KEY]: YesNoField,
}