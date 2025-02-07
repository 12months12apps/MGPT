declare global {
  interface Window {
    mina?: {
      requestAccounts(): Promise<string[]>;
      sendTransaction(params: {
        transaction: string;
        feePayer: {
          fee: number;
          memo: string;
        };
      }): Promise<{ hash: string }>;
    };
  }
}

export {}; 