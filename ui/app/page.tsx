"use client";
import { PrivateKey } from "o1js";
import { useEffect, useState } from "react";
import "./reactCOIServiceWorker";
import ZkappWorkerClient from "./zkappWorkerClient";
import { CodeEditor } from "../components/CodeEditor";

const transactionFee = 0.1;

export default function Home() {
  const [zkappWorkerClient, setZkappWorkerClient] =
    useState<null | ZkappWorkerClient>(null);
  const [hasWallet, setHasWallet] = useState<null | boolean>(null);
  const [hasBeenSetup, setHasBeenSetup] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [publicKeyBase58, setPublicKeyBase58] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [transactionlink, setTransactionLink] = useState("");

  const displayStep = (step: string) => {
    setDisplayText(step);
    console.log(step);
  };

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    const setup = async () => {
      try {
        if (!hasBeenSetup) {
          displayStep("Loading web worker...");
          const zkappWorkerClient = new ZkappWorkerClient();
          setZkappWorkerClient(zkappWorkerClient);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          displayStep("Done loading web worker");

          await zkappWorkerClient.setActiveInstanceToDevnet();

          const mina = window.mina;
          if (mina == null) {
            setHasWallet(false);
            displayStep("Wallet not found.");
            return;
          }

          const publicKeyBase58: string = (await mina.requestAccounts())[0];
          setPublicKeyBase58(publicKeyBase58);
          displayStep(`Using key:${publicKeyBase58}`);

          setHasBeenSetup(true);
          setHasWallet(true);
          setDisplayText("");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        displayStep(`Error during setup: ${error.message}`);
      }
    };

    setup();
  }, [hasBeenSetup]);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    const checkAccountExists = async () => {
      if (hasBeenSetup && !accountExists) {
        try {
          for (;;) {
            displayStep("Checking if fee payer account exists...");

            const res = await zkappWorkerClient!.fetchAccount(publicKeyBase58);
            const accountExists = res.error == null;
            if (accountExists) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          displayStep(`Error checking account: ${error.message}`);
        }
      }
      setAccountExists(true);
    };

    checkAccountExists();
  }, [zkappWorkerClient, hasBeenSetup, accountExists, publicKeyBase58]);

  const deployNewContract = async () => {
    try {
      setTransactionLink("");
      const mina = window.mina;

      if (mina == null) {
        setHasWallet(false);
        return;
      }

      displayStep("Loading contract...");
      // Load and compile contract first
      await zkappWorkerClient!.loadContract();
      displayStep("Compiling contract...");
      await zkappWorkerClient!.compileContract();
      displayStep("Deploying contract...");

      console.log("sending a deployment transaction...");
      await zkappWorkerClient!.fetchAccount(publicKeyBase58);

      const privateKey = PrivateKey.random();
      console.log("generated new contract private key...");
      console.log(privateKey.toBase58);

      const zkappPublicKey = privateKey.toPublicKey();
      const contractPK = zkappPublicKey.toBase58();
      console.log("its corresponding public key is...");
      console.log(contractPK);

      console.log("creating deployment transaction...");
      if (!publicKeyBase58) return;
      await zkappWorkerClient!.createDeployContract(
        privateKey.toBase58(),
        publicKeyBase58
      );

      console.log("getting Transaction JSON...");
      const transactionJSON = await zkappWorkerClient!.getTransactionJSON();
      console.log(transactionJSON);

      const { hash } = await mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: transactionFee,
          memo: "",
        },
      });

      const transactionLink = `https://minascan.io/devnet/tx/${hash}`;
      console.log("See transaction at", transactionLink);
      setTransactionLink(transactionLink);
      displayStep("Contract deployed.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      displayStep(`Error during deployment: ${error.message}`);
    }
  };

  let auroLinkElem;
  if (hasWallet === false) {
    auroLinkElem = (
      <div>
        Could not find a wallet.{" "}
        <a href="https://www.aurowallet.com/" target="_blank" rel="noreferrer">
          Install Auro wallet here
        </a>
      </div>
    );
  }

  const stepDisplay = transactionlink ? (
    <a
      href={transactionlink}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "underline" }}
    >
      View transaction
    </a>
  ) : (
    displayText
  );

  const setup = (
    <div
      style={{ fontWeight: "bold", fontSize: "1.5rem", paddingBottom: "5rem" }}
    >
      {stepDisplay}
      {auroLinkElem}
    </div>
  );

  let accountDoesNotExist;
  if (hasBeenSetup && !accountExists) {
    const faucetLink = `https://faucet.minaprotocol.com/?address='${publicKeyBase58}`;
    accountDoesNotExist = (
      <div>
        <span style={{ paddingRight: "1rem" }}>Account does not exist.</span>
        <a href={faucetLink} target="_blank" rel="noreferrer">
          Visit the faucet to fund this fee payer account
        </a>
      </div>
    );
  }

  let mainContent;
  if (hasBeenSetup && accountExists) {
    mainContent = (
      <div style={{ justifyContent: "center", alignItems: "center" }}>
        <button onClick={deployNewContract}>deploy new</button>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: 0 }}>
        <div style={{ padding: 0 }}>
          {setup}
          {accountDoesNotExist}
          {mainContent}
        </div>
      </div>
      <CodeEditor />
    </>
  );
}
