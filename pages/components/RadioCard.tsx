import { Box, useRadio } from '@chakra-ui/react'

function RadioCard(props: any) {
  const { getInputProps, getCheckboxProps } = useRadio(props)

  const input = getInputProps()
  const checkbox = getCheckboxProps()

  return (
    <Box as="label">
      <input {...input} />
      <Box
        {...checkbox}
        cursor="pointer"
        borderWidth="1px"
        borderRadius="md"
        boxShadow="md"
        _checked={{
          bg: 'teal.600',
          color: 'white',
          borderColor: 'teal.600',
        }}
        _focus={{
          boxShadow: 'outline',
        }}
        px={5}
        py={3}
      >
        {/* <video autoPlay loop src="https://onimax-bucket.s3.ap-northeast-3.amazonaws.com/ipfs/QmWGyA2Qv8hSfHkmFHgDLoZsFxrr34T2ZD62U5muuWvc96.webm"></video> */}
        {props.children}
      </Box>
    </Box>
  )
}

export default RadioCard
