import { ChangeEvent, cloneElement, isValidElement, useRef } from 'react'
import {
  Checkbox,
  CheckboxProps,
  Flex,
  forwardRef,
  useMergeRefs,
  useMultiStyleConfig,
} from '@chakra-ui/react'

interface CheckboxOthersProps extends CheckboxProps {
  displayValue: string
}

export const CheckboxOthers = forwardRef<CheckboxOthersProps, 'input'>(
  ({ children, displayValue, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mergedRef = useMergeRefs(ref, inputRef)

    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }

    return (
      <>
        <Checkbox {...props} ref={mergedRef}>
          {displayValue}
        </Checkbox>
        <OthersWrapper onInputChange={handleInputChange}>
          {children}
        </OthersWrapper>
      </>
    )
  },
)

const OthersWrapper = ({
  children,
  onInputChange,
  onClick,
}: {
  children: React.ReactNode
  onInputChange: () => void
  onClick?: (e: ChangeEvent<HTMLInputElement>) => void
}) => {
  const style = useMultiStyleConfig('Checkbox', {}).others

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onInputChange()
    onClick?.(e)
  }
  return (
    <Flex __css={style}>
      {isValidElement(children) &&
        cloneElement(children, {
          onClick: handleInputChange,
        })}
    </Flex>
  )
}
