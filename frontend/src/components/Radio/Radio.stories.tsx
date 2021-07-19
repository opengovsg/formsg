import { useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { Input, RadioGroup, RadioProps, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import Button from '~components/Button'

import { Radio, RadioOthers } from './Radio'

export default {
  title: 'Components/Fields/Radio',
  component: Radio,
  decorators: [],
} as Meta

export const Default: Story<RadioProps> = (args) => (
  <Radio {...args}>{args.value}</Radio>
)
Default.args = {
  value: 'Option',
}

export const Group: Story<RadioProps> = (args) => {
  return (
    <RadioGroup>
      <VStack align="left">
        <Radio value="Option 1">Option 1</Radio>
        <Radio value="Option 2">Option 2</Radio>
        <Radio value="Option 3">Option 3</Radio>
        <RadioOthers value="Others" label="Others">
          <Input placeholder="Please specify" />
        </RadioOthers>
      </VStack>
    </RadioGroup>
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

  const value = watch(name, null)

  const onSubmit = (data: Record<string, string>) => {
    alert(JSON.stringify(data))
  }

  const options = ['Option 1', 'Option 2', 'Option 3']
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormControl
        isRequired={isRequired}
        // isDisabled={isDisabled}
        isInvalid={!!errors[name]}
        mb={6}
      >
        <FormLabel htmlFor={name}>{label}</FormLabel>
        <RadioGroup>
          <VStack align="left">
            {options.map((option, idx) => (
              <Radio
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
              </Radio>
            ))}
            <RadioOthers
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
                isDisabled={isDisabled}
                placeholder="Please specify"
                {...register('others', {
                  // Caller is responsible for validation, this is just an example, can be
                  // refined when we start implementing validation and business logic.
                  required: value === 'Others',
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
