let proofWorker: Worker | null = null;

function getProofWorker(): Worker {
  if (!proofWorker) {
    const workerUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('proof-worker.js')
      : '/proof-worker.js';
    proofWorker = new Worker(workerUrl);
  }
  return proofWorker;
}

function getProofConfig(): (string | number)[] {
  return [
    navigator.hardwareConcurrency + screen.width + screen.height,
    new Date().toString(),
    0,
    0,
    navigator.userAgent,
    "",
    "",
    navigator.language,
    navigator.languages.join(","),
    0
  ];
}

export function computeProof(seed: string, difficulty: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = getProofWorker();
    const handler = (e: MessageEvent) => {
      worker.removeEventListener('message', handler);
      resolve(e.data);
    };
    const errorHandler = (e: ErrorEvent) => {
      worker.removeEventListener('error', errorHandler);
      reject(e.error || new Error('Worker error'));
    };
    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);
    worker.postMessage({ seed, difficulty, config: getProofConfig() });
  });
}

export async function computeRequirementsToken(): Promise<string> {
  const seed = "" + Math.random();
  const result = await computeProof(seed, "0");
  return "gAAAAAC" + result;
}

export async function computeSentinelProofToken(seed: string, difficulty: string): Promise<string> {
  const result = await computeProof(seed, difficulty);
  return "gAAAAAB" + result;
}
