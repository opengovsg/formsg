import { ComponentStyleConfig } from '@chakra-ui/react'
import { getColor } from '@chakra-ui/theme-tools'

export const Radio: ComponentStyleConfig = {
  parts: ['others'],
  baseStyle: ({ theme }) => ({
    control: {
      border: '0.125rem solid',
      borderColor: 'primary.500',
      _checked: {
        borderColor: 'primary.500',
        bg: 'white',
        color: 'primary.500',
        _before: {
          w: '80%',
          h: '80%',
        },
        _hover: {
          bg: 'white',
          borderColor: 'primary.500',
        },
        _disabled: {
          borderColor: 'neutral.500',
          bg: 'white',
          color: 'neutral.500',
          cursor: 'default',
        },
      },
      _focus: {
        boxShadow: 'none',
        _hover: {
          bg: 'white',
          borderColor: 'primary.500',
        },
      },
      _invalid: {
        borderColor: 'primary.500',
      },
      _disabled: {
        borderColor: 'neutral.500',
        bg: 'white',
        cursor: 'default',
      },
    },
    label: {
      w: '100%',
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
        cursor: 'pointer',
      },
      _focusWithin: {
        borderColor: 'primary.500',
        boxShadow: `inset 0 0 0 0.125rem ${getColor(theme, 'primary.500')}`,
      },
      _disabled: {
        cursor: 'default',
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
