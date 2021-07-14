import React, { ReactChild } from 'react'
import { IconType } from 'react-icons/lib'
import {
  Box,
  Button,
  forwardRef,
  HStack,
  Icon,
  Text,
  useMultiStyleConfig,
  VStack,
} from '@chakra-ui/react'

export interface TileProps {
  // The typing here is to satisfy the ts compiler
  // because otherwise, it will complain about assigning null to the as prop
  /**
   * The icon that should be displayed on the tile
   */
  icon: IconType

  /**
   * The title of the tile
   */
  title: string
  /**
   * The subtitle of the tile
   */
  subtitle: string

  /**
   * The components to be displayed below the title/subtitle
   */
  children: ReactChild

  /**
   * The tag, if any, to be displayed alongside the title
   */
  tag?: JSX.Element
}

type TileVariant = 'complex' | 'simple'
export const Tile = forwardRef<TileProps, 'div'>(
  ({ tag, icon, title, subtitle, children }, ref) => {
    const variant: TileVariant = children ? 'complex' : 'simple'
    const styles = useMultiStyleConfig('Tile', { variant })

    return (
      // Ref passed into the component as a whole so that it can be focused
      <Button sx={styles.container} ref={ref}>
        <VStack spacing="1rem" alignItems="flex-start">
          <HStack spacing="1rem">
            <Icon sx={styles.icon} as={icon}></Icon>
            {tag}
          </HStack>
          <Text sx={styles.title} as="h4">
            {title}
          </Text>
          <Text sx={styles.subtitle}>{subtitle}</Text>
          {/* Box used to wrap children prop so that it doesn't overflow */}
          {children && <Box>{children}</Box>}
        </VStack>
      </Button>
    )
  },
)
