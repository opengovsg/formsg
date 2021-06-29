import {
  Checkbox as ChakraCheckbox,
  CheckboxProps,
  forwardRef,
} from '@chakra-ui/react'

export const Checkbox = forwardRef<CheckboxProps, 'input'>((props, ref) => {
  return (
    <ChakraCheckbox {...props} ref={ref}>
      {props.value}
    </ChakraCheckbox>
  )
})
