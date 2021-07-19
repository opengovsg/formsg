import { useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { CheckboxProps, Input, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import Button from '~components/Button'

import { Checkbox, CheckboxOthers } from './Checkbox'

export default {
  title: 'Components/Fields/Checkbox',
  component: Checkbox,
  decorators: [],
} as Meta

export const Default: Story<CheckboxProps> = (args) => (
  <Checkbox {...args}>{args.value}</Checkbox>
)
Default.args = {
  value: 'Option',
}

export const Disabled: Story<CheckboxProps> = (args) => (
  <Checkbox {...args}>{args.value}</Checkbox>
)
Disabled.args = {
  value: 'Option',
  isDisabled: true,
}

export const Group: Story<CheckboxProps> = (args) => {
  return (
    <VStack align="left">
      <Checkbox value="Option 1">Option 1</Checkbox>
      <Checkbox value="Option 2">Option 2</Checkbox>
      <Checkbox value="Option 3">Option 3</Checkbox>
      <CheckboxOthers {...args} value="Others" label="Others">
        <Input placeholder="Please specify" />
      </CheckboxOthers>
    </VStack>
  )
}

export const Playground: Story = (args) => {
  const { name, label, isDisabled, isRequired } = args

  const {
    handleSubmit,
    watch,
    register,
    formState: { errors },
  } = useForm()

  const values = watch(name)

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
        <VStack align="left">
          {options.map((option, idx) => (
            <Checkbox
              key={idx}
              value={option}
              isDisabled={isDisabled}
              {...register(name, {
                required: {
                  value: isRequired,
                  message: 'This field is required',
                },
              })}
            >
              {option}
            </Checkbox>
          ))}
          <CheckboxOthers
            value="Others"
            label="Others"
            isDisabled={isDisabled}
            {...register(name, {
              required: {
                value: isRequired,
                message: 'This field is required',
              },
            })}
          >
            {/* Any subcomponent can be used due to children composition */}
            <Input
              isInvalid={!!errors.others}
              placeholder="Please specify"
              {...register('others', {
                // Caller is responsible for validation, this is just an example, can be
                // refined when we start implementing validation and business logic.
                required: Array.isArray(values) && values.includes('Others'),
              })}
            />
          </CheckboxOthers>
        </VStack>
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
  label: 'Checkbox Field',
  isRequired: true,
  isDisabled: false,
}
