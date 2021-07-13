/* eslint-disable @typescript-eslint/no-unused-vars */
import { BiLockAlt } from 'react-icons/bi'
import { ListItem, Tag, Text, UnorderedList } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'
import _ from 'lodash'

import Tile from '~/components/Tile'

import { TileProps } from './Tile'

export default {
  title: 'Components/Tiles',
  component: Tile,
  decorators: [],
} as Meta

const List = () => (
  <>
    <Text>Description</Text>
    <UnorderedList>
      {_.range(2).map(() => (
        <ListItem color="secondary.400" textStyle="body-2">
          <Text>Description</Text>
        </ListItem>
      ))}
    </UnorderedList>
  </>
)

const Template: Story<TileProps> = (args) => <Tile {...args} />
export const Default = Template.bind({})
Default.args = {
  tag: <Tag>recommended</Tag>,
  title: 'Title',
  subtitle: 'Receive responses in forms',
  icon: BiLockAlt,
  children: <List />,
}
