import React from 'react'
import { BiX } from 'react-icons/bi'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  CloseButton,
  Icon,
  useMultiStyleConfig,
  UseToastOptions,
} from '@chakra-ui/react'

import { BxsCheckCircle, BxsErrorCircle } from '~assets/icons'

type ToastStatus = 'danger' | 'success' | 'warning'

export interface ToastProps
  extends Omit<
    UseToastOptions,
    'duration' | 'position' | 'render' | 'status' | 'variant'
  > {
  /**
   * The status of the Toast.
   */
  status: ToastStatus
  // RenderProps that chakra passes to all custom components that uses the render function
  onClose: () => void
}

const getIconForStatus = (status: ToastStatus) =>
  status === 'success' ? BxsCheckCircle : BxsErrorCircle

export const Toast = ({
  status,
  title,
  id,
  description,
  isClosable,
  onClose,
  onCloseComplete,
}: ToastProps): JSX.Element => {
  const styles = useMultiStyleConfig('Toast', {
    variant: status,
  })

  return (
    <Alert sx={styles.container} id={String(id)}>
      <Icon sx={styles.icon} as={getIconForStatus(status)} />
      <Box sx={styles.content}>
        {title && <AlertTitle>{title}</AlertTitle>}
        {description && <AlertDescription>{description}</AlertDescription>}
      </Box>
      {isClosable && (
        <CloseButton
          as={BiX}
          onClick={() => {
            onClose?.()
            onCloseComplete?.()
          }}
          sx={styles.close}
        />
      )}
    </Alert>
  )
}
