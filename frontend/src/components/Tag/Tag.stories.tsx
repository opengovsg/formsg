import { Meta, Story } from '@storybook/react'

import { Tag, TagProps } from './Tag'

export default {
  title: 'Components/Tag',
  component: Tag,
  decorators: [],
} as Meta

const Template: Story<TagProps> = (args) => {
  return <Tag {...args}>Tag Name</Tag>
}
export const Primary = Template.bind({})
Primary.args = {
  variant: 'primary',
}

export const Secondary = Template.bind({})
Secondary.args = {
  variant: 'secondary',
}
export const Playground: Story = ({ variant, label }) => {
  return <Tag variant={variant}>{label}</Tag>
}

Playground.args = {
  label: "Tag you're it",
  variant: 'primary',
}
