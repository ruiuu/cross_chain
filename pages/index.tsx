import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { Button } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { SimpleGrid, Box, useToast, HStack, useRadioGroup, Progress } from '@chakra-ui/react'
import {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
  GMPStatusResponse,
  AxelarGMPRecoveryAPI,
} from '@axelar-network/axelarjs-sdk'
import RadioCard from './components/RadioCard'

const CHAIN_NAME = {
  binance: 'binance',
  Ethereum: 'Ethereum',
  Fantom: 'Fantom',
  Polygon: 'Polygon',
}

const CONTRACT_ADDRESS = {
  fantom: '0xF7402eA612EFC90E9Fff881b5a47F8fc288d1d5d',
  polygon: '0xd89dAe6c7b27C3729D1d633F9ae103578bC6CC55',
  fxerc721: '0xCe46b420a76C2A48FbD9633dBf944e6ef39Bac1e',
  testNFT: '0x043d587CB4e08D4185151d7e6Dc1De7Ef996f2AE',
  childToken: '0xDd9f2b85550197Ded754CA3FDb4ee2D42627953c',
}

const PRIVATE_KEY = {
  fantom: '8G64ASYSHBKZRZE3UA9MC1AP3U4YQGZTUB',
  polygon: 'Z4TIZEV4DUMGY65993BU5JQCA1II6ZXQF4',
}

const sdk = new AxelarQueryAPI({
  environment: Environment.TESTNET,
})

const axelarGMPRecoveryAPI = new AxelarGMPRecoveryAPI({
  environment: Environment.TESTNET,
})

const Home: NextPage = () => {
  const [account, setAccount] = useState('0x0')
  const [ftmBalance, setFtmBalance] = useState('0')
  const [maticBalance, setMaticBalance] = useState('0')
  const [isMintLoading, setIsMintLoading] = useState(false)
  const [mainnetNFTS, setMainnetNFTS] = useState<string[]>([])
  const [subnetNFTS, setSubnnetNFTS] = useState<string[]>([])
  const [selectTokenId, setSelectTokenId] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState(0)
  const toast = useToast()

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'framework',
    defaultValue: 'react',
    onChange: handleChooseTokenId,
  })

  const group = getRootProps()

  async function handleConnectWallet() {
    let ethereum = window.ethereum

    if (typeof ethereum == 'undefined') {
      alert('MetaMask is not installed!')
      return
    }
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    setAccount(accounts[0])
    _getBalance(accounts[0])

    handleRefreshMainnet(accounts[0])
    handleRefreshSubnet(accounts[0])
  }

  async function handleMint() {
    setIsMintLoading(true)

    let provider = new ethers.providers.Web3Provider(window.ethereum)

    let address = CONTRACT_ADDRESS.testNFT
    let abi = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
        ],
        name: 'safeMint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]

    let contract = new ethers.Contract(address, abi, provider)
    let contractWithSinger = contract.connect(provider.getSigner())

    let mint = await contractWithSinger.safeMint(account)
    await mint.wait()

    setTimeout(() => {
      toast({
        title: 'Mint NFT success.',
        description: `mint to ${account}`,
        status: 'success',
        duration: 9000,
        isClosable: true,
        position: 'top',
      })
      handleRefreshMainnet(account)
    }, 2000)

    setIsMintLoading(false)
  }

  async function handleDeposit() {
    setDepositLoading(true)
    let provider = new ethers.providers.Web3Provider(window.ethereum)
    let mainnet = CONTRACT_ADDRESS.fantom
    let rootToken = CONTRACT_ADDRESS.testNFT

    let depositABI = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'rootToken',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'tokenId',
            type: 'uint256',
          },
          {
            internalType: 'string',
            name: 'destinationChain',
            type: 'string',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        name: 'deposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ]
    let rootTokenABI = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
        ],
        name: 'isApprovedForAll',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'bool',
            name: 'approved',
            type: 'bool',
          },
        ],
        name: 'setApprovalForAll',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]

    let mainnetContract = new ethers.Contract(mainnet, depositABI, provider)
    let rootTokenContract = new ethers.Contract(rootToken, rootTokenABI, provider)

    let mainnetWithSinger = mainnetContract.connect(provider.getSigner())
    let rootTokenWithSinger = rootTokenContract.connect(provider.getSigner())

    let isApprovedForAll = await rootTokenWithSinger.isApprovedForAll(account, mainnet)

    if (!isApprovedForAll) {
      let setApprovalForAll = await rootTokenWithSinger.setApprovalForAll(mainnet, true)
      setApprovalForAll.wait()
    }

    let tokenId = Number(selectTokenId)

    let destchain = CHAIN_NAME.Polygon

    const gasFee = await sdk.estimateGasFee(EvmChain.FANTOM, EvmChain.POLYGON, GasToken.FTM)

    let deposit = await mainnetWithSinger.deposit(CONTRACT_ADDRESS.testNFT, tokenId, destchain, [], {
      value: gasFee,
    })
    let transaction = await deposit.wait()

    let transactionHash = transaction.transactionHash

    const txStatus: GMPStatusResponse = await axelarGMPRecoveryAPI.queryTransactionStatus(transactionHash)

    setTimeout(() => {
      handleRefresh(account)
    }, 3000)

    setDepositLoading(false)
  }

  async function handleWithdraw() {
    setWithdrawLoading(true)
    let provider = new ethers.providers.Web3Provider(window.ethereum)
    let address = CONTRACT_ADDRESS.polygon
    let abi = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'childToken',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'tokenId',
            type: 'uint256',
          },
          {
            internalType: 'string',
            name: 'destchain',
            type: 'string',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ]

    let childToken = CONTRACT_ADDRESS.childToken
    let tokenId = Number(selectTokenId)
    let destchain = CHAIN_NAME.Fantom

    let contract = new ethers.Contract(address, abi, provider)
    let contractWithSinger = contract.connect(provider.getSigner())

    const gasFee = await sdk.estimateGasFee(EvmChain.POLYGON, EvmChain.FANTOM, GasToken.MATIC)

    let withdraw = await contractWithSinger.withdraw(childToken, tokenId, destchain, [], {
      value: gasFee,
    })

    await withdraw.wait()

    setTimeout(() => {
      handleRefresh(account)
    }, 3000)

    setWithdrawLoading(false)
  }

  async function checkCrossChainStatus(transactionHash: string) {
    const GMPStatus = {
      source_gateway_called: 1,
      destination_gateway_approved: 2,
      destination_executed: 3,
      destination_execute_error: 4,
      unknown_error: 5,
      cannot_fetch_status: 6,
    }

    let timer = setInterval(async function () {
      const txStatus: GMPStatusResponse = await axelarGMPRecoveryAPI.queryTransactionStatus(transactionHash)
      const { status } = txStatus
      let _GMPStatus = GMPStatus[status]

      // let _GasPaidStatus = txStatus.gasPaidInfo ? GasPaidStatus[txStatus.gasPaidInfo.status] : 'undefined'

      setTransactionStatus(_GMPStatus)

      if ((_GMPStatus = 3)) {
        clearInterval(timer)
      }
    })
  }

  function handleChooseTokenId(tokenId: any) {
    setSelectTokenId(tokenId)
    console.log('tokenId', tokenId)
  }

  function handleRefresh(_account: any) {
    handleRefreshMainnet(_account)
    handleRefreshSubnet(_account)
  }

  function handleRefreshMainnet(_account: any) {
    _updateMyNFTBalance(CONTRACT_ADDRESS.testNFT, 'mainnet', _account)
  }

  function handleRefreshSubnet(_account: any) {
    _updateMyNFTBalance(CONTRACT_ADDRESS.childToken, 'subnet', _account)
  }

  function _getBalance(account: any) {
    const fantomUrl = `https://api-testnet.ftmscan.com/api?module=account&action=balance&address=${account}&apikey=${PRIVATE_KEY.fantom}`
    const polygonUrl = `https://api-testnet.polygonscan.com/api?module=account&action=balance&address=${account}&apikey=${PRIVATE_KEY.polygon}`

    fetch(fantomUrl)
      .then((res) => {
        return res.json()
      })
      .then((data) => {
        const ftmBalance = ethers.utils.formatEther(data.result)
        setFtmBalance(ftmBalance.slice(0, 4))
      })
    fetch(polygonUrl)
      .then((res) => {
        return res.json()
      })
      .then((data) => {
        const maticBalance = ethers.utils.formatEther(data.result)
        setMaticBalance(maticBalance.slice(0, 4))
      })
  }

  function _updateMyNFTBalance(contract: any, network: any, _account: any) {
    let mainnetURL = `https://api-testnet.ftmscan.com/api?module=account&action=tokennfttx&contractaddress=${contract}&address=${_account}&startblock=0&endblock=99999999&page=1&offset=100&sort=asc&apikey=${PRIVATE_KEY.fantom}`
    let subnetURL = `https://api-testnet.polygonscan.com/api?module=account&action=tokennfttx&contractaddress=${contract}&address=${_account}&page=1&offset=100&sort=asc&apikey=${PRIVATE_KEY.polygon}`
    if (network == 'mainnet') {
      fetch(mainnetURL)
        .then((res) => {
          return res.json()
        })
        .then((data) => {
          let _array = _calcTokenIdFromEvent(data, _account)
          setMainnetNFTS(_array)
          console.log('mainnetNFTS', _array)
        })
    } else if (network == 'subnet') {
      fetch(subnetURL)
        .then((res) => {
          return res.json()
        })
        .then((data) => {
          let _array = _calcTokenIdFromEvent(data, _account)
          setSubnnetNFTS(_array)
          console.log('subnetNFTS', _array)
        })
    }
  }

  function _calcTokenIdFromEvent(data: { result: any }, _account: string | undefined) {
    let result = data.result
    let _array: string[] = []
    result.forEach((item: { from: string; tokenID: string; to: string }) => {
      if (item.from == '0x0000000000000000000000000000000000000000') {
        _array.push(item.tokenID)
      }
      if (item.to == _account && item.from != '0x0000000000000000000000000000000000000000') {
        _array.push(item.tokenID)
      }
    })
    result.forEach((item: { from: string; tokenID: string }, index: any) => {
      if (item.from == _account) {
        if (_array.includes(item.tokenID)) {
          _array.splice(_array.indexOf(item.tokenID), 1)
        }
      }
    })
    return _array
  }

  async function handleCheck() {
    const transactionHash = '0xff5331d0122138715f81f26d905cdaf0a0b5419c0a841e38af21f2c3905f9621'
    const txStatus: GMPStatusResponse = await axelarGMPRecoveryAPI.queryTransactionStatus(transactionHash)
    console.log('txStatus', txStatus)
  }

  return (
    <div className={styles.containers}>
      <div className={styles.userHead}>
        <div className={styles.userWallet}>
          <p className={styles.userWalletTitle}>My balance</p>
          <p className={styles.userWalletAddress}>
            <img
              src="https://www.sandbox.game/img/09_User_Profile/builtin.png"
              alt="wallet-logo"
              className={styles.walletLogo}
            />
            <span className={styles.walletAddress}>{account}</span>
          </p>
        </div>
        <div className={styles.transactionHistoryAccess}>
          <Button colorScheme="gray" onClick={() => handleConnectWallet()}>
            {account != '0x0' ? 'connected' : 'Connect Wallet'}
          </Button>
        </div>
      </div>
      <div className={styles.bridgeBody}>
        <div className={styles.containerBody}>
          <header className={styles.bodyHeader}>
            <img
              src="https://www.sandbox.game/img/32_Bridge/layer1-ether.svg"
              alt="sand-ether-icon"
              className={styles.networkIcon}
            />
            Fantom
          </header>
          <div className={styles.currencies}>
            <div className={styles.currency}>
              <img
                src="https://www.sandbox.game/img/32_Bridge/layer1-ether.svg"
                alt="eth-logo"
                className={styles.currencyLogo}
              />
              <div className={styles.currencyBalances}>
                <p className={styles.currencyValue}>{ftmBalance} FTM</p>
              </div>
            </div>
            <div className={styles.currency}></div>
            <div className={styles.currencyCtas}>
              <Button
                isLoading={depositLoading}
                loadingText="process.."
                colorScheme="teal"
                onClick={() => handleDeposit()}
              >
                Deposit
              </Button>
            </div>
          </div>
          <p className={styles.pendingTxs}></p>
          <hr className={styles.separator} />
          <div className={styles.userLands}>
            <header>
              <p className={styles.nftsNetwork}>
                NFTs on Ethereum{' '}
                <Button size="xs" colorScheme="teal" onClick={() => handleRefresh(account)}>
                  刷新
                </Button>
              </p>
              <Button isLoading={isMintLoading} loadingText="Mintting" colorScheme="teal" onClick={() => handleMint()}>
                Mint
              </Button>
            </header>
            <div className={styles.userNfts}>
              <div className={styles.inventoryList}>
                <div className={styles.body}>
                  <HStack {...group}>
                    {Array.from(mainnetNFTS).map((value) => {
                      const radio = getRadioProps({ value })
                      return (
                        <RadioCard key={value} {...radio}>
                          {value}
                        </RadioCard>
                      )
                    })}
                  </HStack>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.containerBody}>
          <header>
            <img
              src="https://www.sandbox.game/img/32_Bridge/layer2-polygon.svg"
              alt="msand-matic-icon"
              className={styles.networkIcon}
            />
            Polygon
          </header>
          <div className={styles.currencies}>
            <div className={styles.currency}>
              <img
                src="https://www.sandbox.game/img/32_Bridge/layer2-polygon.svg"
                alt="eth-logo"
                className={styles.currencyLogo}
              />
              <div className={styles.currencyBalances}>
                <p className={styles.currencyValue}>{maticBalance} MATIC</p>
              </div>
            </div>
            <div className={styles.currency}></div>
            <div className={styles.currencyCtas}>
              <Button
                isLoading={withdrawLoading}
                loadingText="process.."
                colorScheme="teal"
                onClick={() => handleWithdraw()}
              >
                Withdraw
              </Button>
            </div>
          </div>
          <div className={styles.pendingTxs}></div>
          <hr className={styles.separator} />
          <div className={styles.userLands}>
            <header>
              <p className={styles.nftsNetwork}>
                NFTs on Fantom{' '}
                <Button size="xs" colorScheme="teal" onClick={() => handleRefresh(account)}>
                  刷新
                </Button>
              </p>
              <Button colorScheme="teal" onClick={() => handleCheck()}>
                check
              </Button>
            </header>

            <div className={styles.userNfts}>
              <div className={styles.inventoryList}>
                <div className={styles.body}>
                  <SimpleGrid columns={4} spacing={10}>
                    <HStack {...group}>
                      {Array.from(subnetNFTS).map((value) => {
                        const radio = getRadioProps({ value })
                        return (
                          <RadioCard key={value} {...radio}>
                            {value}
                          </RadioCard>
                        )
                      })}
                    </HStack>
                  </SimpleGrid>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
