import { ChangeEvent, cloneElement, useRef } from 'react'
import {
  Box,
  Checkbox,
  CheckboxProps,
  forwardRef,
  useMergeRefs,
} from '@chakra-ui/react'
import { createContext } from '@chakra-ui/react-utils'

const [CheckboxOtherProvider, useCheckboxOtherContext] = createContext<{
  onInputChange: any
}>({
  name: 'CheckboxOtherContext',
  strict: false,
})

export { useCheckboxOtherContext }

// Would preferably call this Checkbox.Other so it is obvious where it is, but lazy.
export const Checkbox2Other = forwardRef<CheckboxProps, 'input'>(
  ({ children, ...props }, ref) => {
    const innerCheckboxRef = useRef<HTMLInputElement | null>(null)
    const checkboxRef = useMergeRefs(ref, innerCheckboxRef)

    const handleOthersInputChange = () => {
      if (!innerCheckboxRef?.current?.checked) {
        innerCheckboxRef?.current?.click()
      }
    }

    return (
      <CheckboxOtherProvider value={{ onInputChange: handleOthersInputChange }}>
        <Checkbox {...props} ref={checkboxRef} />
        <OtherWrapper>{children}</OtherWrapper>
      </CheckboxOtherProvider>
    )
  },
)

const OtherWrapper = (props: any) => {
  const { onInputChange } = useCheckboxOtherContext()

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onInputChange()
    props?.onChange?.(e)
  }

  const clonedElement = cloneElement(props.children, {
    onChange: handleInputChange,
  })

  // Add some styling margins here, this is placeholder padding, check design.
  return <Box pl="2rem">{clonedElement}</Box>
}
