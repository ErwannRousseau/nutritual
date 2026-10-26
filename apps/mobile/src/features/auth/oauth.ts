export type CodeExchangeParams = {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
};

export function createCodeExchangeParams(params: CodeExchangeParams) {
  return {
    clientId: params.clientId,
    code: params.code,
    redirectUri: params.redirectUri,
    extraParams: {
      code_verifier: params.codeVerifier,
      resource: params.resource,
    },
  };
}
