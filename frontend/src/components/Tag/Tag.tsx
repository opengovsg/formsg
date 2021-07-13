import React from 'react'
import { Tag as ChakraTag, TagProps as ChakraTagProps } from '@chakra-ui/react'

type TagVariants = 'primary' | 'secondary'

// colorScheme is omitted because the tag uses variants to select colours
export interface TagProps extends Omit<ChakraTagProps, 'colorScheme'> {
  /**
   * The theme of the tag to display
   */
  variant?: TagVariants
}

export const Tag = (props: TagProps): JSX.Element => {
  return <ChakraTag {...props} />
}
