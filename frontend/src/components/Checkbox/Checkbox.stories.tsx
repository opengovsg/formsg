import { useForm } from 'react-hook-form'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/form-control'
import { CheckboxProps, Input, VStack } from '@chakra-ui/react'
import { Meta, Story } from '@storybook/react'

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

export const CheckboxGroup: Story<CheckboxProps> = (args) => {
  return (
    <VStack align="left">
      <Checkbox {...args} />
      <Checkbox {...args} />
      <Checkbox {...args} />
      <Others {...args} value="Others" base="checkbox">
        <Input placeholder="Please specify" />
      </Others>
    </VStack>
  )
}
CheckboxGroup.args = {
  value: 'Option',
}

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
          {options.map((option) => (
            <Checkbox
              value={option}
              isDisabled={isDisabled}
              {...register(name, {
                required: {
                  value: isRequired,
                  message: 'this is a required field',
                },
              })}
            />
          ))}
          <Others
            value="Others"
            isDisabled={isDisabled}
            base="checkbox"
            {...register(name)}
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
          </Others>
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
 * FOR DEVELOPERS: Checkbox can also be used with Chakra's checkboxgroup. Example is shown below.
 * Commented out for easy UI review as this looks identical to Playground.
 */
// export const PlaygroundUsingCheckboxGroup: Story = (args) => {
//   const { name, label, isDisabled, isRequired } = args

//   const { handleSubmit, watch, control, register } = useForm()
//   const {
//     field,
//     formState: { errors },
//   } = useController({
//     control,
//     name,
//     rules: {
//       required: isRequired ? { value: true, message: 'Required field' } : false,
//     },
//   })

//   const values = watch(name)

//   const onSubmit = (data: Record<string, string>) => {
//     alert(JSON.stringify(data))
//   }

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
//           <CheckboxGroup {...field}>
//             <Checkbox value="Option 1" isDisabled={isDisabled} />
//             <Checkbox value="Option 2" isDisabled={isDisabled} />
//             <Checkbox value="Option 3" isDisabled={isDisabled} />
//             <CheckboxOthers value="Others" isDisabled={isDisabled}>
//               {/* Any subcomponent can be used due to children composition */}
//               <Input
//                 isInvalid={!!errors.others}
//                 {...register('others', {
//                   // Caller is responsible for validation, this is just an example, can be
//                   // refined when we start implementing validation and business logic.
//                   required: Array.isArray(values) && values.includes('Others'),
//                 })}
//               />
//             </CheckboxOthers>
//           </CheckboxGroup>
//         </VStack>
//         <FormErrorMessage>
//           {errors[name] && errors[name].message}
//         </FormErrorMessage>
//       </FormControl>
//       <Button type="submit">Submit</Button>
//     </form>
//   )
// }

// PlaygroundUsingCheckboxGroup.args = {
//   name: 'Test playground input 2',
//   label: 'Checkbox Field',
//   isRequired: true,
//   isDisabled: false,
// }
