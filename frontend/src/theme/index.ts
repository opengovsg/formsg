import { extendTheme } from '@chakra-ui/react'

import { breakpoints } from './foundations/breakpoints'
import { colours } from './foundations/colours'
import { shadows } from './foundations/shadows'
import { components } from './components'
import { textStyles } from './textStyles'

export const theme = extendTheme({
  styles: {
    global: {
      body: {
        fontFeatureSettings: "'tnum' on, 'cv05' on",
      },
      /**
       * This will hide the focus indicator if the element receives focus via
       * the mouse,but it will still show up on keyboard focus.
       * Part of the steps needed to get focus-visible working.
       * See https://www.npmjs.com/package/focus-visible#2-update-your-css.
       */
      '.js-focus-visible :focus:not([data-focus-visible-added])': {
        outline: 'none',
      },
    },
  },
  colors: colours,
  textStyles,
  breakpoints,
  shadows,
  fonts: {
    heading: 'Inter,Helvetica,Arial,system-ui,sans-serif',
    body: 'Inter,Helvetica,Arial,system-ui,sans-serif',
  },
  components,
})
