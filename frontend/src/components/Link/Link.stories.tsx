import { BiRightArrowAlt } from 'react-icons/bi'
import Icon from '@chakra-ui/icon'
import { Meta, Story } from '@storybook/react'

import { Link, LinkProps } from './Link'

export default {
  title: 'Components/Link',
  component: Link,
  decorators: [],
} as Meta

const Template: Story<LinkProps> = (args) => <Link {...args} />
export const Default = Template.bind({})
Default.args = {
  children: 'Link',
}

export const Disabled = Template.bind({})
Disabled.args = {
  isDisabled: true,
  children: 'Disabled link',
}

export const WithExternalIcon = Template.bind({})
WithExternalIcon.args = {
  children: "This goes to Form's homepage",
  href: 'https://form.gov.sg',
  isExternal: true,
}

export const VariantInline = Template.bind({})
VariantInline.args = {
  variant: 'inline',
  children: 'Inline variant link',
  isExternal: false,
}

export const VariantStandalone = Template.bind({})
VariantStandalone.args = {
  variant: 'standalone',
  children: (
    <>
      Standalone variant link
      <Icon as={BiRightArrowAlt} fontSize="1.5rem" ml="0.5rem" />
    </>
  ),
  isExternal: false,
  href: '',
}
