import { ComponentMultiStyleConfig } from '@chakra-ui/theme'

const activeContainerStyle = {
  bgColor: 'primary.200',
  borderColor: 'transparent',
  // NOTE: For the boxShadow styling, due to conflicts with the focus-visible package,
  // the !important is required to display the boxShadow styling correctly.
  boxShadow: '0 0 0 3px var(--chakra-colors-primary-500) !important',
}

const baseContainerStyle = {
  color: 'inherit',
  borderRadius: '0.25rem',
  padding: '1.5rem',
  _active: activeContainerStyle,
  _hover: {
    bgColor: 'primary.100',
  },
  _focus: {
    bgColor: 'white',
    borderColor: 'transparent',
    // NOTE: For the boxShadow styling, due to conflicts with the focus-visible package,
    // the !important is required to display the boxShadow styling correctly.
    boxShadow: '0 0 0 2px var(--chakra-colors-primary-500) !important',
  },
  bgColor: 'white',
  border: '1px solid',
  borderColor: 'neutral.300',
  flexDir: 'column',
  alignItems: 'flex-start',
}

export const Tile: ComponentMultiStyleConfig = {
  parts: ['container', 'title', 'icon', 'subtitle'],
  baseStyle: ({ isActive }) => ({
    container: isActive
      ? { ...baseContainerStyle, ...activeContainerStyle }
      : baseContainerStyle,
    title: {
      color: 'secondary.700',
      textStyle: 'h4',
      mt: '1rem',
    },
    icon: {
      boxSize: '2.5rem',
    },
    subtitle: {
      color: 'secondary.500',
      textStyle: 'body-2',
    },
  }),
  variants: {
    complex: {
      title: {
        mb: 0,
      },
      subtitle: {
        mb: '1rem',
      },
    },
    simple: {
      title: { mb: '1rem' },
    },
  },
}
