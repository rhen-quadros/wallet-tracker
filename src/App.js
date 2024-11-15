import React, { useState, useEffect } from 'react';
import { Connection, PublicKey, StakeProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { useToast } from './contexts/ToastContext';
import { X, RefreshCw, Trash2, Plus, TrendingUp, Wallet } from 'lucide-react';
import { Toaster } from "./components/ui/toaster";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const [addressInputs, setAddressInputs] = useState(['']);
  const [addresses, setAddresses] = useState(() => {
    const saved = localStorage.getItem('walletAddresses');
    return saved ? JSON.parse(saved) : [];
  });
  const [walletData, setWalletData] = useState({});
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState(0);
  const [tokenList, setTokenList] = useState({});
  const { toast } = useToast();
  const [tokenListLoading, setTokenListLoading] = useState(true);

  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=183200ba-7981-4a8c-87e7-f742f66c2dbf');

  const handleInputChange = (index, value) => {
    const newInputs = [...addressInputs];
    newInputs[index] = value;
    setAddressInputs(newInputs);
  };

  const addInput = () => {
    setAddressInputs([...addressInputs, '']);
  };

  const removeInput = (index) => {
    if (addressInputs.length > 1) {
      const newInputs = addressInputs.filter((_, i) => i !== index);
      setAddressInputs(newInputs);
    }
  };

  const removeAddress = (addressToRemove) => {
    setAddresses(prevAddresses => prevAddresses.filter(addr => addr !== addressToRemove));
    setWalletData(prevData => {
      const newData = { ...prevData };
      delete newData[addressToRemove];
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Filter and validate new addresses
      const validNewAddresses = addressInputs.filter(addr => addr.trim());
      validNewAddresses.forEach(addr => {
        try {
          new PublicKey(addr);
        } catch (err) {
          throw new Error(`Invalid address: ${addr}`);
        }
      });

      // Combine existing and new addresses, removing duplicates
      const updatedAddresses = [...new Set([...addresses, ...validNewAddresses])];
      setAddresses(updatedAddresses);

      // Fetch data only for new addresses
      const newData = { ...walletData };
      for (const address of validNewAddresses) {
        const walletInfo = await fetchWalletData(address);
        newData[address] = walletInfo;
      }
      setWalletData(newData);

      // Clear only the input fields
      setAddressInputs(['']);
      
      toast({
        description: "Wallets added successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Error adding wallets:', error);
      toast({
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletData = async (address) => {
    try {
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      
      // This was the working version for native staked SOL
      const stakeAccounts = await connection.getParsedProgramAccounts(
        StakeProgram.programId,
        {
          filters: [
            {
              dataSize: 200
            },
            {
              memcmp: {
                offset: 12,
                bytes: publicKey.toBase58()
              }
            }
          ]
        }
      );

      console.log('Stake accounts found:', stakeAccounts);

      const totalStaked = stakeAccounts.reduce((total, account) => {
        try {
          const parsedData = account.account.data.parsed;
          console.log('Parsed stake data:', parsedData);
          
          if (parsedData?.info?.stake?.delegation?.stake) {
            return total + Number(parsedData.info.stake.delegation.stake);
          }
        } catch (e) {
          console.error('Error parsing stake account:', e);
        }
        return total;
      }, 0);

      console.log('Total staked:', totalStaked / LAMPORTS_PER_SOL, 'SOL');

      // Get token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: TOKEN_PROGRAM_ID
        }
      );

      // Get token prices
      const tokenMints = tokenAccounts.value
        .map(account => account.account.data.parsed.info.mint);

      const pricesResponse = await fetch('https://price.jup.ag/v4/price?ids=' + tokenMints.join(','));
      const pricesData = await pricesResponse.json();

      const tokens = tokenAccounts.value
        .map(account => {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const tokenInfo = tokenList[mintAddress];
          
          console.log('Processing token:', {
            mint: mintAddress,
            tokenInfo: tokenInfo,
            listSize: Object.keys(tokenList).length
          });

          const amount = parsedInfo.tokenAmount.uiAmount;
          const price = pricesData?.data?.[mintAddress]?.price || 0;
          const usdValue = amount * price;

          return {
            symbol: tokenInfo?.symbol || 'Unknown',
            name: tokenInfo?.name || 'Unknown Token',
            amount: amount,
            mint: mintAddress,
            decimals: tokenInfo?.decimals || 9,
            usdValue: usdValue,
            price: price,
            logoURI: tokenInfo?.logoURI
          };
        })
        .filter(token => token.usdValue > 0);

      const solUsdValue = calculateSolInUsd(balance);
      const stakedSolUsdValue = calculateSolInUsd(totalStaked);
      const tokensUsdValue = tokens.reduce((total, token) => total + token.usdValue, 0);

      return {
        solBalance: balance,
        stakedBalance: totalStaked,
        tokens: tokens,
        totalUsdValue: solUsdValue + stakedSolUsdValue + tokensUsdValue
      };
    } catch (error) {
      console.error(`Error fetching data for address ${address}:`, error);
      return null;
    }
  };

  const calculateSolInUsd = (balance) => {
    if (!balance || !solPrice) return 0;
    return (balance / LAMPORTS_PER_SOL) * solPrice;
  };

  const formatSolBalance = (balance) => {
    if (!balance) return "0.00";
    return (balance / LAMPORTS_PER_SOL).toFixed(2);
  };

  const formatTokenBalance = (amount) => {
    if (!amount) return "0.00";
    return Number(amount).toFixed(2);
  };

  // Add this useEffect to fetch SOL price and token list
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        setSolPrice(data.solana.usd);

        const tokenResponse = await fetch('https://token.jup.ag/strict');
        const tokenData = await tokenResponse.json();
        setTokenList(tokenData);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
  }, []);

  // Add this useEffect to save addresses to localStorage
  useEffect(() => {
    localStorage.setItem('walletAddresses', JSON.stringify(addresses));
  }, [addresses]);

  const formatAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatUSD = (amount) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateTotalPortfolioValue = () => {
    if (!addresses.length) return 0;
    return Object.values(walletData).reduce((total, data) => {
      if (!data) return total;
      return total + data.totalUsdValue;
    }, 0);
  };

  const handleClearAll = () => {
    localStorage.removeItem('walletAddresses');
    setAddresses([]);
    setWalletData({});
    setAddressInputs(['']);
    toast({
      title: "Cleared",
      description: "All wallet data has been cleared"
    });
  };

  // Add this at the start of your component
  useEffect(() => {
    const fetchTokenList = async () => {
      try {
        // Use Jupiter's full token list
        const response = await fetch('https://token.jup.ag/all');
        const data = await response.json();
        console.log('Fetched token list:', data);
        
        // Create a map of mint addresses to token info
        const tokenMap = {};
        data.forEach(token => {
          tokenMap[token.address] = {
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI // Make sure we get the logo URL
          };
        });
        console.log('Token map created:', tokenMap);
        setTokenList(tokenMap);
      } catch (error) {
        console.error('Error fetching token list:', error);
      } finally {
        setTokenListLoading(false);
      }
    };

    fetchTokenList();
  }, []);

  // Add this after your other useEffects
  useEffect(() => {
    const fetchSavedWalletData = async () => {
      if (addresses.length > 0) {
        setLoading(true);
        try {
          const data = {};
          for (const address of addresses) {
            const walletInfo = await fetchWalletData(address);
            data[address] = walletInfo;
          }
          setWalletData(data);
        } catch (error) {
          console.error('Error fetching saved wallet data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchSavedWalletData();
  }, [addresses]);

  // Add this function to handle refresh
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = {};
      for (const address of addresses) {
        const walletInfo = await fetchWalletData(address);
        data[address] = walletInfo;
      }
      setWalletData(data);
      toast({
        description: "Data refreshed successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        description: "Error refreshing data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Add loading skeleton component
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-24"></div></td>
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-32"></div></td>
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-24"></div></td>
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-40"></div></td>
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-24"></div></td>
      <td className="table-cell"><div className="h-4 bg-dark-accent/20 rounded w-8"></div></td>
    </tr>
  );

  return (
    <>
      <div className="min-h-screen bg-dark-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto animate-fade-in">
          <Card className="wallet-card">
            <CardHeader className="border-b border-dark-border">
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center"
              >
                <div className="flex items-center space-x-4">
                  <CardTitle className="text-xl font-bold text-dark-text-primary flex items-center">
                    <Wallet className="mr-2 h-5 w-5" />
                    Wallet Tracker
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="bg-dark-accent hover:bg-dark-accent/90 flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearAll}
                    className="bg-dark-accent hover:bg-dark-accent/90 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
                <motion.div 
                  className="text-right"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-2xl font-bold text-dark-text-primary flex items-center justify-end">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    {formatUSD(calculateTotalPortfolioValue())}
                  </div>
                  <div className="text-sm text-dark-text-secondary">
                    Total Portfolio Value
                  </div>
                </motion.div>
              </motion.div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col space-y-2">
                  {addressInputs.map((address, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        className="input-field flex-1"
                        placeholder="Enter Solana address"
                        value={address}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-dark-text-secondary hover:text-dark-text-primary"
                          onClick={() => removeInput(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    className="bg-dark-accent hover:bg-dark-accent/90"
                    onClick={addInput}
                  >
                    Add Address
                  </Button>
                  <Button
                    type="submit"
                    className="bg-dark-accent hover:bg-dark-accent/90"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Track Wallets'}
                  </Button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-dark-border">
                    <tr>
                      <th className="table-cell text-left text-dark-text-secondary">Address</th>
                      <th className="table-cell text-left text-dark-text-secondary">SOL Balance</th>
                      <th className="table-cell text-left text-dark-text-secondary">SOL Value (USD)</th>
                      <th className="table-cell text-left text-dark-text-secondary">Token Balances</th>
                      <th className="table-cell text-left text-dark-text-secondary">Total Value (USD)</th>
                      <th className="table-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    <AnimatePresence>
                      {loading ? (
                        Array(addresses.length || 1).fill(0).map((_, i) => (
                          <SkeletonRow key={`skeleton-${i}`} />
                        ))
                      ) : (
                        addresses.map((address) => (
                          <motion.tr
                            key={address}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="hover:bg-dark-card/50 transition-colors"
                          >
                            <td className="table-cell font-mono">{formatAddress(address)}</td>
                            <td className="table-cell">
                              {loading ? "Loading..." : (
                                <div className="space-y-1">
                                  {formatSolBalance(walletData[address]?.solBalance || 0)} SOL
                                  {walletData[address]?.stakedBalance > 0 && (
                                    <div className="text-sm text-dark-text-secondary">
                                      + {formatSolBalance(walletData[address]?.stakedBalance)} Staked SOL
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="table-cell">{formatUSD(calculateSolInUsd(walletData[address]?.solBalance))}</td>
                            <td className="table-cell">
                              <div className="space-y-1">
                                {walletData[address]?.tokens.map((token, idx) => (
                                  <motion.div
                                    key={idx}
                                    className="flex justify-between text-sm hover:bg-dark-accent/10 p-1 rounded transition-colors items-center"
                                    whileHover={{ scale: 1.01 }}
                                  >
                                    <span title={token.name} className="flex items-center">
                                      {token.logoURI && (
                                        <img 
                                          src={token.logoURI} 
                                          alt={token.symbol}
                                          className="w-4 h-4 rounded-full mr-2"
                                        />
                                      )}
                                      {formatTokenBalance(token.amount)} {token.symbol}
                                    </span>
                                    <span className="text-dark-text-secondary">
                                      {formatUSD(token.usdValue)}
                                    </span>
                                  </motion.div>
                                ))}
                              </div>
                            </td>
                            <td className="table-cell">{formatUSD(walletData[address]?.totalUsdValue)}</td>
                            <td className="table-cell">
                              <Button
                                variant="ghost"
                                className="text-dark-text-secondary hover:text-dark-text-primary"
                                onClick={() => removeAddress(address)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </>
  );
}

export default App;
