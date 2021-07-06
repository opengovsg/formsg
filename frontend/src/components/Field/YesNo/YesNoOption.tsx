import { KeyboardEvent, useCallback } from 'react'
import {
  Box,
  forwardRef,
  useMultiStyleConfig,
  useRadio,
  UseRadioGroupReturn,
  UseRadioProps,
  VisuallyHidden,
} from '@chakra-ui/react'

import { YESNO_THEME_KEY } from '~theme/components/Field/YesNo'
import { FieldColorScheme } from '~theme/foundations/colours'

interface YesNoOptionProps extends UseRadioProps {
  children: React.ReactNode

  /**
   * Side of the option for styling to be used for styling.
   */
  side: 'left' | 'right'

  /**
   * Color scheme of the component to render. Defaults to `primary`.
   */
  colorScheme?: FieldColorScheme

  /**
   * Callback to be invoked when selection changes.
   * @note Overridden to allow onChange with both a value or event argument
   * instead of the default event-only argument.
   */
  onChange?: UseRadioGroupReturn['onChange']
}

/**
 * Option rendering for `YesNo` component.
 */
export const YesNoOption = forwardRef<YesNoOptionProps, 'input'>(
  ({ children, ...props }, ref) => {
    const styles = useMultiStyleConfig(YESNO_THEME_KEY, props)

    const { getInputProps, getCheckboxProps } = useRadio({
      ...props,
    })
    // Empty object needed here as ref is the second argument,
    // and ref is required so that any refs passed in gets forwarded.
    const inputProps = getInputProps(undefined, ref)
    const checkboxProps = getCheckboxProps()

    const handleSelect = useCallback(() => {
      if (props.isChecked) {
        /**
         * onChange prop is meant to be called when the current value of the
         * checkbox group is updated.
         * Here onChange is being called to reset the current checkbox value by
         * setting the current value to an empty value if the current checkbox
         * is already checked, effectively allowing toggling of the checkbox.
         */
        props.onChange?.('')
      }
    }, [props])

    const handleSpacebar = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== ' ') return
        if (props.isChecked) {
          e.preventDefault()
          handleSelect()
        }
      },
      [handleSelect, props.isChecked],
    )

    return (
      <Box as="label" __css={styles.container}>
        <input
          {...inputProps}
          onClick={handleSelect}
          onKeyDown={handleSpacebar}
        />
        <VisuallyHidden>
          "{children}" option {props.isChecked ? 'selected' : 'unselected'}
        </VisuallyHidden>
        <Box {...checkboxProps} __css={styles.option}>
          {children}
        </Box>
      </Box>
    )
  },
)
