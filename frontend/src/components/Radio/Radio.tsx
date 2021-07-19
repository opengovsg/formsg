import {
  ChangeEvent,
  cloneElement,
  isValidElement,
  ReactNode,
  useRef,
} from 'react'
import {
  Box,
  Flex,
  forwardRef,
  Radio as ChakraRadio,
  RadioProps,
  useMergeRefs,
  useMultiStyleConfig,
} from '@chakra-ui/react'

export const Radio = ChakraRadio

interface RadioOthersProps extends RadioProps {
  label?: ReactNode
}

export const RadioOthers = forwardRef<RadioOthersProps, 'input'>(
  ({ children, label, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mergedRef = useMergeRefs(ref, inputRef)

    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }

    return (
      <Box>
        <Radio {...props} ref={mergedRef}>
          {label}
        </Radio>
        <OthersWrapper onInputChange={handleInputChange}>
          {children}
        </OthersWrapper>
      </Box>
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
  const style = useMultiStyleConfig('Radio', {})

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onInputChange()
    onClick?.(e)
  }

  return (
    <Flex __css={style.others}>
      {isValidElement(children) &&
        cloneElement(children, {
          onClick: handleInputChange,
        })}
    </Flex>
  )
}
