import { ComponentStyleConfig } from '@chakra-ui/react'
import { getColor } from '@chakra-ui/theme-tools'

export const Radio: ComponentStyleConfig = {
  parts: ['row', 'others'],
  baseStyle: (props) => ({
    control: {
      border: '2px solid',
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
      },
      _focus: {
        boxShadow: 'none',
        _hover: {
          bg: 'white',
          borderColor: 'primary.500',
        },
      },
    },
    label: {
      textColor: 'secondary.700',
      mx: '1rem',
    },
    container: {
      h: '44px',
      px: '0.25rem',
      py: '0.5rem',
      _hover: {
        bg: 'primary.100',
        cursor: 'pointer',
      },
      _focusWithin: {
        borderColor: 'primary.500',
        boxShadow: `0 0 0 2px ${getColor(props.theme, 'primary.500')}`,
      },
    },
    others: {
      alignSelf: 'flex-end',
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
