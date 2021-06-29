import { useController, useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { CheckboxGroup, CheckboxProps, Input, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'
import { omit } from 'lodash'

import Button from '~components/Button'
import Others from '~components/Others'

import { Checkbox } from './Checkbox'

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  decorators: [],
} as Meta

export const Default: Story<CheckboxProps> = (args) => <Checkbox {...args} />
Default.args = {
  value: 'Option',
}

export const Group: Story<CheckboxProps> = (args) => {
  return (
    <VStack align="left">
      <Checkbox value="Option 1" />
      <Checkbox value="Option 2" />
      <Checkbox value="Option 3" />
      <Others {...args} value="Others" base="checkbox">
        <Input placeholder="Please specify" />
      </Others>
    </VStack>
  )
}

export const Playground: Story = (args) => {
  const { name, label, isDisabled, isRequired } = args

  const { handleSubmit, watch, control, register } = useForm()
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
          <CheckboxGroup {...omit(field, 'ref')}>
            <Checkbox value="Option 1" isDisabled={isDisabled} />
            <Checkbox value="Option 2" isDisabled={isDisabled} />
            <Checkbox value="Option 3" isDisabled={isDisabled} />
            <Others value="Others" isDisabled={isDisabled} base="checkbox">
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
            </Others>
          </CheckboxGroup>
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

/**
 * FOR DEVELOPERS: Can also be used directly with useform and register.
 * Commented out to streamline UI review as this looks identical to Playground
 */
// export const PlaygroundWithoutCheckboxGroup: Story = (args) => {
//   const { name, label, isDisabled, isRequired } = args

//   const {
//     handleSubmit,
//     watch,
//     register,
//     formState: { errors },
//   } = useForm()

//   const values = watch(name)

//   const onSubmit = (data: Record<string, string>) => {
//     alert(JSON.stringify(data))
//   }

//   const options = ['Option 1', 'Option 2', 'Option 3']
//   return (
//     <form onSubmit={handleSubmit(onSubmit)} noValidate>
//       <FormControl
//         isRequired={isRequired}
//         isDisabled={isDisabled}
//         isInvalid={!!errors[name]}
//         mb={6}
//       >
//         <FormLabel htmlFor={name}>{label}</FormLabel>
//         <VStack align="left">
//           {options.map((option, idx) => (
//             <Checkbox
//               key={idx}
//               value={option}
//               isDisabled={isDisabled}
//               {...register(name, {
//                 required: {
//                   value: isRequired,
//                   message: 'This field is required',
//                 },
//               })}
//             />
//           ))}
//           <Others
//             value="Others"
//             isDisabled={isDisabled}
//             base="checkbox"
//             {...register(name, {
//               required: {
//                 value: isRequired,
//                 message: 'This field is required',
//               },
//             })}
//           >
//             {/* Any subcomponent can be used due to children composition */}
//             <Input
//               isInvalid={!!errors.others}
//               placeholder="Please specify"
//               {...register('others', {
//                 // Caller is responsible for validation, this is just an example, can be
//                 // refined when we start implementing validation and business logic.
//                 required: Array.isArray(values) && values.includes('Others'),
//               })}
//             />
//           </Others>
//         </VStack>
//         <FormErrorMessage>
//           {errors[name] && errors[name].message}
//         </FormErrorMessage>
//       </FormControl>
//       <Button type="submit">Submit</Button>
//     </form>
//   )
// }

// PlaygroundWithoutCheckboxGroup.args = {
//   name: 'Test playground input',
//   label: 'Checkbox Field',
//   isRequired: true,
//   isDisabled: false,
// }
