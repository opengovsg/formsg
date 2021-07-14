import { useRef } from 'react'
import { Tab as ChakraTab, TabProps } from '@chakra-ui/react'

import { SCROLL_TO_VIEW_OPTIONS } from '~/theme/components/Tabs'

export const Tab = (props: TabProps): JSX.Element => {
  const tabRef = useRef<HTMLButtonElement>(null)

  const handleFocus = () => {
    tabRef.current?.scrollIntoView(SCROLL_TO_VIEW_OPTIONS)
  }
  return <ChakraTab {...props} ref={tabRef} onFocus={handleFocus} />
}
