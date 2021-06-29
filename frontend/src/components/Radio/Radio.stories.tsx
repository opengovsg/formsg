import { useController, useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { Input, RadioGroup, RadioProps, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import Button from '~components/Button'
import Others from '~components/Others'

import { Radio } from './Radio'

export default {
  title: 'Components/Radio',
  component: Radio,
  decorators: [],
} as Meta

export const Default: Story<RadioProps> = (args) => <Radio {...args} />
Default.args = {
  value: 'Option',
}

export const Group: Story<RadioProps> = (args) => {
  return (
    <RadioGroup>
      <VStack align="left">
        <Radio value="Option 1" />
        <Radio value="Option 2" />
        <Radio value="Option 3" />
        <Others value="Others" base="radio">
          <Input placeholder="Please specify" />
        </Others>
      </VStack>
    </RadioGroup>
  )
}

export const Playground: Story = (args) => {
  const { name, label, isDisabled, isRequired } = args
  const { register, handleSubmit, control } = useForm()
  const {
    field,
    formState: { errors },
  } = useController({
    control,
    name,
    rules: {
      required: isRequired
        ? { value: true, message: 'This field is required' }
        : false,
    },
  })

  const onSubmit = (data: Record<string, string>) => {
    alert(JSON.stringify(data))
  }

  const options = ['Option 1', 'Option 2', 'Option 3']
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormControl
        isRequired={isRequired}
        isDisabled={isDisabled}
        isInvalid={!!errors[name]}
        mb={6}
      >
        <FormLabel htmlFor={name}>{label}</FormLabel>
        <RadioGroup {...field}>
          <VStack align="left">
            {options.map((option, idx) => {
              return <Radio key={idx} value={option} isDisabled={isDisabled} />
            })}
            <Others value="Others" isDisabled={isDisabled} base="radio">
              {/* Any subcomponent can be used due to children composition */}
              <Input
                isInvalid={!!errors.others}
                placeholder="Please specify"
                {...register('others', {
                  // Caller is responsible for validation, this is just an example, can be
                  // refined when we start implementing validation and business logic.
                  required: field.value === 'Others',
                })}
              />
            </Others>
          </VStack>
        </RadioGroup>
        <FormErrorMessage>
          {errors[name] && errors[name].message}
        </FormErrorMessage>
      </FormControl>
      <Button type="submit">Submit</Button>
    </form>
  )
}

Playground.args = {
  name: 'Test playground input',
  label: 'Radio Field',
  isRequired: true,
  isDisabled: false,
}
