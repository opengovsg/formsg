import {
  ChakraTheme,
  ComponentStyleConfig,
  CSSObject,
  SystemStyleObject,
  ThemingPropsThunk,
} from '@chakra-ui/react'

export type ThemeButtonVariant = 'solid' | 'reverse' | 'outline' | 'clear'

const variantSolid: ThemingPropsThunk<CSSObject, ChakraTheme> = (props) => {
  const { colorScheme: c } = props
  let bg = `${c}.500`
  let activeBg = `${c}.700`
  let hoverBg = `${c}.600`
  let focusBoxShadow = `0 0 0 4px var(--chakra-colors-${c}-300)`

  if (c === 'success') {
    bg = `${c}.700`
    activeBg = `${c}.800`
    hoverBg = `${c}.800`
    focusBoxShadow = `0 0 0 4px var(--chakra-colors-${c}-400)`
  }

  return {
    bg,
    borderColor: bg,
    color: 'white',
    _active: {
      bg: activeBg,
      borderColor: activeBg,
      _disabled: {
        bg: `${c}.300`,
        borderColor: `${c}.300`,
      },
    },
    _focus: {
      borderColor: 'transparent',
      boxShadow: focusBoxShadow,
    },
    _disabled: {
      bg: `${c}.300`,
      borderColor: `${c}.300`,
      opacity: 1,
    },
    _hover: {
      bg: hoverBg,
      borderColor: hoverBg,
      _disabled: {
        bg: `${c}.300`,
        borderColor: `${c}.300`,
      },
    },
  }
}

const variantClear: ThemingPropsThunk<CSSObject, ChakraTheme> = (props) => {
  const { colorScheme: c } = props

  return {
    bg: 'transparent',
    borderColor: 'transparent',
    color: `${c}.500`,
    _focus: {
      boxShadow: `0 0 0 4px var(--chakra-colors-${c}-300)`,
    },
    _disabled: {
      color: `${c}.300`,
      opacity: 1,
    },
    _active: {
      bg: `${c}.200`,
      _disabled: {
        bg: 'transparent',
      },
    },
    _hover: {
      bg: `${c}.100`,
      _disabled: {
        bg: 'transparent',
      },
    },
  }
}

const variantOutlineReverse: ThemingPropsThunk<CSSObject, ChakraTheme> = (
  props,
) => {
  const { colorScheme: c, variant } = props
  const showBorder = variant === 'outline'

  return {
    bg: 'white',
    borderColor: showBorder ? `${c}.500` : 'white',
    color: `${c}.500`,
    _focus: {
      boxShadow: `0 0 0 4px var(--chakra-colors-${c}-300)`,
    },
    _disabled: {
      color: `${c}.300`,
      borderColor: showBorder ? `${c}.300` : 'white',
      bg: 'white',
      opacity: 1,
    },
    _active: {
      bg: `${c}.200`,
      borderColor: showBorder ? `${c}.500` : `${c}.200`,
      _disabled: {
        bg: 'white',
        borderColor: showBorder ? `${c}.300` : 'white',
      },
    },
    _hover: {
      bg: `${c}.100`,
      borderColor: showBorder ? `${c}.500` : `${c}.100`,
      _disabled: {
        bg: 'white',
        borderColor: showBorder ? `${c}.300` : 'white',
      },
    },
  }
}

export const Button: ComponentStyleConfig = {
  baseStyle: {
    borderRadius: '0.25rem',
    border: '1px solid',
    textStyle: 'subhead-1',
    fontWeight: 'medium',
    h: 'auto',
    // -1px for border
    px: '15px',
    py: '9px',
  },
  sizes: {
    md: {
      h: 'auto',
      minH: '2.75rem',
      minW: '2.75rem',
    },
    lg: {
      h: 'auto',
      minH: '3rem',
      minW: '3rem',
    },
  },
  variants: {
    solid: variantSolid,
    reverse: variantOutlineReverse,
    outline: variantOutlineReverse,
    clear: variantClear,
  } as Record<ThemeButtonVariant, ThemingPropsThunk<SystemStyleObject>>,
  defaultProps: {
    variant: 'solid',
    colorScheme: 'primary',
    size: 'md',
  },
}
