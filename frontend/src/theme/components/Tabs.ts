import {
  ChakraTheme,
  ComponentMultiStyleConfig,
  SystemStyleObjectRecord,
  ThemingPropsThunk,
} from '@chakra-ui/react'
import { merge } from 'lodash'

const variantLine: ThemingPropsThunk<SystemStyleObjectRecord, ChakraTheme> = (
  props,
) => {
  const { orientation } = props
  const isVertical = orientation === 'vertical'
  const marginProp = isVertical ? 'marginStart' : 'marginBottom'
  return {
    root: {
      w: 'auto',
      p: '24px',
      mx: '-16px', // ignore parent padding and extend full width of screen
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
      textTransform: 'capitalise',
      p: '4px',
      [marginProp]: '4px',
      _focus: {
        boxShadow: 'none',
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
      mr: '6%',
      px: '3%',
    },
  },
  sizes: {
    md: {
      tab: {
        textStyle: 'subhead-3',
        p: '0px',
      },
    },
  },
  variants: {
    line: variantLight,
    enclosed: variantDark,
  },
  defaultProps: {
    colorScheme: 'primary',
  },
}
