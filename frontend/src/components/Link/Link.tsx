import { BiLinkExternal } from 'react-icons/bi'
import {
  Icon,
  Link as ChakraLink,
  LinkProps as ChakraLinkProps,
  Text,
  useStyleConfig,
} from '@chakra-ui/react'

export interface LinkProps extends ChakraLinkProps {
  externalLinkIcon?: React.ReactElement
  isDisabled?: boolean
}

export const Link = ({
  externalLinkIcon = <Link.ExternalIcon />,
  isDisabled,
  children,
  ...props
}: LinkProps): JSX.Element => {
  const styles = useStyleConfig('Link', props)

  if (isDisabled) {
    return (
      <Text
        as="a"
        sx={styles}
        aria-disabled
        d="inline-flex"
        alignItems="center"
      >
        {children}
        {props.isExternal && externalLinkIcon}
      </Text>
    )
  }

  return (
    <ChakraLink d="inline-flex" alignItems="center" {...props}>
      {children}
      {props.isExternal && externalLinkIcon}
    </ChakraLink>
  )
}

Link.ExternalIcon = (): JSX.Element => {
  return <Icon aria-hidden as={BiLinkExternal} ml="0.25rem" />
}
