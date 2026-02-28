import { BrowserProvider, formatEther } from 'ethers';

const WALLET_STORAGE_KEY = 'chainpulse_wallet_connected';

export interface WalletState {
  address: string;
  chainId: number;
  balance: string;
}

type WalletListener = (state: WalletState | null) => void;

class WalletManager {
  private provider: BrowserProvider | null = null;
  private listeners: WalletListener[] = [];
  private currentState: WalletState | null = null;

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).ethereum;
  }

  get state(): WalletState | null {
    return this.currentState;
  }

  subscribe(listener: WalletListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(state: WalletState | null): void {
    this.currentState = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  async connect(): Promise<WalletState | null> {
    if (!this.isAvailable) return null;

    const ethereum = (window as any).ethereum;
    this.provider = new BrowserProvider(ethereum);

    try {
      const accounts = await this.provider.send('eth_requestAccounts', []);
      if (accounts.length === 0) return null;

      const address = accounts[0] as string;
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(address);

      const state: WalletState = {
        address,
        chainId: Number(network.chainId),
        balance: formatEther(balance),
      };

      this.notify(state);
      this.setupListeners();
      this.saveConnectedState(true);

      return state;
    } catch {
      return null;
    }
  }

  disconnect(): void {
    this.removeListeners();
    this.provider = null;
    this.notify(null);
    this.saveConnectedState(false);
  }

  async tryAutoConnect(): Promise<void> {
    if (!this.isAvailable || !this.wasConnected()) return;

    const ethereum = (window as any).ethereum;
    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts.length > 0) {
        await this.connect();
      }
    } catch {
      // Silent fail for auto-connect
    }
  }

  private setupListeners(): void {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    ethereum.on('accountsChanged', this.handleAccountsChanged);
    ethereum.on('chainChanged', this.handleChainChanged);
  }

  private removeListeners(): void {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
    ethereum.removeListener('chainChanged', this.handleChainChanged);
  }

  private handleAccountsChanged = async (accounts: string[]): Promise<void> => {
    if (accounts.length === 0) {
      this.disconnect();
    } else {
      await this.refreshState(accounts[0]);
    }
  };

  private handleChainChanged = async (): Promise<void> => {
    // Re-create provider on chain change
    if (this.isAvailable) {
      this.provider = new BrowserProvider((window as any).ethereum);
      if (this.currentState) {
        await this.refreshState(this.currentState.address);
      }
    }
  };

  private async refreshState(address: string): Promise<void> {
    if (!this.provider) return;
    try {
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(address);
      this.notify({
        address,
        chainId: Number(network.chainId),
        balance: formatEther(balance),
      });
    } catch {
      // Keep existing state on refresh failure
    }
  }

  private saveConnectedState(connected: boolean): void {
    try {
      if (connected) {
        localStorage.setItem(WALLET_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }

  private wasConnected(): boolean {
    try {
      return localStorage.getItem(WALLET_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}

export const walletManager = new WalletManager();
