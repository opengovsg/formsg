import {
  Box,
  FormLabel as ChakraFormLabel,
  FormLabelProps as ChakraFormLabelProps,
  Icon,
  Text,
  TextProps,
  Tooltip,
  useFormControlContext,
  VisuallyHidden,
} from '@chakra-ui/react'

import { BxsHelpCircle } from '~assets/icons/BxsHelpCircle'

export interface FormLabelProps extends ChakraFormLabelProps {
  /**
   * Question number to be prefixed before each label, if any.
   */
  questionNumber?: string
  /**
   * Tooltip text to be postfixed at the end of each label, if any.
   */
  tooltipText?: string
  /**
   * Description text to be shown below the label text, if any.
   */
  description?: string
  /**
   * Label text.
   */
  children: string
  /**
   * Whether form label is required. This is optional; if this prop is not
   * provided, the value from it's parent `FormContext` (if any) will be used.
   */
  isRequired?: boolean
}

/**
 * @preconditions Must be a child of Chakra's `FormControl` component.
 * Used to enhance the usability of form controls.
 *
 * It is used to inform users as to what information
 * is requested for a form field.
 *
 * ♿️ Accessibility: Every form field should have a form label.
 */
export const FormLabel = ({
  isRequired,
  tooltipText,
  questionNumber,
  description,
  children,
}: FormLabelProps): JSX.Element => {
  return (
    <FormLabel.Label
      requiredIndicator={<Box />}
      display="flex"
      flexDir="column"
    >
      <Box display="block">
        {questionNumber && (
          <FormLabel.QuestionNumber>{questionNumber}</FormLabel.QuestionNumber>
        )}
        {children}
        <FormLabel.OptionalIndicator isRequired={isRequired} />
        {tooltipText && (
          <Tooltip label={tooltipText} aria-label="Label tooltip">
            <Icon ml="0.5rem" color="secondary.500" as={BxsHelpCircle} />
          </Tooltip>
        )}
      </Box>
      {description && (
        <FormLabel.Description>{description}</FormLabel.Description>
      )}
    </FormLabel.Label>
  )
}

FormLabel.Label = ChakraFormLabel

FormLabel.Description = ({ children, ...props }: TextProps): JSX.Element => {
  return (
    <Text textStyle="body-2" color="secondary.400">
      {children}
    </Text>
  )
}

FormLabel.QuestionNumber = ({ children, ...props }: TextProps): JSX.Element => {
  return (
    <Text
      as="span"
      verticalAlign="top"
      textStyle="caption-1"
      color="secondary.700"
      mr="0.5rem"
      lineHeight="1.5rem"
      {...props}
    >
      <VisuallyHidden>Question number:</VisuallyHidden>
      {children}
    </Text>
  )
}

FormLabel.OptionalIndicator = (
  props: TextProps & { isRequired?: boolean },
): JSX.Element | null => {
  // Valid hook usage since composited component is still a component.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const field = useFormControlContext()

  if (props.isRequired || field?.isRequired) return null

  return (
    <Text
      as="span"
      role="presentation"
      textStyle="body-2"
      ml="0.5rem"
      color="neutral.700"
      {...props}
    >
      (optional)
    </Text>
  )
}
