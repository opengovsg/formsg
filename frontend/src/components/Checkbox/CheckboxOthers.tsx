import React, { ChangeEvent, cloneElement, isValidElement, useRef } from 'react'
import { CheckboxProps, Flex, forwardRef, useMergeRefs } from '@chakra-ui/react'
import { createContext } from '@chakra-ui/react-utils'

import { Checkbox } from './Checkbox'

const [OthersProvider, useOthersContext] = createContext<{
  onInputChange: () => void
}>({
  name: 'CheckboxOtherContext',
  strict: false,
})

export const CheckboxOthers = forwardRef<CheckboxProps, 'input'>(
  ({ children, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const checkboxRef = useMergeRefs(ref, inputRef)

    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }

    return (
      <OthersProvider value={{ onInputChange: handleInputChange }}>
        <Checkbox {...props} ref={checkboxRef} />
        <OthersWrapper>{children}</OthersWrapper>
      </OthersProvider>
    )
  },
)

const OthersWrapper = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: (e: ChangeEvent<HTMLInputElement>) => void
}) => {
  const { onInputChange } = useOthersContext()

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onInputChange()
    onClick?.(e)
  }

  return (
    <Flex pl="48px" mt="2px">
      {isValidElement(children) &&
        cloneElement(children, {
          onClick: handleInputChange,
        })}
    </Flex>
  )
}
