import { Controller, useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { Meta, Story } from '@storybook/react'

import Button from '../Button'

import { NumberInput, NumberInputProps } from './NumberInput'

export default {
  title: 'Components/NumberInput',
  component: NumberInput,
  decorators: [],
} as Meta

const Template: Story<NumberInputProps> = (args) => <NumberInput {...args} />
export const Default = Template.bind({})
Default.args = {
  placeholder: 'Test placeholder',
}

export const HideSteppers = Template.bind({})
HideSteppers.args = {
  placeholder: 'This field has no steppers',
  showSteppers: false,
}

export const Prefilled = Template.bind({})
Prefilled.args = {
  placeholder: 'Test placeholder',
  defaultValue: '3.142',
  isPrefilled: true,
}

export const Error = Template.bind({})
Error.args = {
  isInvalid: true,
  defaultValue: '-1',
}

export const Success = Template.bind({})
Success.args = {
  isInvalid: false,
  isSuccess: true,
  defaultValue: '1337',
}
export const Disabled = Template.bind({})
Disabled.args = {
  defaultValue: '0',
  isDisabled: true,
}

export const Playground: Story = ({
  name,
  label,
  isDisabled,
  isRequired,
  ...args
}) => {
  const {
    handleSubmit,
    formState: { errors },
    control,
  } = useForm()
  const onSubmit = (data: unknown) => alert(JSON.stringify(data))

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormControl
        isRequired={isRequired}
        isDisabled={isDisabled}
        isInvalid={!!errors[name]}
        mb={6}
      >
        <FormLabel htmlFor={name}>{label}</FormLabel>
        <Controller
          name={name}
          control={control}
          rules={{
            required: isRequired
              ? { value: true, message: 'Required field' }
              : false,
          }}
          render={({ field }) => <NumberInput {...field} {...args} />}
        />
        <FormErrorMessage>
          {errors[name] && errors[name].message}
        </FormErrorMessage>
      </FormControl>
      <Button variant="solid" type="submit">
        Submit
      </Button>
    </form>
  )
}
Playground.args = {
  name: 'Test playground input',
  label: 'Field label',
  placeholder: 'Fill in this field',
  isRequired: true,
  isDisabled: false,
}
