import { ComponentStyleConfig } from '@chakra-ui/react'
import { getColor } from '@chakra-ui/theme-tools'

export const Checkbox: ComponentStyleConfig = {
  parts: ['others'],
  baseStyle: ({ theme }) => ({
    control: {
      borderRadius: '0.25rem',
      border: '0.125rem solid',
      borderColor: 'primary.500',
      _checked: {
        bg: 'primary.500',
        borderColor: 'primary.500',
        _hover: {
          bg: 'primary.500',
          borderColor: 'primary.500',
        },
        _disabled: {
          borderColor: 'neutral.500',
          bg: 'white',
          color: 'white',
          cursor: 'default',
        },
      },
      _focus: {
        boxShadow: 'none',
      },
      _disabled: {
        borderColor: 'neutral.500',
        bg: 'white',
        cursor: 'default',
      },
    },
    label: {
      textColor: 'secondary.700',
      ml: '1rem',
      textStyle: 'body-1',
      _disabled: {
        color: 'neutral.500',
        opacity: '1',
        cursor: 'default',
      },
    },
    container: {
      w: '100%',
      px: '0.25rem',
      py: '0.5rem',
      _hover: {
        bg: 'primary.100',
        _disabled: {
          cursor: 'default',
        },
      },
      _focusWithin: {
        boxShadow: `inset 0 0 0 0.125rem ${getColor(theme, 'primary.500')}`,
      },
    },
    others: {
      pl: '3rem',
    },
  }),
  sizes: {
    // override md size, which is the default size
    md: {
      control: { w: '1.5rem', h: '1.5rem' },
      icon: { fontSize: '1rem' },
      container: { h: '2.75rem' },
    },
  },
}
