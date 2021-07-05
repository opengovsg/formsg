import { ChangeEvent, cloneElement, isValidElement, useRef } from 'react'
import {
  Flex,
  forwardRef,
  RadioProps,
  useMergeRefs,
  useMultiStyleConfig,
} from '@chakra-ui/react'

import { Radio } from './Radio'

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
      <>
        <Radio {...props} ref={mergedRef} />
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
  const style = useMultiStyleConfig('Radio', {}).others

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
