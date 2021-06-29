import { ChangeEvent, cloneElement, isValidElement, useRef } from 'react'
import { Flex, forwardRef, RadioProps, useMergeRefs } from '@chakra-ui/react'
import { createContext } from '@chakra-ui/react-utils'

import { Radio } from './Radio'

const [OthersProvider, useOthersContext] = createContext<{
  onInputChange: () => void
}>({
  name: 'OthersContext',
  strict: false,
})

export const RadioOthers = forwardRef<RadioProps, 'input'>(
  ({ children, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mergedRef = useMergeRefs(ref, inputRef)

    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }

    return (
      <OthersProvider value={{ onInputChange: handleInputChange }}>
        <Radio {...props} ref={mergedRef} />
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
