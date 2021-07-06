import { ComponentStyleConfig } from '@chakra-ui/theme'

export const Link: ComponentStyleConfig = {
  baseStyle: {
    position: 'relative',
    color: 'primary.500',
    borderRadius: '0.25rem',
    _hover: {
      color: 'primary.600',
    },
    _disabled: {
      color: 'primary.300',
      cursor: 'not-allowed',
    },
    _focus: {
      boxShadow: '0 0 0 2px var(--chakra-colors-primary-500)',
    },
  },
  variants: {
    inline: {
      textDecorationLine: 'underline',
      textUnderlineOffset: '0.125rem',
    },
    standalone: {
      p: '0.25rem',
      _hover: {
        textDecorationLine: 'underline',
        textUnderlineOffset: '0.125rem',
      },
    },
  },
  defaultProps: {
    variant: 'inline',
  },
}
