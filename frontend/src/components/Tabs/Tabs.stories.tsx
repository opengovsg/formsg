import { Tab, TabList, Tabs, TabsProps } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

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
  variant: 'line',
}

export const DarkTab = TabTemplate.bind({})
DarkTab.args = {
  variant: 'enclosed',
}
