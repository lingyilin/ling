import { useContractRead, useAccount, useContract, useSwitchNetwork, useNetwork } from 'wagmi';
import { forwarderAbi, storkABI } from '@/lib/ABIs/Stork';
import { polygonMumbai } from 'wagmi/chains';
import { BigNumber, ethers } from 'ethers';
import { DEFENDER_ENCRYPT_URL, DEFENDER_RELAY_URL, STORK_CONTRACT_ADDRESS, STORK_FORWARDER_CONTRACT_ADDRESS } from '@/lib/constants';
import { useSignTypedData } from 'wagmi'
import Navbar from '@/components/navbar';
import { useUSDprice } from '@/lib/hooks/swr/usePrice';
import InformationCard from '@/components/informationCard';
import { useTwitterConnect } from '@/lib/hooks/useTwitterConnect';
import { AutoTaskResult, useAutoTask } from '@/lib/hooks/useAutoTask';
import useInterval from '@/lib/hooks/useInterval';
import Background from '@/components/background';
import JuberJabber from '@/components/JuberJabber';
import { useWeb3Modal } from '@web3modal/react';
import { useEffect, useRef } from 'react';
import { LSK_USER_CRED } from '@/lib/constants';

const types = {
    ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' },
    ],
} as const

export default function Claim() {
    let { price: maticPrice } = useUSDprice('MATIC');
    let { data: userData, isConnected: twitterIsConnected } = useTwitterConnect();
    let { open: openWalletConnect } = useWeb3Modal();

    const { isConnected, address } = useAccount();
    const { data: balance, error: readBalanceError, isError: isReadBalanceError, refetch: refetchUserBalance } = useReadBalance(userData?.userName);
    const balanceInEth = balance != undefined ? ethers.utils.formatEther(balance.toString()) : '0';
    const balanceInUsd = Number.parseFloat(balanceInEth) * maticPrice;

    const contract = useContract({
        abi: storkABI,
        address: STORK_CONTRACT_ADDRESS,
    });

    const { chain } = useNetwork()
    const { switchNetwork } = useSwitchNetwork({
        chainId: polygonMumbai.id,
    });

    const { data: forwarderNonce } = useContractRead({
        abi: forwarderAbi,
        address: STORK_FORWARDER_CONTRACT_ADDRESS,
        functionName: "getNonce",
        chainId: polygonMumbai.id,
        args: [address!],
        enabled: Boolean(address) && isConnected,
    });

    const { data: autotasEncryptedResult, call: callEncrypteAutotask, isError: isEncryptAutoTaskError, isLoading: isEncryptAutotaskLoading, error: encryptAutotaskError, isSuccess: isEncryptAutotaskSuccess } = useAutoTask(DEFENDER_ENCRYPT_URL);

    const { data: autotaskResult, call: callAutotask, isError: isAutoTaskError, isLoading: isAutotaskLoading, error: autotaskError, isSuccess: isAutotaskSuccess } = useAutoTask(DEFENDER_RELAY_URL);

    const autotaskResultRef = useRef<AutoTaskResult|null>(null)

    const { isError: isClaimError, error: claimError, isLoading: isSignLoading, isSuccess: isClaimSuccess, signTypedData, isIdle } =
        useSignTypedData({
            onSuccess: (data, variable) => {
                callAutotask(JSON.stringify({
                    signature: data,
                    request: {
                        nonce: forwarderNonce?.toNumber(),
                        data: contract?.interface.encodeFunctionData('claimTwitterHandle', [userData?.userName, autotaskResultRef.current?.encryptedAccessToken || "0x", true])! as `0x${string}`,
                        from: address!,
                        to: STORK_CONTRACT_ADDRESS,
                        gas: 1000000,
                        value: 0
                    }
                }));
            }
        });

    // Refetch after autotask call and before balance is zero
    useInterval(async () => {
        await refetchUserBalance();
    }, isAutotaskSuccess && balance?.gt(0) ? 2000 : null);

    return (
        <Background>
            <Navbar />
            <section className="py-12">
                <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="max-w-md mx-auto mt-8 text-center">
                        <h1 className="text-4xl font-bold text-gray-900 lg:text-5xl">
                            <span>Hey 👋 </span>
                            {userData?.userName ? <span>@{userData?.userName}</span> : "there"}
                        </h1>
                        <p className="mt-6 text-base font-medium text-gray-500 lg:text-lg">
                            <JuberJabber />
                        </p>
                    </div>
                    {
                        balance &&
                        <div className="max-w-sm mx-auto mt-10 overflow-hidden text-center bg-gray-900 rounded-xl">
                            <div className="p-6">
                                <p className="mt-4 text-base font-medium text-gray-500 lg:text-lg">You have:</p>

                                <div className="flex items-center justify-center px-1 space-x-3 lg:space-x-6">
                                    <div>
                                        <p className="text-4xl font-bold text-white">{balanceInEth} MATIC</p>
                                        <p className="mt-1 text-xl font-medium text-gray-400">${balanceInUsd.toFixed(2)}</p>
                                    </div>
                                </div>
                                {(balance?.gt(0)) &&
                                    <div className="mt-5">
                                        <button
                                            disabled={isAutotaskLoading || isAutotaskSuccess || isSignLoading || isEncryptAutotaskLoading}
                                            className="inline-flex items-center justify-center w-full px-6 py-4 text-xs font-bold tracking-widest text-white uppercase transition-all duration-200 border border-transparent rounded-lg bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-300 hover:bg-indigo-500 disabled:bg-slate-800"
                                            onClick={async () => {
                                                if (!isConnected) {
                                                    openWalletConnect?.();
                                                }
                                                else if (chain?.id != polygonMumbai.id && isConnected) {
                                                    if (switchNetwork != null) {
                                                        switchNetwork(polygonMumbai.id);
                                                    }
                                                    else {
                                                        alert("Couldn't change the network. Please change it manually from your wallet.");
                                                    }
                                                }
                                                else {
                                                    let encryptedAccessToken = await callEncrypteAutotask?.(JSON.stringify({ refreshToken: userData?.refreshToken }));
                                                    if(encryptedAccessToken && encryptedAccessToken.encryptedAccessToken){
                                                        var tokens = JSON.parse(window.localStorage.getItem(LSK_USER_CRED) || '{}');
                                                        tokens.token = encryptedAccessToken.accessToken;
                                                        tokens.refreshToken =  encryptedAccessToken.refreshToken;
                                                        window.localStorage.setItem(LSK_USER_CRED, JSON.stringify(tokens));

                                                        autotaskResultRef.current = encryptedAccessToken
                                                        signTypedData?.({
                                                            domain: {
                                                                chainId: polygonMumbai.id,
                                                                name: 'MinimalForwarder',
                                                                version: '0.0.1',
                                                                verifyingContract: STORK_FORWARDER_CONTRACT_ADDRESS,
                                                            },
                                                            types,
                                                            value: {
                                                                nonce: forwarderNonce!,
                                                                data: contract?.interface.encodeFunctionData('claimTwitterHandle', [userData?.userName ?? '', autotaskResultRef.current?.encryptedAccessToken || "0x", true]) as `0x${string}`,
                                                                from: address!,
                                                                to: STORK_CONTRACT_ADDRESS,
                                                                gas: BigNumber.from(1000000),
                                                                value: BigNumber.from(0)
                                                            }
                                                        });
                                                    }
                                                }
                                            }}>
                                            {isSignLoading || isAutotaskLoading || isEncryptAutotaskLoading ? 'Claiming' : !isConnected ? 'Connect a wallet to claim' : chain?.id != polygonMumbai.id ? "Change wallet network" :  'Claim'}
                                        </button>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </div>
                <div className='max-w-sm mx-auto mt-5 overflow-hidden bg-white shadow rounded-xl space-y-2'>
                    {(isSignLoading || isAutotaskLoading || isEncryptAutotaskLoading) &&
                        <InformationCard isLoading={true} text={isSignLoading ? 'Confirm transaction with your wallet' : (isAutotaskLoading ? 'Transaction in progress' : (isEncryptAutotaskLoading ? 'Preparing Transaction' : ""))} type='wallet' />
                    }
                    {(isClaimError || isAutoTaskError || isReadBalanceError || isEncryptAutoTaskError) && (
                        <InformationCard isLoading={false} text={(claimError || autotaskError || encryptAutotaskError || readBalanceError)?.message} type='error' />
                    )}
                    {isClaimSuccess && isAutotaskSuccess && (
                        <InformationCard isLoading={false} text={
                            <span>
                                Successfully claimed!&nbsp;
                                <span>
                                    <a target='_blank' className='underline hover:underline-offset-4' href={`${polygonMumbai.blockExplorers.etherscan.url}/tx/${autotasEncryptedResult?.txHash}`}>View in Explorer</a>
                                </span>
                            </span>
                        } type='wallet' />
                    )}
                    {isAutotaskSuccess && balance?.gt(0) &&
                        <InformationCard isLoading={true} text="Balance changes will be reflected soon." type='wallet' />
                    }
                    {/* {
                        <Popover>
                            <PopoverTrigger className='bg-slate-800 text-white text-lg font-bold items-center'>
                                <div className='flex flex-row gap-x-2 items-center justify-items-center'>
                                    <Fuel />

                                    <span>
                                        Ask a Degen friend for a top-up
                                    </span>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent>Place content for the popover here.</PopoverContent>
                        </Popover>
                    } */}
                </div>
            </section>
        </Background>
    )
}

function useReadBalance(userName: string | undefined): typeof data {
    let data = useContractRead({
        address: STORK_CONTRACT_ADDRESS,
        abi: storkABI,
        functionName: "balanceOfTwitterHandle",
        chainId: polygonMumbai.id,
        args: [userName!],
        enabled: Boolean(userName)
    });

    return data;
}
