import { ComponentMultiStyleConfig } from '@chakra-ui/theme'
import { getColor } from '@chakra-ui/theme-tools'

export const YESNO_THEME_KEY = 'YesNoField'

const parts = ['option', 'container', 'icon']

const outlineOptionStyle = (props: Record<string, any>) => {
  const { colorScheme: c = 'primary', theme, side } = props

  const isLighterTheme = ['theme-yellow', 'theme-orange', 'theme-red'].includes(
    c,
  )

  // Change colors according to colorScheme.
  const activeBorderColor = isLighterTheme ? `${c}.600` : `${c}.500`

  return {
    display: 'flex',
    borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0',
    transitionProperty: 'common',
    transitionDuration: 'normal',
    alignItems: 'center',
    cursor: 'pointer',
    textStyle: 'subhead-1',
    justifyContent: 'center',
    color: 'secondary.700',
    bg: 'neutral.100',
    border: '1px solid',
    borderColor: 'neutral.500',
    p: '15px',
    _disabled: {
      bg: 'neutral.200',
      cursor: 'not-allowed',
      color: 'neutral.500',
      _active: {
        boxShadow: 'none',
        borderColor: 'neutral.500',
      },
      _hover: {
        bg: 'neutral.200',
      },
      _checked: {
        bg: 'neutral.300',
        borderColor: 'neutral.500',
        _hover: {
          bg: 'neutral.300',
        },
        _active: {
          borderColor: 'neutral.500',
        },
      },
    },
    _hover: {
      bg: `${c}.100`,
    },
    _active: {
      bg: `${c}.300`,
      borderColor: activeBorderColor,
    },
    _focus: {
      boxShadow: `0 0 0 3px ${getColor(theme, `${c}.300`)}`,
    },
    _checked: {
      bg: `${c}.200`,
      p: '13px',
      border: '3px solid',
      borderColor: activeBorderColor,
      _active: {
        bg: `${c}.300`,
      },
    },
  }
}

const outlineContainerStyle = (props: Record<string, any>) => {
  const { isChecked } = props

  return {
    w: '100%',
    zIndex: isChecked ? 1 : 'initial',
    _active: { zIndex: 1 },
    _focusWithin: { zIndex: 1 },
  }
}

export const YesNoField: ComponentMultiStyleConfig = {
  parts,
  variants: {
    outline: (props) => {
      return {
        option: outlineOptionStyle(props),
        container: outlineContainerStyle(props),
        icon: {
          display: ['none', 'none', 'initial'],
          fontSize: '1.5rem',
          mr: '0.5rem',
        },
      }
    },
  },
  defaultProps: {
    variant: 'outline',
    colorScheme: 'primary',
  },
}
