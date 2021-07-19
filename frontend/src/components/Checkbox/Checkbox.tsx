import {
  ChangeEvent,
  Children,
  cloneElement,
  isValidElement,
  ReactNode,
  useRef,
} from 'react'
import { BiCheck } from 'react-icons/bi'
import {
  Box,
  Checkbox as ChakraCheckbox,
  CheckboxProps,
  Flex,
  forwardRef,
  Icon,
  useMergeRefs,
  useMultiStyleConfig,
} from '@chakra-ui/react'

// forward ref to be consistent with chakra's checkbox
export const Checkbox = forwardRef<CheckboxProps, 'input'>((props, ref) => {
  return <ChakraCheckbox ref={ref} {...props} icon={<Icon as={BiCheck} />} />
})

interface CheckboxOthersProps extends CheckboxProps {
  label?: ReactNode
}

export const CheckboxOthers = forwardRef<CheckboxOthersProps, 'input'>(
  ({ children, label, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mergedRef = useMergeRefs(ref, inputRef)
    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }
    Children.toArray(children).forEach((child) => console.log(child))
    return (
      <Box>
        <Checkbox {...props} ref={mergedRef}>
          {label}
        </Checkbox>
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
  children: ReactNode
  onInputChange: () => void
  onClick?: (e: ChangeEvent<HTMLInputElement>) => void
}) => {
  const style = useMultiStyleConfig('Checkbox', {})
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
