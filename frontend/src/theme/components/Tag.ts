import { ComponentMultiStyleConfig } from '@chakra-ui/theme'

export const Tag: ComponentMultiStyleConfig = {
  parts: [],
  variants: {
    primary: {
      container: {
        textColor: 'secondary.700',
        bgColor: 'success.400',
      },
    },
    secondary: {
      container: {
        bgColor: 'primary.100',
        textColor: 'primary.400',
      },
    },
  },
  defaultProps: {
    variant: 'primary',
  },
}
