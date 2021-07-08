import {
  ChakraTheme,
  ComponentMultiStyleConfig,
  SystemStyleObjectRecord,
  ThemingPropsThunk,
} from '@chakra-ui/react'
import merge from 'lodash/merge'

const variantLine: ThemingPropsThunk<SystemStyleObjectRecord, ChakraTheme> =
  () => {
    return {
      root: {
        w: 'auto',
        p: '1.5rem',
      },
      tablist: {
        overflowX: 'scroll',
        borderColor: 'transparent',
        /* Hide scrollbar for IE and Edge */
        '&::MsOverflowStyle': 'none',
        /* Hide scrollbar for Firefox */
        '&::scrollbarWidth': 'none',
        /* Hide scrollbar for Chrome, Safari and Opera */
        '&::-webkit-scrollbar': {
          display: 'none',
        },
      },
      tabPanel: {
        p: '4px',
      },
      tab: {
        textTransform: 'uppercase',
        p: '0.25rem',
        marginBottom: '0.25rem',
        borderBottom: '0.125rem solid',
        borderColor: 'transparent',
        _focus: {
          boxShadow: 'none',
        },
        _selected: {
          borderColor: 'currentColor',
        },
      },
    }
  }

const variantLight: ThemingPropsThunk<SystemStyleObjectRecord, ChakraTheme> = (
  props,
) => {
  return merge(variantLine(props), {
    root: {
      bg: 'white',
    },
    tab: {
      _hover: {
        color: 'primary.400',
      },
      _selected: {
        color: 'primary.500',
      },
      _active: {
        bg: 'white',
      },
      transitionProperty: 'common',
      color: 'primary.300',
    },
  })
}

const variantDark: ThemingPropsThunk<SystemStyleObjectRecord, ChakraTheme> = (
  props,
) => {
  return merge(variantLine(props), {
    root: {
      bg: 'secondary.500',
    },
    tab: {
      _active: {
        bg: 'secondary.500',
      },
      _hover: {
        color: 'secondary.200',
      },
      _selected: {
        color: 'white',
      },
      transitionProperty: 'common',
      color: 'secondary.300',
    },
  })
}

export const Tabs: ComponentMultiStyleConfig = {
  parts: [],
  baseStyle: {
    tab: {
      mr: '15%',
      px: '4%',
    },
  },
  sizes: {
    md: {
      tab: {
        textStyle: 'subhead-3',
        p: '0rem',
      },
    },
  },
  variants: {
    // Chakra UI already has a line variant, these are our custom variants
    'line-light': variantLight,
    'line-dark': variantDark,
  },
  defaultProps: {
    colorScheme: 'primary',
  },
}
