import {
  type GelatoTaskStatus,
  erc20,
  native,
  sponsored,
} from "@gelatonetwork/smartwallet";
import {
  GelatoSmartWalletConnectButton,
  GelatoSmartWalletContextProvider,
  dynamic,
  useGelatoSmartWalletProviderContext,
  wagmi,
} from "@gelatonetwork/smartwallet-react-sdk";
import { useEffect, useState } from "react";
import { http, useAccount } from "wagmi";
import { arbitrumSepolia, baseSepolia, flowTestnet, inkSepolia, sepolia, storyAeneid } from "viem/chains";
import { encodeFunctionData } from "viem";

// Chain configuration interface
interface ChainConfig {
  id: number;
  name: string;
  explorer: string;
  tokens: {
    WETH?: `0x${string}`;
    USDC?: `0x${string}`;
    WIP?: `0x${string}`;
  };
  counterAddress: `0x${string}`;
}

// Chain configurations
const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [sepolia.id]: {
    id: sepolia.id,
    name: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
    tokens: {
      WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
    counterAddress: "0xEEeBe2F778AA186e88dCf2FEb8f8231565769C27",
  },
  [baseSepolia.id]: {
    id: baseSepolia.id,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    tokens: {
      WETH: "0x4200000000000000000000000000000000000006",
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
    counterAddress: "0xEEeBe2F778AA186e88dCf2FEb8f8231565769C27",
  },
  [inkSepolia.id]: {
    id: inkSepolia.id,
    name: "Ink Sepolia",
    explorer: "https://explorer-sepolia.inkonchain.com/",
    tokens: {
      WETH: "0x60C67E75292B101F9289f11f59aD7DD75194CCa6",
    },
    counterAddress: "0xEEeBe2F778AA186e88dCf2FEb8f8231565769C27",
  },
  [arbitrumSepolia.id]: {
    id: arbitrumSepolia.id,
    name: "Arbitrum Sepolia",
    explorer: "https://sepolia.arbiscan.io/",
    tokens: {
      WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
    },
    counterAddress: "0xEEeBe2F778AA186e88dCf2FEb8f8231565769C27",
  },
  [flowTestnet.id]: {
    id: flowTestnet.id,
    name: "Flow Testnet",
    explorer: "https://testnet.evm.nodes.onflow.org",
    tokens: {},
    counterAddress: "0xE27C1359cf02B49acC6474311Bd79d1f10b1f8De",
  },
  [storyAeneid.id]: {
    id: storyAeneid.id,
    name: "Story Aeneid",
    explorer: "https://aeneid.storyscan.io",
    tokens: {
      WIP: "0x1514000000000000000000000000000000000000",
    },
    counterAddress: "0xa2202D3148ac0F0F44b0bED0153248a0524EdA8D",
  },
};

enum TransactionStatus {
  Submitted = "submitted",
  Executed = "executed",
}

const WalletInfoComponent = () => {
  const {
    gelato: { client },
    switchNetwork,
    logout,
  } = useGelatoSmartWalletProviderContext();

  const [chainId, setChainId] = useState<number>(sepolia.id);
  const [paymentType, setPaymentType] = useState<string>("sponsored");
  const [erc20TokenAddress, setErc20TokenAddress] = useState<`0x${string}` | undefined>(
    CHAIN_CONFIGS[sepolia.id].tokens?.WETH
  );

  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { address: walletAddress } = useAccount();
  const sponsorApiKey = import.meta.env.VITE_SPONSOR_API_KEY;

  const executeTransaction = async () => {
    if (!client) return;

    setIsLoading(true);
    try {
      const payment =
        paymentType === "sponsored"
          ? sponsored(sponsorApiKey)
          : paymentType === "erc20"
          ? erc20(erc20TokenAddress!)
          : native();
      // Example transaction - sending a simple increment call

      const incrementAbi = [
        {
          name: "increment",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [],
          outputs: [],
        },
      ] as const;

      // Create the encoded function data
      const incrementData = encodeFunctionData({
        abi: incrementAbi,
        functionName: "increment",
      });

      const preparedCalls = await client.prepare({
        payment,
        calls: [
          {
            to: CHAIN_CONFIGS[chainId].counterAddress,
            data: incrementData,
            value: 0n,
          },
        ],
      })
      
      const response = await client.send({preparedCalls});

      response.on("submitted", (status: GelatoTaskStatus) => {
        console.log("Transaction submitted:", status.transactionHash);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        setTransactionHash(status.transactionHash!);
        setTransactionStatus(TransactionStatus.Submitted);
        setIsLoading(false);
      });
      response.on("success", (status: GelatoTaskStatus) => {
        console.log("Transaction successful:", status.transactionHash);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        setTransactionHash(status.transactionHash!);
        setTransactionStatus(TransactionStatus.Executed);
        setIsLoading(false);
      });
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  // Handle chainId change and switchNetwork
  useEffect(() => {
    const handleChainChange = async () => {
      try {
        await switchNetwork(chainId);
        setPaymentType("sponsored");
        setTransactionHash(null);
        setErc20TokenAddress(CHAIN_CONFIGS[chainId].tokens.WETH);
      } catch (error) {
        console.error("Failed to switch network:", error);
      }
    };

    handleChainChange();
  }, [chainId, switchNetwork]);

  return (
    <div>
      <h2>Gelato SmartWallet</h2>
      {client ? (
        <div>
          <p>Wallet connected!</p>
          <p>
            Wallet Address:{" "}
            <a
              href={`${CHAIN_CONFIGS[chainId].explorer}/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {walletAddress}
            </a>
          </p>
          <div style={{ marginTop: "20px" }}>
            <h3>SmartWallet Transaction</h3>
            <div>
              <div style={{ marginBottom: "15px" }}>
                <label htmlFor="paymentType" style={{ marginRight: "10px" }}>
                  Network:
                </label>
                <select
                  id="network"
                  value={chainId}
                  onChange={(e) => {
                    setChainId(Number.parseInt(e.target.value));
                  }}
                  style={{ padding: "5px", borderRadius: "4px" }}
                >
                  {Object.values(CHAIN_CONFIGS).map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label htmlFor="paymentType" style={{ marginRight: "10px" }}>
                  Payment Type:
                </label>
                <select
                  id="paymentType"
                  onChange={(e) => {
                    setPaymentType(e.target.value);
                  }}
                  style={{ padding: "5px", borderRadius: "4px" }}
                >
                  <option value="sponsored">Sponsored</option>
                  <option value="erc20">ERC20</option>
                  <option value="native">Native</option>
                </select>
              </div>
              {paymentType === "erc20" && (
                <div style={{ marginBottom: "15px" }}>
                  <label htmlFor="tokenSelect" style={{ marginRight: "10px" }}>
                    Select Token:
                  </label>
                  <select
                    id="tokenSelect"
                    onChange={(e) => {
                      setErc20TokenAddress(e.target.value as `0x${string}`);
                    }}
                    style={{ padding: "5px", borderRadius: "4px" }}
                  >
                    <option value={CHAIN_CONFIGS[chainId].tokens.WETH}>
                      WETH
                    </option>
                    <option value={CHAIN_CONFIGS[chainId].tokens.USDC}>
                      USDC
                    </option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={executeTransaction}
                disabled={isLoading}
                style={{
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "Processing..." : "Execute Transaction"}
              </button>
              {transactionHash && (
                <div>
                  <p>Transaction Status: {transactionStatus}</p>
                  <p>
                    Transaction Hash:{" "}
                    <a
                      href={`${CHAIN_CONFIGS[chainId].explorer}/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {transactionHash}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>
          <p />
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <p>No wallet connected</p>
          <GelatoSmartWalletConnectButton>Login</GelatoSmartWalletConnectButton>
        </div>
      )}
    </div>
  );
};

export default function Providers() {
  const sponsorApiKey = import.meta.env.VITE_SPONSOR_API_KEY;
  const waasAppId = import.meta.env.VITE_WAAS_APP_ID;

  if (!waasAppId || !sponsorApiKey) {
    return (
      <div>
        <h1>Error</h1>
        <p>
          {!waasAppId && "WAAS app ID is not set. "}
          {!sponsorApiKey && "Sponsor API key is not set. "}
          Please set the required environment variables.
        </p>
      </div>
    );
  }

  return (
    <GelatoSmartWalletContextProvider
      // Changing this to `dynamic` or `privy` is enough to change WaaS provider
      // VITE_WAAS_APP_ID also needs to be set accordingly
      settings={{
        scw: {
          type: "gelato",
        },
        apiKey: sponsorApiKey,
        waas: dynamic(waasAppId), // configure the networks below on your WAAS dashboard
        wagmi: wagmi({
          chains: [inkSepolia, sepolia, baseSepolia, arbitrumSepolia, flowTestnet, storyAeneid],
          transports: {
            [inkSepolia.id]: http(),
            [sepolia.id]: http(),
            [baseSepolia.id]: http(),
            [arbitrumSepolia.id]: http(),
            [flowTestnet.id]: http(),
            [storyAeneid.id]: http(),
          },
        }),
      }}
    >
      <WalletInfoComponent />
    </GelatoSmartWalletContextProvider>
  );
}
