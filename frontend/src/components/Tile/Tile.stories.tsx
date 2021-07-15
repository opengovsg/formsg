import { useState } from 'react'
import { BiLockAlt, BiMailSend } from 'react-icons/bi'
import { ListItem, Stack, UnorderedList } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'
import _ from 'lodash'

import Tag from '~components/Tag'

import { Tile, TileProps, TileSubtitle, TileText, TileTitle } from './Tile'

export default {
  title: 'Components/Tiles',
  component: Tile,
  decorators: [],
} as Meta

const List = ({
  listTitle,
  listItems = [],
}: {
  listTitle: string
  listItems: string[]
}) => (
  <>
    <TileText textStyle="subhead-2">{listTitle}</TileText>
    <UnorderedList>
      {listItems.map((text) => (
        <ListItem>
          <TileText textStyle="body-2" textAlign="left">
            {text}
          </TileText>
        </ListItem>
      ))}
    </UnorderedList>
  </>
)

interface TileTemplateProps extends TileProps {
  title: string
  subtitle: string
  listTitle: string
  listItems: Record<string, string>
}

const Template: Story<TileTemplateProps> = ({
  title,
  subtitle,
  listTitle,
  listItems,
  ...args
}) => {
  const [isClicked, setIsClicked] = useState<boolean>(false)
  const hasDescription = listTitle || listItems
  return (
    <Tile
      {...args}
      onClick={() => setIsClicked(!isClicked)}
      isActive={isClicked}
    >
      <TileTitle>{title}</TileTitle>
      <TileSubtitle>{subtitle}</TileSubtitle>
      {hasDescription && (
        <List listTitle={listTitle} listItems={_.values(listItems)} />
      )}
    </Tile>
  )
}

export const Complex = Template.bind({})
Complex.args = {
  variant: 'complex',
  title: 'Complex',
  subtitle: 'Receive responses in forms',
  tag: <Tag>recommended</Tag>,
  icon: BiLockAlt,
  listTitle: 'description',
  listItems: {
    1: 'item 1',
    2: 'item 2',
  },
}

export const Simple = Template.bind({})
Simple.args = {
  variant: 'simple',
  title: 'Simple',
  subtitle: 'Receive responses in forms',
  icon: BiMailSend,
}

export const Playground: Story = () => {
  const [isStorageClicked, setIsStorageClicked] = useState<boolean>(false)
  const [isEmailClicked, setIsEmailClicked] = useState<boolean>(false)

  return (
    <Stack
      width={{ md: '100%' }}
      direction={{ base: 'column', md: 'row' }}
      spacing="1rem"
    >
      <StorageTile
        onClick={() => {
          setIsStorageClicked(true)
          setIsEmailClicked(false)
        }}
        isActive={isStorageClicked}
      />
      <EmailTile
        onClick={() => {
          setIsStorageClicked(false)
          setIsEmailClicked(true)
        }}
        isActive={isEmailClicked}
      />
    </Stack>
  )
}

interface StoryTileProps {
  onClick: () => void
  isActive?: boolean
}

const EmailTile = ({ onClick, isActive }: StoryTileProps) => (
  <Tile
    variant="complex"
    icon={BiMailSend}
    isActive={isActive}
    onClick={onClick}
    isFullWidth
  >
    <TileTitle>Email Mode</TileTitle>
    <TileSubtitle>Receive responses in your inbox</TileSubtitle>
    <List
      listTitle="Who is it for:"
      listItems={['Emailed copy of response', 'MyInfo fields']}
    />
  </Tile>
)

const StorageTile = ({ onClick, isActive }: StoryTileProps) => (
  <Tile
    variant="complex"
    icon={BiLockAlt}
    tag={<Tag>recommended</Tag>}
    isActive={isActive}
    onClick={onClick}
    isFullWidth
  >
    <TileTitle>Storage Mode</TileTitle>
    <TileSubtitle>Receive responses in Form</TileSubtitle>
    <List
      listTitle="Who is it for:"
      listItems={['High-volume forms', 'End to end encryption needs']}
    />
  </Tile>
)
