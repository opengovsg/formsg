import { BiLockAlt, BiMailSend } from 'react-icons/bi'
import { Box, Flex, ListItem, Text, UnorderedList } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'
import _ from 'lodash'

import Tag from '~components/Tag'

import { Tile, TileProps } from './Tile'

export default {
  title: 'Components/Tiles',
  component: Tile,
  decorators: [],
} as Meta

const List = ({
  listTitle,
  listItems,
}: {
  listTitle: string
  listItems: string[]
}) => (
  <Flex alignItems="flex-start" flexDir="column">
    <Text>{listTitle}</Text>
    <UnorderedList>
      {listItems.map((text) => (
        <ListItem color="secondary.400" textStyle="body-2">
          <Text>{text}</Text>
        </ListItem>
      ))}
    </UnorderedList>
  </Flex>
)

const Template: Story<TileProps> = (args) => (
  <Box width="332px">
    <Tile {...args} />
  </Box>
)
export const Complex = Template.bind({})
Complex.args = {
  tag: <Tag>recommended</Tag>,
  title: 'Title',
  subtitle: 'Receive responses in forms',
  icon: BiLockAlt,
  children: <List listTitle="description" listItems={['item 1', 'item 2']} />,
}

export const Simple = Template.bind({})
Simple.args = {
  title: 'Title',
  subtitle: 'Subtitle',
  icon: BiMailSend,
}

export const Playground: Story = ({
  title,
  subtitle,
  listTitle,
  listItems,
}) => {
  // NOTE: This is required because storybook allows complete removal of the list
  // And it's added back as an object
  const actualListItems =
    typeof listItems === 'object' ? _.values(listItems) : listItems

  return (
    <Box width="332px">
      <Tile icon={BiLockAlt} title={title} subtitle={subtitle}>
        <List listTitle={listTitle} listItems={actualListItems ?? []}></List>
      </Tile>
    </Box>
  )
}

Playground.args = {
  title: 'Playground',
  subtitle: 'For you to have fun',
  listTitle: 'Title',
  listItems: ['item 1', 'item 2'],
}
