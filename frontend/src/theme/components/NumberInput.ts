import { ComponentMultiStyleConfig } from '@chakra-ui/theme'

import { Input } from './Input'

const parts = [
  'root',
  'field',
  'stepperButton',
  'stepperWrapper',
  'stepperDivider',
]

const baseStyleRoot = {
  position: 'relative',
  zIndex: 0,
}

export const NumberInput: ComponentMultiStyleConfig = {
  parts,
  baseStyle: {
    root: baseStyleRoot,
    stepperWrapper: {
      zIndex: 1,
      h: '2.75rem',
      d: 'flex',
      alignItems: 'center',
      pos: 'absolute',
      right: 0,
      top: 0,
      border: '1px solid transparent',
    },
    stepperButton: {
      color: 'secondary.500',
      borderRadius: 0,
      minH: '100%',
      _disabled: {
        color: 'neutral.500',
        cursor: 'not-allowed',
      },
    },
    stepperDivider: {
      h: '1.25rem',
      borderColor: 'neutral.300',
    },
  },
  sizes: {
    md: {
      stepper: {
        fontSize: '1rem',
      },
      field: Input.sizes.md.field,
      stepperButton: {
        _last: {
          borderRightRadius: Input.sizes.md.field.borderRadius,
        },
      },
    },
  },
  variants: {
    ...Input.variants,
    outline: (props: Record<string, any>) => {
      const inputOutlineStyles = Input.variants.outline(props)

      return {
        ...inputOutlineStyles,
        field: {
          ...inputOutlineStyles.field,
        },
      }
    },
  },
  defaultProps: Input.defaultProps,
}
