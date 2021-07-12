import { ComponentMultiStyleConfig } from '@chakra-ui/theme'

export const Toast: ComponentMultiStyleConfig = {
  parts: ['container', 'icon', 'close', 'content'],
  baseStyle: {
    icon: {
      position: 'absolute',
      left: '1.125rem',
      top: '1.125rem',
      boxSize: '1.25rem',
    },
    content: {
      // NOTE: This is because the outer container already has padding.
      // So the padding here is icon width + outer padding
      ml: '1.875rem',
    },
    container: {
      borderRadius: '3px',
      boxSizing: 'border-box',
      padding: '1rem',
      // Padding right is 4 rem (normal padding) + width of the button.
      // This is to prevent the button overlapping the text on resize.
      pr: 10,
      mt: 2,
      width: {
        base: 'auto',
        lg: '42.5rem',
      },
      mx: {
        base: 2,
        lg: 'inherit',
      },
    },
    close: {
      right: '1rem',
      top: '1rem',
      position: 'absolute',
      boxSize: '1.5rem',
    },
  },
  variants: {
    danger: {
      container: {
        bg: 'danger.100',
        border: '1px solid var(--chakra-colors-danger-500)',
      },
      icon: {
        fill: 'danger.500',
      },
    },
    success: {
      container: {
        bg: 'success.100',
        border: '1px solid var(--chakra-colors-success-500)',
      },
      icon: {
        fill: 'success.500',
      },
    },
    warning: {
      container: {
        bg: 'warning.100',
        border: '1px solid var(--chakra-colors-warning-500)',
      },
      icon: {
        fill: 'warning.500',
      },
    },
  },
}
