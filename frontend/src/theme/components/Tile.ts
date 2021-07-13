import { ComponentMultiStyleConfig } from '@chakra-ui/theme'

export const Tile: ComponentMultiStyleConfig = {
  parts: ['container', 'title', 'icon', 'subtitle'],
  baseStyle: {
    container: {
      width: 'fit-content',
      borderRadius: '0.25rem',
      padding: '1.5rem',
      _active: {
        bgColor: 'primary.200',
        border: '3px solid var(--chakra-colors-primary-500)',
      },
      _hover: {
        bgColor: 'primary.100',
        border: '1px solid var(--chakra-colors-neutral-300)',
      },
      _focus: {
        bgColor: 'white',
        border: '2px solid var(--chakra-colors-primary-500)',
      },
      bgColor: 'white',
      border: '1px solid var(--chakra-colors-neutral-300)',
    },
    title: {
      color: 'secondary.700',
      textStyle: 'h4',
    },
    icon: {
      boxSize: '2.5rem',
    },
    subtitle: {
      color: 'secondary.500',
      textStyle: 'body-2',
    },
  },
  variants: {
    simple: {
      title: {
        mb: '0.5rem',
      },
    },
  },
}
