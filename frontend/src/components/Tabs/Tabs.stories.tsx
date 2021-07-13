import { Tab, Tabs, TabsProps } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import { TabList } from './TabList'

export default {
  title: 'Components/Tabs',
  component: Tabs,
} as Meta

const TabTemplate: Story<TabsProps> = (args) => {
  return (
    <Tabs {...args}>
      <TabList>
        <Tab>Create</Tab>
        <Tab>Settings</Tab>
        <Tab>Results</Tab>
      </TabList>
    </Tabs>
  )
}

export const LightTab = TabTemplate.bind({})
LightTab.args = {
  variant: 'line-light',
}

export const DarkTab = TabTemplate.bind({})
DarkTab.args = {
  variant: 'line-dark',
}

export const WithScrolling = TabTemplate.bind({})
WithScrolling.args = {
  variant: 'line-dark',
}
WithScrolling.parameters = {
  viewport: {
    defaultViewport: 'mobile1',
  },
}
