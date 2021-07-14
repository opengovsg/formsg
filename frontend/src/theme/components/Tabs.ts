import {
  ChakraTheme,
  ComponentMultiStyleConfig,
  SystemStyleObjectRecord,
  ThemingPropsThunk,
} from '@chakra-ui/react'
import { getColor } from '@chakra-ui/theme-tools'
import merge from 'lodash/merge'

export const DRAG_SCROLL_SPEED = 0.9
export const SCROLL_TO_VIEW_OPTIONS = {
  inline: 'center',
} as ScrollIntoViewOptions

const variantLine: ThemingPropsThunk<SystemStyleObjectRecord, ChakraTheme> =
  () => {
    return {
      root: {
        w: '100%',
      },
      tablist: {
        w: '100%',
        overflowX: 'auto',
        borderColor: 'transparent',
        /* Hide scrollbar for IE and Edge */
        '&::MsOverflowStyle': 'none',
        /* Hide scrollbar for Firefox */
        '&::scrollbarWidth': 'none',
        /* Hide scrollbar for Chrome, Safari and Opera */
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        pt: '1.5rem',
        pb: '1.375rem',
        whiteSpace: 'nowrap',
      },
      tab: {
        textStyle: 'subhead-3',
        textTransform: 'uppercase',
        p: '0.25rem 0', // No horizontal padding to let bottom border be the same length as text
        borderColor: 'transparent',
        mx: '1rem',
        //  margins to ensure text remains at the same position as selected tabs
        mb: '0.125rem',
        borderBottom: '0',
        _selected: {
          mb: '0',
          borderBottom: '0.125rem solid',
          transition: 'common common ease-out',
          _focus: {
            // add horizontal padding
            p: '0.25rem',
            ml: '0.75rem',
            mr: '0.75rem',
            borderRadius: '0.25rem',
            //  margins to ensure text remains at the same position as selected tabs
            mb: '0.125rem',
            borderBottom: '0',
          },
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
        _focus: {
          boxShadow: `0 0 0 2px ${getColor(props.theme, 'primary.500')}`,
        },
      },
      _active: {
        bg: 'white',
      },
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
        _focus: {
          boxShadow: '0 0 0 2px white',
        },
      },
      color: 'secondary.300',
    },
  })
}

export const Tabs: ComponentMultiStyleConfig = {
  parts: [],
  baseStyle: {
    tab: {
      mr: '2rem',
    },
  },
  sizes: {
    md: {
      tab: {
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
