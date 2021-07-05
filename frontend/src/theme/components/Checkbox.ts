import { ComponentStyleConfig } from '@chakra-ui/react'
import { getColor } from '@chakra-ui/theme-tools'

export const Checkbox: ComponentStyleConfig = {
  parts: ['others'],
  baseStyle: ({ theme }) => ({
    control: {
      borderRadius: '0.19rem',
      border: '2px solid',
      borderColor: 'primary.500',
      _checked: {
        bg: 'primary.500',
        borderColor: 'primary.500',
        _hover: {
          bg: 'primary.500',
          borderColor: 'primary.500',
        },
      },
      _focus: {
        boxShadow: 'none',
      },
    },
    label: {
      textColor: 'secondary.700',
      mx: '1rem',
    },
    container: {
      h: '44px',
      w: '100%',
      px: '0.25rem',
      py: '0.5rem',
      _hover: {
        bg: 'primary.100',
      },
      _focusWithin: {
        borderColor: 'primary.500',
        boxShadow: `0 0 0 2px ${getColor(theme, 'primary.500')}`,
      },
    },
    others: {
      pl: '48px',
      mt: '2px',
    },
  }),
  sizes: {
    // override md size, which is the default size
    md: {
      control: { w: '1.5rem', h: '1.5rem' },
      label: { textStyle: 'body-1' },
      icon: { fontSize: '0.75rem' },
    },
  },
}
