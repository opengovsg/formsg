import { useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { Checkbox, Input, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

import Button from '~components/Button'

import { Checkbox2Other } from './Checkbox2'

export default {
  title: 'Components/Checkbox2',
  component: Checkbox2Other,
  decorators: [],
} as Meta

export const Playground: Story = (args) => {
  const { name, label, isDisabled, isRequired } = args

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm()

  const values = watch(name)

  const onSubmit = (data: Record<string, string>) => {
    alert(JSON.stringify(data))
  }

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
          <Checkbox
            value="Option 1"
            {...register(name, { required: isRequired })}
          />
          <Checkbox
            value="Option 2"
            {...register(name, { required: isRequired })}
          />
          <Checkbox
            value="Option 3"
            {...register(name, { required: isRequired })}
          />
          {/* See how this component is only responsible for rendering, 
          everything else can be used by react-hook-form */}
          <Checkbox2Other value="Others option" {...register(name)}>
            {/* Any subcomponent can be used due to children composition */}
            <Input
              isInvalid={!!errors.others}
              {...register('others', {
                // Caller is responsible for validation, this is just an example, can be
                // refined when we start implementing validation and business logic.
                required:
                  Array.isArray(values) && values.includes('Others option'),
              })}
            />
          </Checkbox2Other>
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
  isRequired: false,
  isDisabled: false,
}
