import { useRef } from 'react'
import { BiMinus, BiPlus } from 'react-icons/bi'
import {
  Box,
  chakra,
  Divider,
  forwardRef,
  NumberInputProps as ChakraNumberInputProps,
  useFormControlProps,
  useMultiStyleConfig,
  useNumberInput,
} from '@chakra-ui/react'

import IconButton from '../IconButton'

export interface NumberInputProps extends ChakraNumberInputProps {
  /**
   * Whether the input is in a prefilled state.
   */
  isPrefilled?: boolean
  /**
   * Whether the input is in a success state.
   */
  isSuccess?: boolean
  /**
   * Whether to show the increment and decrement steppers. Defaults to true.
   */
  showSteppers?: boolean
}

export const NumberInput = forwardRef<NumberInputProps, 'div'>(
  (
    {
      showSteppers = true,
      clampValueOnBlur = false,
      isSuccess,
      isPrefilled,
      ...props
    },
    ref,
  ) => {
    const styles = useMultiStyleConfig('NumberInput', {
      ...props,
      isSuccess,
      isPrefilled,
    })

    const stepperWrapperRef = useRef<HTMLDivElement | null>(null)

    /**
     * Used here so this component can retrieve a parent FormControl's props, if
     * any. This allows a FormControl parent component to pass props such as
     * isInvalid, isDisabled, etc, to this component.
     */
    const controlProps = useFormControlProps(props)
    const {
      htmlProps,
      getInputProps,
      getIncrementButtonProps,
      getDecrementButtonProps,
    } = useNumberInput({ ...controlProps, clampValueOnBlur })

    const inputProps = getInputProps({ placeholder: props.placeholder })
    const incProps = getIncrementButtonProps()
    const decProps = getDecrementButtonProps()

    const inputEndPadding = showSteppers
      ? stepperWrapperRef.current?.offsetWidth
      : undefined

    return (
      <Box {...htmlProps} ref={ref} __css={styles.root}>
        {/* Using base input wrapper instead of `Input` component as the Input 
        component strips out some props such as `aria-invalid`, resulting in
        incorrect styling */}
        <chakra.input
          {...inputProps}
          paddingInlineEnd={inputEndPadding}
          __css={styles.field}
        />
        {showSteppers && (
          <Box __css={styles.stepperWrapper} ref={stepperWrapperRef}>
            <IconButton
              sx={styles.stepperButton}
              aria-hidden
              aria-label="Decrement number"
              variant="clear"
              icon={<BiMinus />}
              {...decProps}
            />
            <Divider __css={styles.stepperDivider} orientation="vertical" />
            <IconButton
              sx={styles.stepperButton}
              aria-hidden
              aria-label="Increment number"
              variant="clear"
              icon={<BiPlus />}
              {...incProps}
            />
          </Box>
        )}
      </Box>
    )
  },
)
