import { useController, useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { Input, RadioGroup, RadioProps, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import Button from '~components/Button'

import { Radio } from './Radio'
import { RadioOthers } from './RadioOthers'

export default {
  title: 'Components/Fields/Radio',
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
        <RadioOthers value="Others">
          <Input placeholder="Please specify" />
        </RadioOthers>
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
            <RadioOthers value="Others" isDisabled={isDisabled}>
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
            </RadioOthers>
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
