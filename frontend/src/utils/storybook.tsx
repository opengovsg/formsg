import { Center } from '@chakra-ui/layout'
import { DecoratorFn } from '@storybook/react'

import { theme } from '~/theme'

export const centerDecorator: DecoratorFn = (storyFn) => (
  <Center>{storyFn()}</Center>
)

/**
 * Helper function to convert theme breakpoint into viewport width in px for
 * Chromatic viewpoint snapshots.
 * @param breakpoint the theme breakpoint to convert
 * @returns the number pixel width of the given breakpoint.
 */
const breakpointToViewportWidth = (
  breakpoint: keyof typeof theme.breakpoints,
) => {
  const rem = 16
  return parseInt(theme.breakpoints[breakpoint]) * rem
}

/**
 * Viewports mapping viewport key to their width in (pixel) number.
 * Used for Chromatic viewpoint snapshots which requires the numbers in pixels.
 */
export const viewports = {
  xs: breakpointToViewportWidth('xs'),
  sm: breakpointToViewportWidth('sm'),
  md: breakpointToViewportWidth('md'),
  lg: breakpointToViewportWidth('lg'),
  xl: breakpointToViewportWidth('xl'),
}
