import { forwardRef, Radio as ChakraRadio, RadioProps } from '@chakra-ui/react'

export const Radio = forwardRef<RadioProps, 'input'>((props, ref) => {
  return (
    <ChakraRadio {...props} ref={ref}>
      {props.value}
    </ChakraRadio>
  )
})
