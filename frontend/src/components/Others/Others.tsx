import { ChangeEvent, cloneElement, isValidElement, useRef } from 'react'
import {
  CheckboxProps,
  Flex,
  forwardRef,
  RadioProps,
  useMergeRefs,
} from '@chakra-ui/react'
import { createContext } from '@chakra-ui/react-utils'

import Checkbox from '~components/Checkbox'
import Radio from '~components/Radio'

type OthersProps = (CheckboxProps | RadioProps) & {
  base: string
}

const [OthersProvider, useOthersContext] = createContext<{
  onInputChange: () => void
}>({
  name: 'OthersContext',
  strict: false,
})

export const Others = forwardRef<OthersProps, 'input'>(
  ({ children, base, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const mergedRef = useMergeRefs(ref, inputRef)

    const handleInputChange = () => {
      if (!inputRef?.current?.checked) {
        inputRef?.current?.click()
      }
    }

    return (
      <OthersProvider value={{ onInputChange: handleInputChange }}>
        {getBaseComponent({ base, mergedRef, ...props })}
        <OthersWrapper>{children}</OthersWrapper>
      </OthersProvider>
    )
  },
)

const getBaseComponent = ({
  base,
  mergedRef,
  ...props
}: {
  mergedRef: ((node: unknown) => void) | null
} & OthersProps): JSX.Element | null => {
  switch (base) {
    case 'checkbox':
      return <Checkbox {...(props as CheckboxProps)} ref={mergedRef} />
    case 'radio':
      return <Radio {...(props as RadioProps)} ref={mergedRef} />
    default:
      return null
  }
}

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
